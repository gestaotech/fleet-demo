"use strict";

/*
 * Acesso ao PostgreSQL (Neon em produção).
 *
 * - Em hosts *.neon.tech usa @neondatabase/serverless (HTTP, adequado a funções
 *   serverless: sem conexões persistentes entre invocações).
 * - Em outros hosts (PostgreSQL local de desenvolvimento e testes) usa o driver pg.
 * - A string de conexão vem somente de process.env.DATABASE_URL e nunca é
 *   retornada, registrada ou incluída em mensagens de erro.
 * - Todas as consultas são parametrizadas: nenhum valor do cliente é concatenado em SQL.
 * - Não há transações interativas: operações que exigem atomicidade usam uma
 *   única instrução SQL com CTEs (ver lib/workspace.js e api/v1/users).
 */

const { ApiError } = require("./errors");

let cache = null;

const CODIGOS_INDISPONIBILIDADE = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EPIPE",
  "57P01",
  "57P02",
  "57P03",
  "53300",
]);

function ehIndisponibilidade(erro) {
  if (!erro) return false;
  if (CODIGOS_INDISPONIBILIDADE.has(erro.code)) return true;
  if (typeof erro.code === "string" && erro.code.startsWith("08")) return true;
  // Falhas de rede do driver HTTP do Neon aparecem como TypeError de fetch.
  return erro instanceof TypeError && /fetch failed/i.test(erro.message);
}

function criarConsulta(url) {
  const host = new URL(url).hostname;
  if (/\.neon\.tech$/i.test(host)) {
    const { neon } = require("@neondatabase/serverless");
    const sql = neon(url);
    return (texto, parametros) => sql.query(texto, parametros);
  }
  const { Pool } = require("pg");
  const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10000 });
  return async (texto, parametros) => {
    const resultado = await pool.query(texto, parametros);
    return resultado.rows;
  };
}

function obterConsulta() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new ApiError(503, "BANCO_NAO_CONFIGURADO", "Serviço temporariamente indisponível.");
  }
  if (!cache || cache.url !== url) {
    cache = { url, consulta: criarConsulta(url) };
  }
  return cache.consulta;
}

/*
 * Executa uma consulta parametrizada e devolve as linhas.
 * Falhas de conexão viram ApiError 503 sem detalhes; erros de SQL viram 500 genérico,
 * mantendo apenas o código SQLSTATE para que o chamador trate violações (ex.: 23505).
 */
async function consultar(texto, parametros = []) {
  try {
    return await obterConsulta()(texto, parametros);
  } catch (erro) {
    if (erro instanceof ApiError) throw erro;
    if (ehIndisponibilidade(erro)) {
      throw new ApiError(503, "BANCO_INDISPONIVEL", "Serviço temporariamente indisponível. Tente novamente.");
    }
    const erroSql = new ApiError(500, "BANCO_ERRO", "Não foi possível concluir a operação.");
    erroSql.pgCode = typeof erro.code === "string" ? erro.code : null;
    throw erroSql;
  }
}

async function verificarBanco() {
  await consultar("SELECT 1 AS ok");
  return true;
}

module.exports = { consultar, verificarBanco, ehIndisponibilidade };
