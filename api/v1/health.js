"use strict";

/*
 * GET /api/v1/health
 *
 * Verifica se a função responde e se o banco aceita uma consulta simples.
 * Não retorna URL, host, usuário, mensagem de erro ou detalhes internos.
 */

const { exigirMetodo, comErros, enviarJson } = require("../../lib/http");
const { verificarBanco } = require("../../lib/db");

async function handler(req, res) {
  exigirMetodo(req, ["GET"]);

  if (!process.env.DATABASE_URL) {
    return enviarJson(res, 503, { ok: false, service: "fleet-demo-api", database: "not_configured" });
  }

  try {
    await verificarBanco();
  } catch {
    // Qualquer falha do banco vira "unavailable", sem detalhar a causa.
    return enviarJson(res, 503, { ok: false, service: "fleet-demo-api", database: "unavailable" });
  }

  return enviarJson(res, 200, { ok: true, service: "fleet-demo-api", database: "connected" });
}

module.exports = comErros(handler);
