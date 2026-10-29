"use strict";

/*
 * Testes de integração da API contra PostgreSQL real (TEST_DATABASE_URL).
 * Cada cenário cria seus próprios dados (empresas e usuários com nomes únicos),
 * e as requisições passam pelo servidor HTTP real, com cookies, CSRF e origem.
 *
 * Executar: npm run test:integration (requer TEST_DATABASE_URL e TEST_DATABASE_RESET=sim).
 */

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const h = require("./helpers");

before(async () => {
  await h.prepararBanco();
});

after(async () => {
  await h.encerrar();
});

/* Abastecimento válido para os testes de escrita. */
function novoAbastecimento(id, veiculoId = "VEI-001") {
  return {
    id,
    veiculoId,
    dataHora: "2026-10-22T08:00",
    quilometragem: 90000,
    litros: 50,
    valorTotal: 300,
    precoLitro: 6,
    posto: "Posto Teste",
    responsavel: "Teste",
    observacao: "",
    tanqueCheio: false,
  };
}

describe("autenticação e sessões", () => {
  let empresaId;
  before(async () => {
    empresaId = await h.criarEmpresa("auth-empresa");
    await h.criarEstado(empresaId);
    await h.criarUsuario({ empresaId, login: "auth.admin", permissoes: ["admin", "relatorios"] });
    await h.criarUsuario({ empresaId, login: "auth.inativo", ativo: false, permissoes: ["relatorios"] });
  });

  it("login correto devolve 200 sem senha nem hash e grava apenas o hash do token", async () => {
    const resposta = await h.requisitar("POST", "/api/v1/auth/login", {
      corpo: { login: "auth.admin", senha: "senha-forte-123" },
    });
    assert.equal(resposta.status, 200);
    assert.equal(resposta.json.data.usuario.login, "auth.admin");
    assert.equal(resposta.texto.includes("scrypt$"), false);
    assert.equal(resposta.texto.includes("senha-forte-123"), false);

    const cookieSessao = resposta.cookiesRecebidos.find((c) => c.startsWith("gt_session="));
    assert.match(cookieSessao, /HttpOnly/);
    assert.match(cookieSessao, /Secure/);
    assert.match(cookieSessao, /SameSite=Lax/);
    const token = h.valorDoCookie(resposta.cookiesRecebidos, "gt_session");
    const armazenados = await h.sql("SELECT token_hash FROM app_sessions WHERE token_hash = $1", [token]);
    assert.equal(armazenados.length, 0, "o token em claro não pode estar no banco");
  });

  it("senha errada, usuário inexistente e usuário inativo recebem a mesma resposta", async () => {
    const errada = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "auth.admin", senha: "senha-errada-999" } });
    const inexistente = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "nao.existe", senha: "senha-errada-999" } });
    const inativo = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "auth.inativo", senha: "senha-forte-123" } });
    for (const r of [errada, inexistente, inativo]) {
      assert.equal(r.status, 401);
      assert.equal(r.json.error.code, "CREDENCIAIS_INVALIDAS");
      assert.equal(r.json.error.message, "Usuário ou senha inválidos.");
    }
    assert.equal(errada.texto.replace(/"id":"[^"]*"/g, ""), inexistente.texto.replace(/"id":"[^"]*"/g, ""));
  });

  it("cinco falhas bloqueiam o login mesmo com a senha correta", async () => {
    await h.criarUsuario({ empresaId, login: "auth.alvo", permissoes: ["relatorios"] });
    for (let i = 0; i < 5; i += 1) {
      const r = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "auth.alvo", senha: "errada-errada-1" } });
      assert.equal(r.status, 401);
    }
    const bloqueado = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "auth.alvo", senha: "senha-forte-123" } });
    assert.equal(bloqueado.status, 429);
    assert.equal(bloqueado.json.error.code, "MUITAS_TENTATIVAS");
  });

  it("expiração no banco encerra a sessão mesmo com cookie ainda presente", async () => {
    const sessao = await h.entrar("auth.admin");
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies })).status, 200);
    await h.sql(
      "UPDATE app_sessions SET expires_at = NOW() - make_interval(mins => 1) WHERE token_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')",
      [sessao.sessao],
    );
    const depois = await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies });
    assert.equal(depois.status, 401);
  });

  it("logout revoga a sessão: o cookie antigo deixa de funcionar", async () => {
    const sessao = await h.entrar("auth.admin");
    const saida = await h.requisitar("POST", "/api/v1/auth/logout", { cookies: sessao.cookies, csrf: sessao.csrf });
    assert.equal(saida.status, 200);
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies })).status, 401);
  });

  it("desativar o usuário encerra o acesso no próximo request", async () => {
    await h.criarUsuario({ empresaId, login: "auth.desativado", permissoes: ["relatorios"] });
    const sessao = await h.entrar("auth.desativado");
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies })).status, 200);
    await h.sql("UPDATE app_users SET active = FALSE WHERE login = 'auth.desativado'");
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies })).status, 401);
  });

  it("remover o vínculo com a empresa também encerra o acesso", async () => {
    await h.criarUsuario({ empresaId, login: "auth.semvinculo", permissoes: ["relatorios"] });
    const sessao = await h.entrar("auth.semvinculo");
    await h.sql(
      "UPDATE company_memberships SET active = FALSE WHERE user_id = (SELECT id FROM app_users WHERE login = 'auth.semvinculo')",
    );
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies })).status, 401);
  });
});

