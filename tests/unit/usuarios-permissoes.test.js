"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const {
  validarNovoUsuario,
  validarEdicao,
  validarAdministradorRestante,
  validarIdentificador,
} = require("../../lib/users");
const { MODULOS, COLECAO_MODULO, paraArrayPg, temPermissao } = require("../../lib/permissions");

function erroDe(fn) {
  try {
    fn();
    return null;
  } catch (erro) {
    return erro;
  }
}

const novo = {
  login: "Juliana.Prado",
  nome: "Juliana Prado",
  cargo: "Auxiliar Administrativo",
  senha: "senha-forte-123",
  permissoes: ["almoxarifado"],
};

test("criação normaliza o login para minúsculas e mantém as regras da demonstração", () => {
  const dados = validarNovoUsuario(novo);
  assert.equal(dados.login, "juliana.prado");
  assert.deepEqual(dados.permissoes, ["almoxarifado"]);
  assert.equal(dados.ativo, true);
});

test("criação recusa login inválido, senha fraca e permissão desconhecida", () => {
  assert.equal(erroDe(() => validarNovoUsuario({ ...novo, login: "ab" })).status, 422);
  assert.equal(erroDe(() => validarNovoUsuario({ ...novo, login: "com espaco" })).status, 422);
  assert.match(erroDe(() => validarNovoUsuario({ ...novo, senha: "curta" })).message, /pelo menos 10/);
  assert.match(erroDe(() => validarNovoUsuario({ ...novo, permissoes: ["superadmin"] })).message, /Permissões inválidas/);
});

test("edição mantém campos não informados e aplica senha só quando enviada", () => {
  const atual = { nome: "Ana", cargo: "Gerente", permissoes: ["relatorios"], ativo: true };
  const sem = validarEdicao({ cargo: "Diretora" }, atual);
  assert.equal(sem.final.nome, "Ana");
  assert.equal(sem.final.cargo, "Diretora");
  assert.equal(sem.senha, null);
  assert.deepEqual(sem.camposAlterados, ["cargo"]);

  const comSenha = validarEdicao({ senha: "outra-senha-forte" }, atual);
  assert.equal(comSenha.senha, "outra-senha-forte");
  assert.deepEqual(comSenha.camposAlterados, ["senha"]);
});

test("último administrador ativo não pode ser removido", () => {
  const perdeuAdmin = { ativo: true, permissoes: ["relatorios"] };
  assert.equal(erroDe(() => validarAdministradorRestante(perdeuAdmin, true, 0)).code, "ULTIMO_ADMINISTRADOR");
  assert.equal(erroDe(() => validarAdministradorRestante(perdeuAdmin, true, 1)), null);
  assert.equal(erroDe(() => validarAdministradorRestante({ ativo: false, permissoes: ["admin"] }, true, 0)).code, "ULTIMO_ADMINISTRADOR");
});

test("identificadores de usuário precisam ser UUID", () => {
  assert.equal(validarIdentificador("71cd8b39-d745-44f2-a335-d31177d16c54"), "71cd8b39-d745-44f2-a335-d31177d16c54");
  assert.equal(erroDe(() => validarIdentificador("1 OR 1=1")).status, 400);
  assert.equal(erroDe(() => validarIdentificador(undefined)).status, 400);
});

test("cada coleção do estado pertence a um módulo válido", () => {
  for (const [colecao, modulo] of Object.entries(COLECAO_MODULO)) {
    assert.ok(MODULOS.includes(modulo), `${colecao} aponta para módulo desconhecido: ${modulo}`);
  }
  assert.equal(COLECAO_MODULO.usuarios, undefined, "usuários não fazem parte do estado");
});

test("array de permissões é serializado como literal do PostgreSQL e rejeita valores estranhos", () => {
  assert.equal(paraArrayPg(["admin", "relatorios", "admin"]), "{admin,relatorios}");
  assert.throws(() => paraArrayPg(["admin}; DROP TABLE x;--"]));
  assert.equal(temPermissao(["veiculos"], "veiculos"), true);
  assert.equal(temPermissao(["veiculos"], "admin"), false);
});

test("seed recusa rodar em produção e sem confirmação explícita, antes de tocar no banco", () => {
  const script = path.join(__dirname, "..", "..", "scripts", "seed.js");
  const base = { ...process.env, DATABASE_URL: "postgresql://nao-usado:x@127.0.0.1:1/x" };

  const producao = spawnSync(process.execPath, [script], {
    env: { ...base, NODE_ENV: "production", ALLOW_SEED: "true", SEED_ADMIN_PASSWORD: "senha-forte-123" },
    encoding: "utf8",
  });
  assert.equal(producao.status, 1);
  assert.match(producao.stderr, /bloqueado em ambiente de produção/);

  const semConfirmacao = spawnSync(process.execPath, [script], {
    env: { ...base, NODE_ENV: "development", ALLOW_SEED: "false", SEED_ADMIN_PASSWORD: "senha-forte-123" },
    encoding: "utf8",
  });
  assert.equal(semConfirmacao.status, 1);
  assert.match(semConfirmacao.stderr, /ALLOW_SEED=true/);
});
