"use strict";

/*
 * POST /api/v1/setup/admin
 *
 * Bootstrap de primeiro acesso, temporário:
 * - exige ADMIN_BOOTSTRAP_TOKEN configurado no servidor (mínimo 32 caracteres);
 * - cria administrador apenas se app_users estiver completamente vazia;
 * - a senha é hasheada no servidor com a mesma função usada pelo login;
 * - uma trava PostgreSQL evita duas inicializações simultâneas;
 * - depois do primeiro usuário, o endpoint não cria nem altera usuários.
 *
 * Após o uso, remova ADMIN_BOOTSTRAP_TOKEN da Vercel e retire setup-admin.html
 * do build/publicado. Não grave tokens ou senhas no repositório.
 */

const crypto = require("node:crypto");
const { ApiError } = require("../../../lib/errors");
const { consultar } = require("../../../lib/db");
const {
  comErros,
  exigirMetodo,
  exigirMesmaOrigem,
  lerCorpoJson,
  enviarDados,
} = require("../../../lib/http");
const { hashPassword, validarPoliticaSenha } = require("../../../lib/security");
const { MODULOS, paraArrayPg } = require("../../../lib/permissions");

const LOGIN_FORMATO = /^[a-z0-9._-]{3,20}$/;
const SLUG_FORMATO = /^[a-z0-9-]{3,60}$/;

function tokenValido(recebido, esperado) {
  if (typeof recebido !== "string" || typeof esperado !== "string") return false;
  if (esperado.length < 32) return false;
  const a = Buffer.from(recebido, "utf8");
  const b = Buffer.from(esperado, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function handler(req, res) {
  exigirMetodo(req, ["POST"]);
  exigirMesmaOrigem(req);

  const tokenEsperado = process.env.ADMIN_BOOTSTRAP_TOKEN;
  if (!tokenEsperado || tokenEsperado.length < 32) {
    throw new ApiError(404, "CONFIGURACAO_INDISPONIVEL", "A configuração inicial não está habilitada.");
  }

  const corpo = await lerCorpoJson(req, 8 * 1024);
  if (!tokenValido(corpo.token, tokenEsperado)) {
    throw new ApiError(403, "TOKEN_INVALIDO", "Token de configuração inválido.");
  }

  const login = typeof corpo.login === "string" ? corpo.login.trim().toLowerCase() : "";
  const nome = typeof corpo.nome === "string" ? corpo.nome.trim() : "";
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  const empresaNome = typeof corpo.empresaNome === "string" ? corpo.empresaNome.trim() : "";
  const empresaSlug = typeof corpo.empresaSlug === "string" ? corpo.empresaSlug.trim().toLowerCase() : "";

  if (!LOGIN_FORMATO.test(login)) {
    throw new ApiError(400, "DADOS_INVALIDOS", "O login deve ter de 3 a 20 caracteres (letras minúsculas, números, ponto, hífen ou sublinhado).");
  }
  if (nome.length < 3 || nome.length > 120) {
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe um nome entre 3 e 120 caracteres.");
  }
  const falhaSenha = validarPoliticaSenha(senha);
  if (falhaSenha) throw new ApiError(400, "DADOS_INVALIDOS", falhaSenha);
  if (!empresaNome || empresaNome.length > 160) {
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe o nome da empresa (até 160 caracteres).");
  }
  if (!SLUG_FORMATO.test(empresaSlug)) {
    throw new ApiError(400, "DADOS_INVALIDOS", "O identificador da empresa deve ter de 3 a 60 caracteres, usando letras minúsculas, números e hífen.");
  }

  const linhas = await consultar(
    `WITH trava AS MATERIALIZED (
       SELECT pg_advisory_xact_lock(718203641)
     ),
     banco_vazio AS MATERIALIZED (
       SELECT NOT EXISTS (SELECT 1 FROM app_users) AS permitido FROM trava
     ),
     empresa AS (
       INSERT INTO companies (name, slug)
       SELECT $4::text, $5::text FROM banco_vazio WHERE permitido
       ON CONFLICT (slug) DO UPDATE SET name = companies.name
       RETURNING id
     ),
     usuario AS (
       INSERT INTO app_users (login, name, cargo, password_hash, active)
       SELECT $1::text, $2::text, 'Administrador', $3::text, TRUE
       FROM empresa
       RETURNING id
     ),
     vinculo AS (
       INSERT INTO company_memberships (user_id, company_id, role, active, permissions)
       SELECT usuario.id, empresa.id, 'OWNER', TRUE, $6::text[]
       FROM usuario CROSS JOIN empresa
       RETURNING id
     ),
     auditoria AS (
       INSERT INTO audit_logs (company_id, actor_user_id, action, entity, entity_id, result, metadata)
       SELECT empresa.id, usuario.id, 'ADMIN_CRIADO_PELO_BOOTSTRAP', 'app_users',
              usuario.id::text, 'SUCCESS', $7::jsonb
       FROM usuario CROSS JOIN empresa CROSS JOIN vinculo
       RETURNING id
     )
     SELECT usuario.id
       FROM usuario CROSS JOIN auditoria`,
    [
      login,
      nome,
      hashPassword(senha),
      empresaNome,
      empresaSlug,
      paraArrayPg([...MODULOS]),
      JSON.stringify({ login, origem: "bootstrap_temporario" }),
    ],
  );

  if (!linhas[0]) {
    throw new ApiError(409, "BOOTSTRAP_INDISPONIVEL", "Já existe um usuário no banco. A configuração inicial só funciona em um banco sem usuários; nada foi alterado.");
  }

  enviarDados(res, 201, {
    criado: true,
    login,
    nome,
    empresa: empresaNome,
    mensagem: "Administrador criado. Remova ADMIN_BOOTSTRAP_TOKEN das variáveis da Vercel após confirmar o acesso.",
  });
}

module.exports = comErros(handler);
