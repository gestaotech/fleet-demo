"use strict";

/*
 * POST /api/v1/auth/reautenticar -> confirma a senha do administrador logado e libera
 * ajustes de estoque nesta sessão por 5 minutos. Corpo: { senha }.
 *
 * Somente usuários com o módulo "admin". A senha é verificada no servidor com o hash do
 * banco e nunca é gravada. Tentativas erradas contam no limite por sessão (lib/rate-limit.js).
 */

const { ApiError } = require("../../../lib/errors");
const { consultar } = require("../../../lib/db");
const {
  comErros,
  exigirMetodo,
  protegerAlteracao,
  lerCorpoJson,
  enviarDados,
  hashIp,
  userAgent,
} = require("../../../lib/http");
const { exigirSessao, exigirPermissao } = require("../../../lib/auth");
const { verifyPassword, hashComSal } = require("../../../lib/security");
const { estaBloqueado, registrarFalhas } = require("../../../lib/rate-limit");
const { registrarAuditoria } = require("../../../lib/audit");

const JANELA_MINUTOS = 5;

const SQL_SENHA = "SELECT password_hash FROM app_users WHERE id = $1::uuid AND active = TRUE";

const SQL_LIBERAR = `
  UPDATE app_sessions
     SET reauth_ate = NOW() + make_interval(mins => $2::int)
   WHERE id = $1::uuid
  RETURNING reauth_ate`;

async function handler(req, res) {
  exigirMetodo(req, ["POST"]);
  protegerAlteracao(req);
  const sessao = await exigirSessao(req);
  exigirPermissao(sessao, "admin");

  const corpo = await lerCorpoJson(req, 8 * 1024);
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  if (!senha) throw new ApiError(400, "DADOS_INVALIDOS", "Informe a senha.");

  const chaves = [{ chave: `reauth:${hashComSal(sessao.sessaoId)}`, limite: 5 }];
  if (await estaBloqueado(chaves)) {
    throw new ApiError(429, "MUITAS_TENTATIVAS", "Muitas tentativas de confirmação. Aguarde alguns minutos.");
  }

  const linhas = await consultar(SQL_SENHA, [sessao.usuario.id], { leitura: true });
  const confere = linhas[0] ? verifyPassword(senha, linhas[0].password_hash) : false;
  if (!confere) {
    await registrarFalhas(chaves);
    throw new ApiError(403, "SENHA_INCORRETA", "Senha incorreta.");
  }

  const liberado = await consultar(SQL_LIBERAR, [sessao.sessaoId, JANELA_MINUTOS]);
  await registrarAuditoria({
    acao: "REAUTENTICACAO_ADMIN",
    entidade: "app_sessions",
    entidadeId: sessao.sessaoId,
    resultado: "SUCCESS",
    usuarioId: sessao.usuario.id,
    empresaId: sessao.empresa.id,
    ipHash: hashIp(req),
    userAgent: userAgent(req),
  });

  enviarDados(res, 200, { reautenticadoAte: liberado[0].reauth_ate });
}

module.exports = comErros(handler);