describe("CSRF, origem e métodos HTTP", () => {
  let empresaId;
  let sessao;
  before(async () => {
    empresaId = await h.criarEmpresa("csrf-empresa");
    await h.criarEstado(empresaId);
    await h.criarUsuario({ empresaId, login: "csrf.admin", permissoes: ["combustivel", "admin"] });
    sessao = await h.entrar("csrf.admin");
  });

  it("alteração sem cabeçalho CSRF é bloqueada", async () => {
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: sessao.cookies,
      corpo: { baseRevision: 1, state: h.estadoDemo() },
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.code, "CSRF_INVALIDO");
  });

  it("alteração vinda de outra origem é bloqueada mesmo com cookie e CSRF válidos", async () => {
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: sessao.cookies,
      csrf: sessao.csrf,
      cabecalhos: { origin: "https://site-malicioso.exemplo" },
      corpo: { baseRevision: 1, state: h.estadoDemo() },
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.code, "ORIGEM_INVALIDA");
  });

  it("logout também exige CSRF", async () => {
    const r = await h.requisitar("POST", "/api/v1/auth/logout", { cookies: sessao.cookies });
    assert.equal(r.status, 403);
  });

  it("método não permitido retorna 405 com cabeçalho Allow", async () => {
    const login = await h.requisitar("GET", "/api/v1/auth/login");
    assert.equal(login.status, 405);
    assert.equal(login.headers.get("allow"), "POST");

    const workspace = await h.requisitar("DELETE", "/api/v1/workspace", { cookies: sessao.cookies, csrf: sessao.csrf });
    assert.equal(workspace.status, 405);
    assert.equal(workspace.headers.get("allow"), "GET, PUT");

    const saude = await h.requisitar("POST", "/api/v1/health");
    assert.equal(saude.status, 405);
  });

  it("rota inexistente retorna 404 em JSON", async () => {
    const r = await h.requisitar("GET", "/api/v1/nao-existe");
    assert.equal(r.status, 404);
    assert.equal(r.json.error.code, "NAO_ENCONTRADO");
  });
});

