"use strict";

/*
 * GET /api/v1/auth/session
 *
 * Informa à interface quem está logado, em qual empresa e com quais módulos.
 * A interface usa esta resposta apenas para exibição: cada rota protegida valida
 * a sessão e as permissões de novo no servidor.
 */

const { comErros, exigirMetodo, enviarDados } = require("../../../lib/http");
const { exigirSessao, garantirCookieCsrf } = require("../../../lib/auth");

async function handler(req, res) {
  exigirMetodo(req, ["GET"]);
  const sessao = await exigirSessao(req);
  garantirCookieCsrf(req, res);
  enviarDados(res, 200, {
    usuario: sessao.usuario,
    empresa: sessao.empresa,
    permissoes: sessao.permissoes,
    expiraEm: sessao.expiresAt,
  });
}

module.exports = comErros(handler);
