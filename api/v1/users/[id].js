"use strict";

/*
 * PATCH /api/v1/users/:id -> edita nome, cargo, permissões, ativação e senha.
 *
 * Regras:
 *  - somente administradores (módulo "admin") da empresa da sessão;
 *  - o usuário só é alterado se estiver vinculado à empresa da sessão (isolamento);
 *  - ninguém altera as próprias permissões nem a própria ativação;
 *  - a empresa nunca fica sem administrador ativo, inclusive sob concorrência;
 *  - alteração de senha ou desativação revoga as sessões do usuário;
 *  - a auditoria registra os NOMES dos campos alterados, nunca os valores de senha.
 *
 * A verificação do último administrador é feita dentro da mesma instrução SQL que
 * atualiza o usuário. Um advisory transaction lock por empresa serializa alterações
 * concorrentes; a contagem de administradores é refeita somente depois de obter o lock.
 */

const { ApiError } = require("../../../lib/errors");
const { consultar, consultarTransacao } = require("../../../lib/db");
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
const { validarIdentificador, validarEdicao } = require("../../../lib/users");
const { paraArrayPg } = require("../../../lib/permissions");

const SQL_BUSCAR = `
  SELECT u.id, u.login, u.name, u.cargo, u.active AS ativo,
         m.active AS vinculo_ativo, m.permissions AS permissoes
    FROM company_memberships m
    JOIN app_users u ON u.id = m.user_id
   WHERE m.user_id = $1::uuid AND m.company_id = $2::uuid`;

/*
 * A autorização é calculada depois que a transação obtém o lock da empresa.
 * Quando permitido=false, nenhuma tabela de usuário, vínculo, sessão ou auditoria é alterada.
 */
const SQL_ATUALIZAR = `
WITH estado_alvo AS MATERIALIZED (
  SELECT u.active AS usuario_ativo, m.active AS vinculo_ativo, m.permissions AS permissoes
    FROM company_memberships m
    JOIN app_users u ON u.id = m.user_id
   WHERE m.user_id = $1::uuid AND m.company_id = $7::uuid
), outros_admins AS MATERIALIZED (
  SELECT COUNT(*)::int AS total
    FROM company_memberships m
    JOIN app_users u ON u.id = m.user_id
   WHERE m.company_id = $7::uuid
     AND m.user_id <> $1::uuid
     AND m.active = TRUE AND u.active = TRUE
     AND 'admin' = ANY(m.permissions)
), autorizacao AS MATERIALIZED (
  SELECT CASE
    WHEN NOT (alvo.usuario_ativo AND alvo.vinculo_ativo AND 'admin' = ANY(alvo.permissoes)) THEN TRUE
    WHEN ($4::boolean AND 'admin' = ANY($6::text[])) THEN TRUE
    WHEN outros.total > 0 THEN TRUE
    ELSE FALSE
  END AS permitido
  FROM estado_alvo alvo
  CROSS JOIN outros_admins outros
), usuario AS (
  UPDATE app_users
     SET name = $2::text, cargo = $3::text, active = $4::boolean,
         password_hash = COALESCE($5::text, password_hash), updated_at = NOW()
   WHERE id = $1::uuid
     AND EXISTS (SELECT 1 FROM autorizacao WHERE permitido)
  RETURNING id
), vinculo AS (
  UPDATE company_memberships
     SET permissions = $6::text[], active = $4::boolean,
         role = CASE WHEN 'admin' = ANY($6::text[]) THEN 'ADMIN' ELSE 'MEMBER' END,
         updated_at = NOW()
   WHERE user_id = $1::uuid AND company_id = $7::uuid
     AND EXISTS (SELECT 1 FROM autorizacao WHERE permitido)
  RETURNING id
), sessoes AS (
  UPDATE app_sessions SET revoked_at = NOW()
   WHERE user_id = $1::uuid AND revoked_at IS NULL AND $8::boolean
     AND EXISTS (SELECT 1 FROM usuario)
  RETURNING id
), auditoria AS (
  INSERT INTO audit_logs (company_id, actor_user_id, action, entity, entity_id, result, metadata, ip_hash, user_agent)
  SELECT $7::uuid, $9::uuid, 'USUARIO_ATUALIZADO', 'app_users', usuario.id::text, 'SUCCESS',
         $10::jsonb, $11::text, $12::text
    FROM usuario
  RETURNING id
)
SELECT autorizacao.permitido, usuario.id
  FROM autorizacao
  LEFT JOIN usuario ON TRUE
`;

function validarMesmoUsuarioSemAutoAlteracao(id, sessao, corpo, atual) {
  if (id !== sessao.usuario.id) return;
  const alteraPermissoes =
    corpo.permissoes !== undefined &&
    JSON.stringify([...new Set(corpo.permissoes)].sort()) !== JSON.stringify([...atual.permissoes].sort());
  const alteraAtivo = corpo.ativo !== undefined && corpo.ativo !== (atual.ativo && atual.vinculo_ativo);
  if (alteraPermissoes || alteraAtivo) {
    throw new ApiError(422, "NAO_PODE_ALTERAR_PROPRIO_ACESSO", "Você não pode alterar as próprias permissões ou ativação.");
  }
}

async function handler(req, res) {
  exigirMetodo(req, ["PATCH"]);
  protegerAlteracao(req);
  const sessao = await exigirSessao(req);
  exigirPermissao(sessao, "admin");

  const id = validarIdentificador(req.query && req.query.id);
  const corpo = await lerCorpoJson(req, 8 * 1024);

  const encontrados = await consultar(SQL_BUSCAR, [id, sessao.empresa.id]);
  const atual = encontrados[0];
  if (!atual) throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado nesta empresa.");
  atual.permissoes = Array.isArray(atual.permissoes) ? atual.permissoes : [];

  validarMesmoUsuarioSemAutoAlteracao(id, sessao, corpo, atual);

  const { final, senha, camposAlterados } = validarEdicao(corpo, {
    nome: atual.name,
    cargo: atual.cargo,
    permissoes: atual.permissoes,
    ativo: atual.ativo && atual.vinculo_ativo,
  });

  const revogarSessoes = final.ativo === false || senha !== null;
  const atualizado = await consultarTransacao([
    { texto: "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))", parametros: [sessao.empresa.id] },
    { texto: SQL_ATUALIZAR, parametros: [
    id,
    final.nome,
    final.cargo,
    final.ativo,
    senha ? hashPassword(senha) : null,
    paraArrayPg(final.permissoes),
    sessao.empresa.id,
    revogarSessoes,
    sessao.usuario.id,
    JSON.stringify({ camposAlterados }),
    hashIp(req),
    userAgent(req),
    ] },
  ]);

  if (!atualizado[0]) {
    throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado nesta empresa.");
  }
  if (!atualizado[0].permitido) {
    throw new ApiError(422, "ULTIMO_ADMINISTRADOR", "Mantenha ao menos um administrador ativo na empresa.");
  }
  if (!atualizado[0].id) {
    throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado nesta empresa.");
  }

  enviarDados(res, 200, {
    id,
    login: atual.login,
    nome: final.nome,
    cargo: final.cargo,
    ativo: final.ativo,
    permissoes: final.permissoes,
  });
}

module.exports = comErros(handler);
