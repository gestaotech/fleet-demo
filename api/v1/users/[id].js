"use strict";

/*
 * PATCH /api/v1/users/:id -> edita nome, cargo, permissões, ativação e senha.
 *
 * Regras:
 *  - somente administradores (módulo "admin") da empresa da sessão;
 *  - o usuário só é alterado se estiver vinculado à empresa da sessão (isolamento);
 *  - ninguém altera as próprias permissões nem a própria ativação (evita autobloqueio
 *    e autoconcessão de privilégios);
 *  - a empresa nunca fica sem administrador ativo;
 *  - alteração de senha ou desativação revoga as sessões do usuário;
 *  - a auditoria registra os NOMES dos campos alterados, nunca os valores de senha.
 *
 * Limitação conhecida: a verificação do último administrador é feita na aplicação antes
 * da gravação. Duas edições simultâneas e opostas podem, em tese, passar pela verificação;
 * a correção definitiva exige transação serializável ou restrição no banco (roadmap).
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
const {
  validarIdentificador,
  validarEdicao,
} = require("../../../lib/users");
const { paraArrayPg } = require("../../../lib/permissions");

const SQL_BUSCAR = `
  SELECT u.id, u.login, u.name, u.cargo, u.active AS ativo,
         m.active AS vinculo_ativo, m.permissions AS permissoes
    FROM company_memberships m
    JOIN app_users u ON u.id = m.user_id
   WHERE m.user_id = $1::uuid AND m.company_id = $2::uuid`;


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
  const atualizado = await consultar(
    `SELECT * FROM atualizar_usuario_com_guardia(
      $1::uuid, $2::uuid, $3::text, $4::text, $5::boolean, $6::text,
      $7::text[], $8::boolean, $9::uuid, $10::jsonb, $11::text, $12::text
    )`,
    [
      id,
      sessao.empresa.id,
      final.nome,
      final.cargo,
      final.ativo,
      senha ? hashPassword(senha) : null,
      paraArrayPg(final.permissoes),
      revogarSessoes,
      sessao.usuario.id,
      JSON.stringify({ camposAlterados }),
      hashIp(req),
      userAgent(req),
    ],
  );
  const resultado = atualizado[0];
  if (!resultado || resultado.error_code === "USUARIO_NAO_ENCONTRADO") {
    throw new ApiError(404, "USUARIO_NAO_ENCONTRADO", "Usuário não encontrado nesta empresa.");
  }
  if (resultado.error_code === "ULTIMO_ADMINISTRADOR") {
    throw new ApiError(422, "ULTIMO_ADMINISTRADOR", "Mantenha ao menos um administrador ativo na empresa.");
  }
  if (!resultado.updated_user_id) {
    throw new ApiError(500, "BANCO_ERRO", "Não foi possível concluir a operação.");
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
