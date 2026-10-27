"use strict";

/*
 * Trilha de auditoria.
 *
 * Registra login, logout, falhas de login, criação e alteração de usuários,
 * alterações do estado operacional e mudanças de permissão.
 *
 * - A tabela audit_logs é append-only: um gatilho no banco bloqueia UPDATE e DELETE
 *   (migração 002). Não existe rota de alteração ou exclusão.
 * - Os metadados passam por sanitização: chaves com senha, token, cookie, hash ou
 *   segredo são removidas, e textos são limitados em tamanho.
 * - Operações que precisam de atomicidade gravam a auditoria dentro da mesma
 *   instrução SQL (CTE), para que operação e registro existam juntos ou não existam.
 */

const { consultar } = require("./db");

const CHAVES_PROIBIDAS = /senha|password|token|secret|cookie|hash|authorization|credencial|csrf/i;
const TAMANHO_MAXIMO_TEXTO = 200;

function sanitizarMetadados(metadados) {
  if (!metadados || typeof metadados !== "object") return null;
  const limpo = {};
  for (const [chave, valor] of Object.entries(metadados)) {
    if (CHAVES_PROIBIDAS.test(chave)) continue;
    if (typeof valor === "string") {
      limpo[chave] = valor.slice(0, TAMANHO_MAXIMO_TEXTO);
    } else if (typeof valor === "number" || typeof valor === "boolean" || valor === null) {
      limpo[chave] = valor;
    } else if (Array.isArray(valor)) {
      limpo[chave] = valor.slice(0, 50).map((item) => (typeof item === "string" ? item.slice(0, TAMANHO_MAXIMO_TEXTO) : item));
    }
  }
  return Object.keys(limpo).length ? limpo : null;
}

/* Parâmetros da auditoria, na ordem esperada pelas consultas (ver registrarAuditoria). */
function parametrosAuditoria(evento) {
  return [
    evento.empresaId || null,
    evento.usuarioId || null,
    evento.acao,
    evento.entidade,
    evento.entidadeId ? String(evento.entidadeId) : null,
    evento.resultado,
    JSON.stringify(sanitizarMetadados(evento.metadados)),
    evento.ipHash || null,
    evento.userAgent ? String(evento.userAgent).slice(0, 255) : null,
  ];
}

const SQL_INSERIR_AUDITORIA = `INSERT INTO audit_logs
  (company_id, actor_user_id, action, entity, entity_id, result, metadata, ip_hash, user_agent)
  VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`;

async function registrarAuditoria(evento) {
  await consultar(SQL_INSERIR_AUDITORIA, parametrosAuditoria(evento));
}

module.exports = {
  sanitizarMetadados,
  parametrosAuditoria,
  SQL_INSERIR_AUDITORIA,
  registrarAuditoria,
};
