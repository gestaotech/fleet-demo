"use strict";

/*
 * GET  /api/v1/users -> usuários vinculados à empresa da sessão (sem credenciais).
 * POST /api/v1/users -> cria usuário e vínculo com a empresa.
 *
 * Somente quem tem o módulo "admin" acessa estas rotas.
 * Criação e registro de auditoria ocorrem em uma única instrução SQL.
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
const { hashPassword } = require("../../../lib/security");
const { validarNovoUsuario } = require("../../../lib/users");
const { paraArrayPg } = require("../../../lib/permissions");

const SQL_LISTAR = `
  SELECT u.id, u.login, u.name, u.cargo, u.active AS ativo, m.active AS vinculo_ativo,
         m.permissions AS permissoes, u.last_login_at
    FROM company_memberships m
    JOIN app_users u ON u.id = m.user_id
   WHERE m.company_id = $1::uuid
   ORDER BY u.name, u.login`;

const SQL_CRIAR = `
WITH novo_usuario AS (
  INSERT INTO app_users (login, name, cargo, password_hash, active)
  VALUES ($1::text, $2::text, $3::text, $4::text, $5::boolean)
  RETURNING id
), novo_vinculo AS (
  INSERT INTO company_memberships (user_id, company_id, role, active, permissions)
  SELECT id, $6::uuid,
         CASE WHEN 'admin' = ANY($7::text[]) THEN 'ADMIN' ELSE 'MEMBER' END,
         $5::boolean, $7::text[]
    FROM novo_usuario
  RETURNING id
), auditoria AS (
  INSERT INTO audit_logs (company_id, actor_user_id, action, entity, entity_id, result, metadata, ip_hash, user_agent)
  SELECT $6::uuid, $8::uuid, 'USUARIO_CRIADO', 'app_users', id::text, 'SUCCESS', $9::jsonb, $10::text, $11::text
    FROM novo_usuario
  RETURNING id
)
SELECT id FROM novo_usuario`;

async function listar(req, res, sessao) {
  const linhas = await consultar(SQL_LISTAR, [sessao.empresa.id]);
  enviarDados(
    res,
    200,
    linhas.map((l) => ({
      id: l.id,
      login: l.login,
      nome: l.name,
      cargo: l.cargo,
      ativo: l.ativo && l.vinculo_ativo,
      permissoes: Array.isArray(l.permissoes) ? l.permissoes : [],
      ultimoAcesso: l.last_login_at,
    })),
  );
}

async function criar(req, res, sessao) {
  const corpo = await lerCorpoJson(req, 8 * 1024);
  const dados = validarNovoUsuario(corpo);

  try {
    const criado = await consultar(SQL_CRIAR, [
      dados.login,
      dados.nome,
      dados.cargo,
      hashPassword(dados.senha),
      dados.ativo,
      sessao.empresa.id,
      paraArrayPg(dados.permissoes),
      sessao.usuario.id,
      JSON.stringify({ login: dados.login, permissoes: dados.permissoes, ativo: dados.ativo }),
      hashIp(req),
      userAgent(req),
    ]);
    enviarDados(res, 201, { id: criado[0].id, login: dados.login, nome: dados.nome, cargo: dados.cargo, ativo: dados.ativo, permissoes: dados.permissoes });
  } catch (erro) {
    if (erro.pgCode === "23505") {
      throw new ApiError(409, "LOGIN_EXISTENTE", "Já existe um usuário com este acesso.");
    }
    throw erro;
  }
}

async function handler(req, res) {
  exigirMetodo(req, ["GET", "POST"]);
  if (req.method === "POST") protegerAlteracao(req);
  const sessao = await exigirSessao(req);
  exigirPermissao(sessao, "admin");

  if (req.method === "GET") return listar(req, res, sessao);
  return criar(req, res, sessao);
}

module.exports = comErros(handler);
