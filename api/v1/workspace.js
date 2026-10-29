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
const { registrarAuditoria } = require("../../lib/audit");
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

const ESTADO_VAZIO = JSON.stringify({
  schemaVersion: 2,
  configuracoes: { alertaTrocaOleoKm: 1000, alertaTrocaOleoDias: 30 },
  veiculos: [],
  pecas: [],
  movimentacoes: [],
  pecasExternas: [],
  manutencoes: [],
  despesas: [],
  abastecimentos: [],
  trocasOleo: [],
});

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

/*
 * Lê o estado da empresa. Se não existir, cria um estado vazio automaticamente
 * (idempotente: só cria se não existir). Assim o primeiro acesso não mostra erro
 * e o usuário pode cadastrar dados reais.
 */
async function lerEstadoAtual(empresaId, usuarioId) {
  const linhas = await consultar(SQL_LER_ESTADO, [empresaId], { leitura: true });
  if (linhas[0]) {
    return { revision: Number(linhas[0].revision), state: linhas[0].state };
  }
  // Cria estado vazio (idempotente: ON CONFLICT DO NOTHING)
  const criado = await consultar(
    `INSERT INTO fleet_workspace_state (company_id, schema_version, state, revision, updated_by)
     VALUES ($1::uuid, 2, $2::jsonb, 1, $3::uuid)
     ON CONFLICT (company_id) DO NOTHING
     RETURNING revision, state`,
    [empresaId, ESTADO_VAZIO, usuarioId],
  );
  if (criado[0]) {
    return { revision: Number(criado[0].revision), state: criado[0].state };
  }
  // Outro request criou ao mesmo tempo: reler
  const relido = await consultar(SQL_LER_ESTADO, [empresaId], { leitura: true });
  if (!relido[0]) {
    throw new ApiError(500, "BANCO_ERRO", "Não foi possível inicializar os dados da empresa.");
  }
  return { revision: Number(relido[0].revision), state: relido[0].state };
}

async function responderLeitura(req, res, sessao) {
  exigirAlgumaPermissao(sessao);
  const atual = await lerEstadoAtual(sessao.empresa.id, sessao.usuario.id);
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

  const atual = await lerEstadoAtual(sessao.empresa.id, sessao.usuario.id);
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
      // Tentativas negadas também ficam registradas: são sinal relevante de uso indevido.
      await registrarAuditoria({
        acao: "ESTADO_NEGADO",
        entidade: "fleet_workspace_state",
        entidadeId: sessao.empresa.id,
        resultado: "DENIED",
        usuarioId: sessao.usuario.id,
        empresaId: sessao.empresa.id,
        metadados: { colecoes: colecoesNegadas, modulo },
        ipHash: hashIp(req),
        userAgent: userAgent(req),
      });
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
    const agora = await lerEstadoAtual(sessao.empresa.id, sessao.usuario.id);
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