describe("estado operacional: leitura, permissões e concorrência", () => {
  let empresaId;
  let admin;
  let relatorios;
  let combustivel;
  before(async () => {
    empresaId = await h.criarEmpresa("estado-empresa");
    await h.criarEstado(empresaId);
    await h.criarUsuario({ empresaId, login: "estado.admin", permissoes: ["admin", "almoxarifado", "veiculos", "manutencao", "combustivel", "relatorios"] });
    await h.criarUsuario({ empresaId, login: "estado.relatorio", permissoes: ["relatorios"] });
    await h.criarUsuario({ empresaId, login: "estado.combustivel", permissoes: ["combustivel"] });
    admin = await h.entrar("estado.admin");
    relatorios = await h.entrar("estado.relatorio");
    combustivel = await h.entrar("estado.combustivel");
  });

  it("leitura exige sessão", async () => {
    const r = await h.requisitar("GET", "/api/v1/workspace");
    assert.equal(r.status, 401);
  });

  it("leitura devolve revisão e estado, sem usuários nem credenciais", async () => {
    const r = await h.requisitar("GET", "/api/v1/workspace", { cookies: admin.cookies });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.revision, 1);
    assert.equal("usuarios" in r.json.data.state, false);
    assert.equal(r.texto.includes("password_hash"), false);
    assert.equal(r.texto.includes("demo123"), false);
  });

  it("empresa sem estado inicializado responde 404 controlado", async () => {
    const vazia = await h.criarEmpresa("estado-vazia");
    await h.criarUsuario({ empresaId: vazia, login: "vazia.admin", permissoes: ["admin"] });
    const s = await h.entrar("vazia.admin");
    const r = await h.requisitar("GET", "/api/v1/workspace", { cookies: s.cookies });
    assert.equal(r.status, 404);
    assert.equal(r.json.error.code, "AREA_NAO_INICIALIZADA");
  });

  it("usuário sem o módulo da coleção alterada recebe 403 e nada é gravado", async () => {
    const atual = await h.requisitar("GET", "/api/v1/workspace", { cookies: relatorios.cookies });
    const estado = { ...atual.json.data.state, abastecimentos: [...atual.json.data.state.abastecimentos, novoAbastecimento("ABS-RELAT")] };
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: relatorios.cookies,
      csrf: relatorios.csrf,
      corpo: { baseRevision: atual.json.data.revision, state: estado },
    });
    assert.equal(r.status, 403);
    assert.equal(r.json.error.code, "SEM_PERMISSAO");
    const depois = await h.requisitar("GET", "/api/v1/workspace", { cookies: admin.cookies });
    assert.equal(depois.json.data.revision, atual.json.data.revision);
    assert.equal(depois.json.data.state.abastecimentos.some((a) => a.id === "ABS-RELAT"), false);
  });

  it("usuário com o módulo grava a coleção e a revisão avança", async () => {
    const atual = await h.requisitar("GET", "/api/v1/workspace", { cookies: combustivel.cookies });
    const estado = { ...atual.json.data.state, abastecimentos: [...atual.json.data.state.abastecimentos, novoAbastecimento("ABS-COMB-1")] };
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: combustivel.cookies,
      csrf: combustivel.csrf,
      corpo: { baseRevision: atual.json.data.revision, state: estado },
    });
    assert.equal(r.status, 200);
    assert.equal(r.json.data.revision, atual.json.data.revision + 1);
  });

  it("gravação com revisão antiga é recusada com 409 e informa a revisão atual", async () => {
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: combustivel.cookies,
      csrf: combustivel.csrf,
      corpo: { baseRevision: 1, state: h.estadoDemo() },
    });
    assert.equal(r.status, 409);
    assert.equal(r.json.error.code, "REVISAO_DESATUALIZADA");
    assert.ok(r.json.error.revisaoAtual >= 2);
  });

  it("gravações simultâneas com a mesma revisão: exatamente uma é aceita", async () => {
    const atual = await h.requisitar("GET", "/api/v1/workspace", { cookies: combustivel.cookies });
    const base = atual.json.data.revision;
    const tentativas = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((i) => {
        const estado = { ...atual.json.data.state, abastecimentos: [...atual.json.data.state.abastecimentos, novoAbastecimento(`ABS-CONC-${i}`)] };
        return h.requisitar("PUT", "/api/v1/workspace", {
          cookies: combustivel.cookies,
          csrf: combustivel.csrf,
          corpo: { baseRevision: base, state: estado },
        });
      }),
    );
    const aceitas = tentativas.filter((t) => t.status === 200);
    const recusadas = tentativas.filter((t) => t.status === 409);
    assert.equal(aceitas.length, 1, "somente uma gravação pode vencer a corrida");
    assert.equal(recusadas.length, 5);
    const final = await h.requisitar("GET", "/api/v1/workspace", { cookies: admin.cookies });
    assert.equal(final.json.data.revision, base + 1);
  });

  it("estoque negativo é recusado com 422 pelo servidor", async () => {
    const atual = await h.requisitar("GET", "/api/v1/workspace", { cookies: admin.cookies });
    const estado = {
      ...atual.json.data.state,
      movimentacoes: [
        ...atual.json.data.state.movimentacoes,
        {
          id: "MOV-NEG", tipo: "Saida", pecaId: atual.json.data.state.pecas[0].id, quantidade: 999999,
          valorUnitario: 1, data: "2026-10-22", veiculoId: "VEI-001", manutencaoId: null,
        },
      ],
    };
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: admin.cookies,
      csrf: admin.csrf,
      corpo: { baseRevision: atual.json.data.revision, state: estado },
    });
    assert.equal(r.status, 422);
    assert.equal(r.json.error.code, "ESTADO_INVALIDO");
    assert.match(r.json.error.message, /Saldo negativo/);
  });

  it("credenciais e usuários dentro do estado são recusados", async () => {
    const atual = await h.requisitar("GET", "/api/v1/workspace", { cookies: admin.cookies });
    const comSenha = { ...atual.json.data.state, veiculos: atual.json.data.state.veiculos.map((v, i) => (i === 0 ? { ...v, senha: "x" } : v)) };
    const r1 = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { baseRevision: atual.json.data.revision, state: comSenha },
    });
    assert.equal(r1.status, 422);

    const comUsuarios = { ...atual.json.data.state, usuarios: [{ id: "USR-1", login: "x" }] };
    const r2 = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { baseRevision: atual.json.data.revision, state: comUsuarios },
    });
    assert.equal(r2.status, 422);
  });

  it("gravação registra auditoria sem valores sensíveis e a trilha não pode ser alterada", async () => {
    const linhas = await h.sql(
      "SELECT company_id, action, metadata FROM audit_logs WHERE action = 'ESTADO_ATUALIZADO' AND company_id = (SELECT id FROM companies WHERE slug = 'estado-empresa') ORDER BY id DESC LIMIT 1",
    );
    assert.equal(linhas.length, 1);
    assert.deepEqual(linhas[0].metadata.colecoesAlteradas, ["abastecimentos"]);
    assert.equal(JSON.stringify(linhas[0].metadata).includes("senha"), false);

    await assert.rejects(h.sql("UPDATE audit_logs SET result = 'ERROR' WHERE action = 'ESTADO_ATUALIZADO'"), /append-only/);
    await assert.rejects(h.sql("DELETE FROM audit_logs WHERE action = 'ESTADO_ATUALIZADO'"), /append-only/);
  });
});

