"use strict";

/*
 * GET /api/v1/workspace  -> estado operacional da empresa da sessão, com revisão atual.
 * PUT /api/v1/workspace  -> grava o estado. Corpo: { "baseRevision": 7, "state": { ... } }
 *
 * Leitura: qualquer usuário autenticado com ao menos um módulo liberado da empresa.
 * Escrita: somente coleções cujo módulo o usuário possui (lib/permissions.js).
 *
 * Concorrência: a gravação só ocorre se baseRevision ainda for a revisão do banco.
 * Caso contrário a resposta é 409 REVISAO_DESATUALIZADA e nada é alterado; a
 * interface deve recarregar o estado antes de gravar de novo.
 *
 * A atualização e o registro de auditoria acontecem em uma única instrução SQL:
 * ou ambos existem ou nenhum existe.
 *
 * Respostas: 200, 400 (JSON), 401, 403 (módulo), 404 (empresa sem estado),
 * 409 (conflito), 413 (tamanho), 422 (estado inválido), 405, 503.
 */

const { ApiError } = require("../../lib/errors");
const { consultar } = require("../../lib/db");
const {
  comErros,
  exigirMetodo,
  protegerAlteracao,
  lerCorpoJson,
  enviarDados,
  hashIp,
  userAgent,
} = require("../../lib/http");
const { exigirSessao, exigirPermissao, exigirAlgumaPermissao } = require("../../lib/auth");
const { MODULOS, COLECAO_MODULO } = require("../../lib/permissions");
const {
  validarFormato,
  validarInvariantes,
  colecoesAlteradas,
  modulosNecessarios,
} = require("../../lib/workspace");

const LIMITE_CORPO_BYTES = 1500 * 1024;

const NOMES_MODULO = {
  admin: "Administrador",
  almoxarifado: "Almoxarifado",
  veiculos: "Veículos",
  manutencao: "Manutenção",
  combustivel: "Combustível",
  relatorios: "Relatórios",
};

const SQL_LER_ESTADO = "SELECT revision, state FROM fleet_workspace_state WHERE company_id = $1";

/*
 * Atualização atômica: só altera se a revisão ainda for a esperada, e registra a
 * auditoria apenas quando a alteração ocorreu (a CTE de auditoria lê de "atualizado").
 */
const SQL_GRAVAR_ESTADO = `
WITH atualizado AS (
  UPDATE fleet_workspace_state
     SET state = $2::jsonb, revision = revision + 1, updated_at = NOW(), updated_by = $3::uuid
   WHERE company_id = $1::uuid AND revision = $4::bigint
  RETURNING revision
), auditoria AS (
  INSERT INTO audit_logs (company_id, actor_user_id, action, entity, entity_id, result, metadata, ip_hash, user_agent)
  SELECT $1::uuid, $3::uuid, 'ESTADO_ATUALIZADO', 'fleet_workspace_state', $1::text, 'SUCCESS', $5::jsonb, $6::text, $7::text
    FROM atualizado
  RETURNING id
)
SELECT revision FROM atualizado`;

async function lerEstadoAtual(empresaId) {
  const linhas = await consultar(SQL_LER_ESTADO, [empresaId]);
  if (!linhas[0]) {
    throw new ApiError(404, "AREA_NAO_INICIALIZADA", "Os dados desta empresa ainda não foram inicializados.");
  }
  return { revision: Number(linhas[0].revision), state: linhas[0].state };
}

async function responderLeitura(req, res, sessao) {
  exigirAlgumaPermissao(sessao);
  const atual = await lerEstadoAtual(sessao.empresa.id);
  enviarDados(res, 200, atual);
}

async function responderGravacao(req, res, sessao) {
  const corpo = await lerCorpoJson(req, LIMITE_CORPO_BYTES);
  const base = corpo.baseRevision;
  if (!Number.isInteger(base) || base < 1) {
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe a revisão lida (baseRevision).");
  }
  const novo = corpo.state;
  if (!novo || typeof novo !== "object" || Array.isArray(novo)) {
    throw new ApiError(400, "DADOS_INVALIDOS", "Informe o estado a ser gravado (state).");
  }

  const atual = await lerEstadoAtual(sessao.empresa.id);
  if (atual.revision !== base) {
    throw new ApiError(409, "REVISAO_DESATUALIZADA", "Os dados foram alterados por outro usuário. Recarregue antes de salvar.", {
      revisaoAtual: atual.revision,
    });
  }

  const formato = validarFormato(novo);
  if (formato.length) {
    throw new ApiError(422, "ESTADO_INVALIDO", formato[0], { erros: formato });
  }

  const alteradas = colecoesAlteradas(atual.state, novo);
  for (const modulo of modulosNecessarios(alteradas)) {
    if (!MODULOS.includes(modulo) || !sessao.permissoes.includes(modulo)) {
      const colecoesNegadas = alteradas.filter((c) => COLECAO_MODULO[c] === modulo);
      throw new ApiError(403, "SEM_PERMISSAO", `Seu perfil não pode alterar ${colecoesNegadas.join(", ")} (módulo ${NOMES_MODULO[modulo] || modulo}).`);
    }
  }

  const invariantes = validarInvariantes(novo);
  if (invariantes.length) {
    throw new ApiError(422, "ESTADO_INVALIDO", invariantes[0], { erros: invariantes });
  }

  const gravado = await consultar(SQL_GRAVAR_ESTADO, [
    sessao.empresa.id,
    JSON.stringify(novo),
    sessao.usuario.id,
    base,
    JSON.stringify({ colecoesAlteradas: alteradas, revisaoAnterior: base }),
    hashIp(req),
    userAgent(req),
  ]);

  if (!gravado[0]) {
    const agora = await lerEstadoAtual(sessao.empresa.id);
    throw new ApiError(409, "REVISAO_DESATUALIZADA", "Os dados foram alterados por outro usuário. Recarregue antes de salvar.", {
      revisaoAtual: agora.revision,
    });
  }

  enviarDados(res, 200, { revision: Number(gravado[0].revision) });
}

async function handler(req, res) {
  exigirMetodo(req, ["GET", "PUT"]);
  if (req.method === "PUT") protegerAlteracao(req);

  const sessao = await exigirSessao(req);
  if (req.method === "GET") return responderLeitura(req, res, sessao);
  exigirAlgumaPermissao(sessao);
  return responderGravacao(req, res, sessao);
}

module.exports = comErros(handler);
