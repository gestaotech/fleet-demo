"use strict";

/*
 * POST /api/v1/auth/logout
 *
 * Revoga a sessão no banco (efeito imediato, mesmo que o cookie tenha sido copiado)
 * e remove os cookies do navegador. Exige CSRF porque altera estado.
 * Sem sessão válida, a resposta ainda é 200: o objetivo é deixar o navegador deslogado.
 */

const { comErros, exigirMetodo, protegerAlteracao, lerCookies, limparCookie, enviarDados, userAgent, hashIp, COOKIE_SESSAO, COOKIE_CSRF } = require("../../../lib/http");
const { carregarSessao, revogarSessao } = require("../../../lib/sessions");
const { registrarAuditoria } = require("../../../lib/audit");

async function handler(req, res) {
  exigirMetodo(req, ["POST"]);
  protegerAlteracao(req);

  const token = lerCookies(req)[COOKIE_SESSAO];
  const sessao = token ? await carregarSessao(token) : null;
  if (token) await revogarSessao(token);
  if (sessao) {
    await registrarAuditoria({
      acao: "LOGOUT",
      entidade: "auth",
      resultado: "SUCCESS",
      usuarioId: sessao.usuario.id,
      empresaId: sessao.empresa.id,
      ipHash: hashIp(req),
      userAgent: userAgent(req),
    });
  }

  limparCookie(res, COOKIE_SESSAO, { httpOnly: true, sameSite: "Lax" });
  limparCookie(res, COOKIE_CSRF, { sameSite: "Lax" });
  enviarDados(res, 200, { encerrada: true });
}

module.exports = comErros(handler);