describe("isolamento entre empresas", () => {
  let empresaA;
  let empresaB;
  let usuarioA;
  let usuarioB;
  before(async () => {
    empresaA = await h.criarEmpresa("iso-a");
    empresaB = await h.criarEmpresa("iso-b");
    await h.criarEstado(empresaA, { configuracoes: { alertaTrocaOleoKm: 111, alertaTrocaOleoDias: 30 } });
    await h.criarEstado(empresaB, { configuracoes: { alertaTrocaOleoKm: 777, alertaTrocaOleoDias: 30 } });
    await h.criarUsuario({ empresaId: empresaA, login: "iso.admina", permissoes: ["admin", "combustivel"] });
    await h.criarUsuario({ empresaId: empresaB, login: "iso.adminb", permissoes: ["admin", "combustivel"] });
    usuarioA = await h.entrar("iso.admina");
    usuarioB = await h.entrar("iso.adminb");
  });

  it("cada usuário lê somente os dados da própria empresa", async () => {
    const a = await h.requisitar("GET", "/api/v1/workspace", { cookies: usuarioA.cookies });
    const b = await h.requisitar("GET", "/api/v1/workspace", { cookies: usuarioB.cookies });
    assert.equal(a.json.data.state.configuracoes.alertaTrocaOleoKm, 111);
    assert.equal(b.json.data.state.configuracoes.alertaTrocaOleoKm, 777);
  });

  it("companyId enviado no corpo é ignorado: a gravação vai para a empresa da sessão", async () => {
    const antesA = await h.sql("SELECT revision FROM fleet_workspace_state WHERE company_id = $1", [empresaA]);
    const atual = await h.requisitar("GET", "/api/v1/workspace", { cookies: usuarioB.cookies });
    const r = await h.requisitar("PUT", "/api/v1/workspace", {
      cookies: usuarioB.cookies,
      csrf: usuarioB.csrf,
      corpo: { companyId: empresaA, baseRevision: atual.json.data.revision, state: atual.json.data.state },
    });
    assert.equal(r.status, 200);
    const depoisA = await h.sql("SELECT revision FROM fleet_workspace_state WHERE company_id = $1", [empresaA]);
    assert.equal(Number(depoisA[0].revision), Number(antesA[0].revision), "empresa A não pode ser alterada pelo usuário B");
  });

  it("administrador de uma empresa não edita usuário de outra", async () => {
    const alvoDeA = (await h.sql("SELECT id FROM app_users WHERE login = 'iso.admina'"))[0].id;
    const r = await h.requisitar("PATCH", `/api/v1/users/${alvoDeA}`, {
      cookies: usuarioB.cookies,
      csrf: usuarioB.csrf,
      corpo: { nome: "Invadido" },
    });
    assert.equal(r.status, 404);
    const nome = (await h.sql("SELECT name FROM app_users WHERE id = $1", [alvoDeA]))[0].name;
    assert.equal(nome, "iso.admina", "nome original deve permanecer");
  });

  it("identificador malformado é rejeitado antes de consultar o banco", async () => {
    const r = await h.requisitar("PATCH", "/api/v1/users/1%20OR%201%3D1", {
      cookies: usuarioB.cookies,
      csrf: usuarioB.csrf,
      corpo: { nome: "x" },
    });
    assert.equal(r.status, 400);
  });
});

