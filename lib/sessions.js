"use strict";

/*
 * Sessões no servidor.
 *
 * O navegador recebe um token aleatório em cookie HttpOnly. O banco guarda somente
 * o SHA-256 desse token (app_sessions.token_hash): vazamento do banco não permite
 * montar cookies válidos. Revogação é imediata (revoked_at), e a expiração é
 * verificada a cada requisição.
 *
 * A validade de uma sessão exige, no momento da consulta: sessão não revogada e não
 * expirada, usuário ativo, vínculo ativo com a empresa e empresa ativa. Desativar um
 * usuário ou vínculo encerra o acesso no próximo request, sem esperar a expiração.
 */

const { consultar } = require("./db");
const { gerarToken, sha256 } = require("./security");

const INTERVALO_ULTIMO_ACESSO_MIN = 5;

function ttlHoras() {
  const valor = Number(process.env.SESSION_TTL_HOURS || 8);
  if (!Number.isInteger(valor) || valor < 1 || valor > 720) return 8;
  return valor;
}

async function criarSessao({ usuarioId, empresaId, ipHash, userAgent }) {
  const token = gerarToken();
  const horas = ttlHoras();
  const linhas = await consultar(
    `INSERT INTO app_sessions (user_id, company_id, token_hash, expires_at, ip_hash, user_agent)
     VALUES ($1, $2, $3, NOW() + make_interval(hours => $4), $5, $6)
     RETURNING expires_at`,
    [usuarioId, empresaId, sha256(token), horas, ipHash, userAgent],
  );
  return {
    token,
    expiresAt: linhas[0].expires_at,
    maxAgeSegundos: horas * 3600,
  };
}

/*
 * Carrega a sessão a partir do token do cookie. Devolve null quando a sessão não é
 * mais válida por qualquer motivo, sem revelar qual deles ocorreu.
 */
async function carregarSessao(token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 200) return null;

  const linhas = await consultar(
    `SELECT s.id AS sessao_id, s.expires_at,
            u.id AS usuario_id, u.login, u.name, u.cargo, u.active AS usuario_ativo,
            c.id AS empresa_id, c.name AS empresa_nome, c.active AS empresa_ativa,
            m.active AS vinculo_ativo, m.permissions
       FROM app_sessions s
       JOIN app_users u ON u.id = s.user_id
       LEFT JOIN companies c ON c.id = s.company_id
       LEFT JOIN company_memberships m ON m.user_id = s.user_id AND m.company_id = s.company_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()`,
    [sha256(token)],
    { leitura: true },
  );
  const linha = linhas[0];
  if (!linha) return null;
  if (!linha.usuario_ativo || !linha.empresa_id || !linha.empresa_ativa || !linha.vinculo_ativo) {
    return null;
  }

  await consultar(
    `UPDATE app_sessions SET last_seen_at = NOW()
      WHERE id = $1 AND last_seen_at < NOW() - make_interval(mins => $2)`,
    [linha.sessao_id, INTERVALO_ULTIMO_ACESSO_MIN],
  );

  return {
    sessaoId: linha.sessao_id,
    expiresAt: linha.expires_at,
    usuario: { id: linha.usuario_id, login: linha.login, nome: linha.name, cargo: linha.cargo },
    empresa: { id: linha.empresa_id, nome: linha.empresa_nome },
    permissoes: Array.isArray(linha.permissions) ? linha.permissions : [],
  };
}

/*
 * Remove sessões expiradas ou revogadas há mais de 30 dias. Sessões válidas e as revogadas
 * recentemente ficam, para permitir auditoria. Executado a cada login bem-sucedido.
 */
async function removerSessoesAntigas() {
  await consultar(
    `DELETE FROM app_sessions
      WHERE expires_at < NOW() - make_interval(days => 30)
         OR (revoked_at IS NOT NULL AND revoked_at < NOW() - make_interval(days => 30))`,
  );
}

async function revogarSessao(token) {
  if (typeof token !== "string" || !token) return;
  await consultar(
    "UPDATE app_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL",
    [sha256(token)],
  );
}

async function revogarSessoesDoUsuario(usuarioId) {
  await consultar(
    "UPDATE app_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL",
    [usuarioId],
  );
}

module.exports = {
  ttlHoras,
  criarSessao,
  carregarSessao,
  revogarSessao,
  revogarSessoesDoUsuario,
  removerSessoesAntigas,
};
