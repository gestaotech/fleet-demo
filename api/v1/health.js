"use strict";

/*
 * GET /api/v1/health
 *
 * Verifica se a função responde, se o banco aceita uma consulta simples e se a
 * configuração obrigatória de produção está presente. Não retorna URL, host, nome de
 * variável, usuário, mensagem de erro ou detalhes internos.
 */

const { exigirMetodo, comErros, enviarJson } = require("../../lib/http");
const { verificarBanco } = require("../../lib/db");
const { configuracaoProducaoCompleta } = require("../../lib/security");

async function handler(req, res) {
  exigirMetodo(req, ["GET"]);

  const configuracao = configuracaoProducaoCompleta() ? "ok" : "incompleta";
  if (!process.env.DATABASE_URL) {
    return enviarJson(res, 503, { ok: false, service: "fleet-demo-api", database: "not_configured", configuracao });
  }

  try {
    await verificarBanco();
  } catch {
    // Qualquer falha do banco vira "unavailable", sem detalhar a causa.
    return enviarJson(res, 503, { ok: false, service: "fleet-demo-api", database: "unavailable", configuracao });
  }

  if (configuracao !== "ok") {
    return enviarJson(res, 503, { ok: false, service: "fleet-demo-api", database: "connected", configuracao });
  }
  return enviarJson(res, 200, { ok: true, service: "fleet-demo-api", database: "connected", configuracao });
}

module.exports = comErros(handler);