describe("gestão de usuários", () => {
  let empresaId;
  let admin;
  let comum;
  before(async () => {
    empresaId = await h.criarEmpresa("usuarios-empresa");
    await h.criarEstado(empresaId);
    await h.criarUsuario({ empresaId, login: "usr.admin", permissoes: ["admin", "relatorios"] });
    await h.criarUsuario({ empresaId, login: "usr.comum", permissoes: ["relatorios"] });
    admin = await h.entrar("usr.admin");
    comum = await h.entrar("usr.comum");
  });

  it("usuário sem o módulo admin não lista nem cria usuários", async () => {
    assert.equal((await h.requisitar("GET", "/api/v1/users", { cookies: comum.cookies })).status, 403);
    const r = await h.requisitar("POST", "/api/v1/users", {
      cookies: comum.cookies, csrf: comum.csrf,
      corpo: { login: "novo.user", nome: "Novo Usuário", cargo: "Teste", senha: "senha-forte-123", permissoes: [] },
    });
    assert.equal(r.status, 403);
  });

  it("administrador cria usuário; a resposta não contém senha ou hash", async () => {
    const r = await h.requisitar("POST", "/api/v1/users", {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { login: "Novo.Operador", nome: "Novo Operador", cargo: "Almoxarife", senha: "senha-forte-123", permissoes: ["almoxarifado"] },
    });
    assert.equal(r.status, 201);
    assert.equal(r.json.data.login, "novo.operador");
    assert.equal(r.texto.includes("senha-forte-123"), false);
    assert.equal(r.texto.includes("scrypt$"), false);

    const novo = await h.entrar("novo.operador");
    const ws = await h.requisitar("GET", "/api/v1/workspace", { cookies: novo.cookies });
    assert.equal(ws.status, 200, "usuário criado com módulo consegue entrar");
  });

  it("login duplicado retorna 409 e permissão inválida retorna 422", async () => {
    const dup = await h.requisitar("POST", "/api/v1/users", {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { login: "novo.operador", nome: "Outro Nome", cargo: "Teste", senha: "senha-forte-123", permissoes: [] },
    });
    assert.equal(dup.status, 409);
    assert.equal(dup.json.error.code, "LOGIN_EXISTENTE");

    const invalido = await h.requisitar("POST", "/api/v1/users", {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { login: "outro.user", nome: "Outro Nome", cargo: "Teste", senha: "senha-forte-123", permissoes: ["superadmin"] },
    });
    assert.equal(invalido.status, 422);
  });

  it("administrador não pode alterar as próprias permissões nem desativar a si mesmo", async () => {
    const meuId = (await h.sql("SELECT id FROM app_users WHERE login = 'usr.admin'"))[0].id;
    const semAdmin = await h.requisitar("PATCH", `/api/v1/users/${meuId}`, {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { permissoes: ["relatorios"] },
    });
    assert.equal(semAdmin.status, 422);
    assert.equal(semAdmin.json.error.code, "NAO_PODE_ALTERAR_PROPRIO_ACESSO");

    const desativar = await h.requisitar("PATCH", `/api/v1/users/${meuId}`, {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { ativo: false },
    });
    assert.equal(desativar.status, 422);
  });

  it("alterar permissões passa a valer no próximo request, sem novo login", async () => {
    const alvo = (await h.sql("SELECT id FROM app_users WHERE login = 'usr.comum'"))[0].id;
    const antes = await h.requisitar("GET", "/api/v1/workspace", { cookies: comum.cookies });
    assert.equal(antes.status, 200);

    const sem = await h.requisitar("PATCH", `/api/v1/users/${alvo}`, {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { permissoes: [] },
    });
    assert.equal(sem.status, 200);
    const ws = await h.requisitar("GET", "/api/v1/workspace", { cookies: comum.cookies });
    assert.equal(ws.status, 403, "sem módulo algum o usuário não lê os dados da empresa");
  });

  it("trocar a senha de um usuário revoga as sessões dele", async () => {
    const alvo = (await h.sql("SELECT id FROM app_users WHERE login = 'usr.comum'"))[0].id;
    await h.sql("UPDATE company_memberships SET permissions = '{relatorios}' WHERE user_id = $1", [alvo]);
    const sessaoAntiga = await h.entrar("usr.comum");
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessaoAntiga.cookies })).status, 200);

    const r = await h.requisitar("PATCH", `/api/v1/users/${alvo}`, {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { senha: "nova-senha-forte-2" },
    });
    assert.equal(r.status, 200);
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessaoAntiga.cookies })).status, 401);
    const novoLogin = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "usr.comum", senha: "nova-senha-forte-2" } });
    assert.equal(novoLogin.status, 200);
  });

  it("desativar usuário impede novo login e encerra sessões existentes", async () => {
    const alvo = (await h.sql("SELECT id FROM app_users WHERE login = 'usr.comum'"))[0].id;
    const sessao = await h.entrar("usr.comum", "nova-senha-forte-2");
    const r = await h.requisitar("PATCH", `/api/v1/users/${alvo}`, {
      cookies: admin.cookies, csrf: admin.csrf,
      corpo: { ativo: false },
    });
    assert.equal(r.status, 200);
    assert.equal((await h.requisitar("GET", "/api/v1/auth/session", { cookies: sessao.cookies })).status, 401);
    const tentativa = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "usr.comum", senha: "nova-senha-forte-2" } });
    assert.equal(tentativa.status, 401);
  });
});

