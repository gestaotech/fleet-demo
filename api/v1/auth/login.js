"use strict";

/*
 * POST /api/v1/auth/login
 *
 * Corpo: { "login": "admin", "senha": "..." }
 *
 * Respostas:
 *  200 { data: { usuario, empresa, permissoes } } + cookies de sessão e CSRF
 *  400 DADOS_INVALIDOS / JSON_INVALIDO
 *  401 CREDENCIAIS_INVALIDAS (mesma mensagem para usuário inexistente, senha errada,
 *      usuário inativo ou sem empresa ativa, para não revelar quais logins existem)
 *  403 ORIGEM_INVALIDA
 *  429 MUITAS_TENTATIVAS (limite por IP ou por login, ver lib/rate-limit.js)
 *  503 BANCO_INDISPONIVEL
 */

const { ApiError } = require("../../../lib/errors");
const { consultar } = require("../../../lib/db");
const {
  comErros,
  exigirMetodo,
  exigirMesmaOrigem,
  lerCorpoJson,
  definirCookie,
  enviarDados,
  ipDoCliente,
  hashIp,
  userAgent,
  COOKIE_SESSAO,
  COOKIE_CSRF,
} = require("../../../lib/http");
const { verifyPassword, verificarSenhaFicticia, gerarToken } = require("../../../lib/security");
const { criarSessao, ttlHoras, removerSessoesAntigas } = require("../../../lib/sessions");
const { chavesDeLogin, estaBloqueado, registrarFalhas, limparFalhasDoLogin, removerTentativasAntigas } = require("../../../lib/rate-limit");
const { registrarAuditoria } = require("../../../lib/audit");

const LOGIN_FORMATO = /^[a-z0-9._-]{3,20}$/;

const MENSAGEM_CREDENCIAIS = "Usuário ou senha inválidos.";

async function falhaDeLogin(chaves, evento) {
  await registrarFalhas(chaves);
  await registrarAuditoria({
    acao: "LOGIN_FALHOU",
    entidade: "auth",
    resultado: "DENIED",
    usuarioId: evento.usuarioId,
    empresaId: evento.empresaId,
    metadados: { motivo: evento.motivo },
    ipHash: evento.ipHash,
    userAgent: evento.userAgent,
  });
  return new ApiError(401, "CREDENCIAIS_INVALIDAS", MENSAGEM_CREDENCIAIS);
}

async function handler(req, res) {
  exigirMetodo(req, ["POST"]);
  exigirMesmaOrigem(req);

  const corpo = await lerCorpoJson(req, 4096);
  const login = typeof corpo.login === "string" ? corpo.login.trim().toLowerCase() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  if (!LOGIN_FORMATO.test(login) || senha.length < 1 || senha.length > 200) {
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe usuário e senha.");
  }

  const ipHash = hashIp(req);
  const ua = userAgent(req);
  const chaves = chavesDeLogin(ipDoCliente(req), login);

  if (await estaBloqueado(chaves)) {
    throw new ApiError(429, "MUITAS_TENTATIVAS", "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.");
  }

  const usuarios = await consultar(
    "SELECT id, login, name, cargo, password_hash, active FROM app_users WHERE login = $1",
    [login],
    { leitura: true },
  );
  const usuario = usuarios[0];

  // Mesmo tempo de resposta quando o usuário não existe (evita enumeração por tempo).
  const senhaConfere = usuario ? verifyPassword(senha, usuario.password_hash) : verificarSenhaFicticia(senha);

  if (!usuario) throw await falhaDeLogin(chaves, { motivo: "usuario_inexistente", ipHash, userAgent: ua });
  if (!senhaConfere) {
    throw await falhaDeLogin(chaves, { usuarioId: usuario.id, motivo: "senha_invalida", ipHash, userAgent: ua });
  }
  if (!usuario.active) {
    throw await falhaDeLogin(chaves, { usuarioId: usuario.id, motivo: "usuario_inativo", ipHash, userAgent: ua });
  }

  const vinculos = await consultar(
    `SELECT m.company_id, c.name AS empresa_nome, m.permissions
       FROM company_memberships m
       JOIN companies c ON c.id = m.company_id
      WHERE m.user_id = $1 AND m.active = TRUE AND c.active = TRUE
      ORDER BY m.created_at, m.company_id
      LIMIT 1`,
    [usuario.id],
  );
  const vinculo = vinculos[0];
  if (!vinculo) {
    throw await falhaDeLogin(chaves, { usuarioId: usuario.id, motivo: "sem_empresa_ativa", ipHash, userAgent: ua });
  }

  const sessao = await criarSessao({
    usuarioId: usuario.id,
    empresaId: vinculo.company_id,
    ipHash,
    userAgent: ua,
  });

  await limparFalhasDoLogin(login);
  await consultar("UPDATE app_users SET last_login_at = NOW() WHERE id = $1", [usuario.id]);
  // Limpeza de registros antigos: sessões expiradas e tentativas fora da janela.
  // Falhas aqui não devem impedir o login, por isso são isoladas.
  await Promise.allSettled([removerSessoesAntigas(), removerTentativasAntigas()]);
  await registrarAuditoria({
    acao: "LOGIN",
    entidade: "auth",
    resultado: "SUCCESS",
    usuarioId: usuario.id,
    empresaId: vinculo.company_id,
    ipHash,
    userAgent: ua,
  });

  const maxAge = ttlHoras() * 3600;
  definirCookie(res, COOKIE_SESSAO, sessao.token, { maxAge, httpOnly: true, sameSite: "Lax" });
  // Token CSRF legível pela interface: a interface o envia no cabeçalho X-CSRF-Token.
  definirCookie(res, COOKIE_CSRF, gerarToken(), { maxAge, sameSite: "Lax" });

  enviarDados(res, 200, {
    usuario: { id: usuario.id, login: usuario.login, nome: usuario.name, cargo: usuario.cargo },
    empresa: { id: vinculo.company_id, nome: vinculo.empresa_nome },
    permissoes: Array.isArray(vinculo.permissions) ? vinculo.permissions : [],
    expiraEm: sessao.expiresAt,
  });
}

module.exports = comErros(handler);