describe("concorrência na administração de usuários", () => {
  it("duas tentativas simultâneas de rebaixar os dois administradores não deixam a empresa sem administrador", async () => {
    const empresaId = await h.criarEmpresa("admin-race-empresa");
    await h.criarEstado(empresaId);
    await h.criarUsuario({ empresaId, login: "race.admina", permissoes: ["admin", "relatorios"] });
    await h.criarUsuario({ empresaId, login: "race.adminb", permissoes: ["admin", "relatorios"] });
    const adminA = await h.entrar("race.admina");
    const adminB = await h.entrar("race.adminb");
    const idA = (await h.sql("SELECT id FROM app_users WHERE login = 'race.admina'"))[0].id;
    const idB = (await h.sql("SELECT id FROM app_users WHERE login = 'race.adminb'"))[0].id;

    const resultados = await Promise.all([
      h.requisitar("PATCH", `/api/v1/users/${idB}`, {
        cookies: adminA.cookies,
        csrf: adminA.csrf,
        corpo: { permissoes: ["relatorios"] },
      }),
      h.requisitar("PATCH", `/api/v1/users/${idA}`, {
        cookies: adminB.cookies,
        csrf: adminB.csrf,
        corpo: { permissoes: ["relatorios"] },
      }),
    ]);

    assert.equal(resultados.filter((r) => r.status === 200).length, 1,
      "somente uma das duas alterações pode remover o último administrador");
    assert.ok(resultados.some((r) => r.status === 422 || r.status === 403),
      "a segunda alteração deve ser bloqueada pela regra de administrador ou pela autorização atual");

    const ativos = await h.sql(
      `SELECT COUNT(*)::int AS total
         FROM company_memberships m
         JOIN app_users u ON u.id = m.user_id
        WHERE m.company_id = $1
          AND m.active = TRUE AND u.active = TRUE
          AND 'admin' = ANY(m.permissions)`,
      [empresaId],
    );
    assert.ok(ativos[0].total >= 1, "a empresa deve manter pelo menos um administrador ativo");
  });
});

describe("falhas do banco", () => {
  it("indisponibilidade do banco responde 503 sem expor host, porta ou mensagem interna", async () => {
    const original = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://usuario:senha@127.0.0.1:1/inexistente";
    try {
      const saude = await h.requisitar("GET", "/api/v1/health");
      assert.equal(saude.status, 503);
      assert.equal(saude.json.database, "unavailable");

      const login = await h.requisitar("POST", "/api/v1/auth/login", { corpo: { login: "admin", senha: "senha-forte-123" } });
      assert.equal(login.status, 503);
      assert.equal(login.json.error.code, "BANCO_INDISPONIVEL");
      assert.equal(login.texto.includes("127.0.0.1"), false);
      assert.equal(login.texto.includes("senha"), false);
    } finally {
      process.env.DATABASE_URL = original;
    }
  });

  it("health confirma a conexão quando o banco responde", async () => {
    const saude = await h.requisitar("GET", "/api/v1/health");
    assert.equal(saude.status, 200);
    assert.deepEqual(saude.json, { ok: true, service: "fleet-demo-api", database: "connected", configuracao: "ok" });
  });
});
