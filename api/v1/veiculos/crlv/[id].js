"use strict";

/*
 * GET /api/v1/veiculos/crlv/:id           -> dados do CRLV anexado (documento: null se não houver).
 * GET /api/v1/veiculos/crlv/:id?arquivo=1 -> o próprio PDF, para visualizar.
 * GET /api/v1/veiculos/crlv/:id?arquivo=1&download=1 -> o mesmo PDF, como download (cópia para outro dispositivo).
 * PUT /api/v1/veiculos/crlv/:id           -> envia ou substitui o CRLV. Corpo: { nomeArquivo, conteudoBase64 }.
 * DELETE /api/v1/veiculos/crlv/:id        -> remove o CRLV (usado ao excluir o veículo).
 *
 * Leitura: qualquer usuário com acesso ao sistema. Escrita: módulo "veiculos".
 * O veículo precisa existir no estado operacional da empresa da sessão.
 * A auditoria registra o envio sem o conteúdo do arquivo.
 */

const { ApiError } = require("../../../../lib/errors");
const { consultar } = require("../../../../lib/db");
const {
  comErros,
  exigirMetodo,
  protegerAlteracao,
  lerCorpoJson,
  enviarDados,
  hashIp,
  userAgent,
} = require("../../../../lib/http");
const { exigirSessao, exigirPermissao, exigirAlgumaPermissao } = require("../../../../lib/auth");
const { registrarAuditoria } = require("../../../../lib/audit");
const { validarArquivoPdf, LIMITE_PDF_BYTES, paraBytea } = require("../../../../lib/documentos");

const LIMITE_CORPO_BYTES = Math.ceil((LIMITE_PDF_BYTES * 4) / 3) + 64 * 1024;

const SQL_VEICULO_EXISTE = `
  SELECT 1
    FROM fleet_workspace_state e, jsonb_array_elements(e.state->'veiculos') AS v
   WHERE e.company_id = $1::uuid AND v->>'id' = $2::text`;

const SQL_LER_METADADOS = `
  SELECT nome_arquivo, tamanho_bytes, enviado_em
    FROM vehicle_documents
   WHERE company_id = $1::uuid AND veiculo_id = $2::text AND tipo = 'CRLV'`;

const SQL_LER_ARQUIVO = `
  SELECT nome_arquivo, conteudo
    FROM vehicle_documents
   WHERE company_id = $1::uuid AND veiculo_id = $2::text AND tipo = 'CRLV'`;

const SQL_EXCLUIR = `
  DELETE FROM vehicle_documents
   WHERE company_id = $1::uuid AND veiculo_id = $2::text AND tipo = 'CRLV'
  RETURNING 1 AS removido`;

const SQL_GRAVAR = `
  INSERT INTO vehicle_documents (company_id, veiculo_id, tipo, nome_arquivo, tamanho_bytes, conteudo, enviado_por, enviado_em)
  VALUES ($1::uuid, $2::text, 'CRLV', $3::text, $4::integer, $5::bytea, $6::uuid, NOW())
  ON CONFLICT (company_id, veiculo_id, tipo) DO UPDATE
    SET nome_arquivo = EXCLUDED.nome_arquivo,
        tamanho_bytes = EXCLUDED.tamanho_bytes,
        conteudo = EXCLUDED.conteudo,
        enviado_por = EXCLUDED.enviado_por,
        enviado_em = EXCLUDED.enviado_em
  RETURNING enviado_em`;

/* Tabela ausente (código 42P01) significa que a migração 004 ainda não foi aplicada no banco. */
async function executarDocumento(operacao) {
  try {
    return await operacao();
  } catch (erro) {
    if (erro && erro.code === "42P01") {
      throw new ApiError(503, "DOCUMENTOS_INDISPONIVEIS", "O armazenamento de documentos ainda não está disponível. Avise o administrador do sistema.");
    }
    throw erro;
  }
}

function identificadorVeiculo(req) {
  const id = req.query && req.query.id;
  if (typeof id !== "string" || !/^[A-Za-z0-9-]{1,40}$/.test(id)) {
    throw new ApiError(400, "IDENTIFICADOR_INVALIDO", "Identificador de veículo inválido.");
  }
  return id;
}

function nomeSeguro(nome) {
  return String(nome || "crlv.pdf").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 100) || "crlv.pdf";
}

async function responderMetadados(res, sessao, id) {
  const linhas = await executarDocumento(() => consultar(SQL_LER_METADADOS, [sessao.empresa.id, id], { leitura: true }));
  const doc = linhas[0];
  enviarDados(res, 200, {
    veiculoId: id,
    documento: doc
      ? { nomeArquivo: doc.nome_arquivo, tamanhoBytes: doc.tamanho_bytes, enviadoEm: doc.enviado_em }
      : null,
  });
}

async function responderArquivo(req, res, sessao, id) {
  const linhas = await executarDocumento(() => consultar(SQL_LER_ARQUIVO, [sessao.empresa.id, id], { leitura: true }));
  if (!linhas[0]) throw new ApiError(404, "DOCUMENTO_NAO_ENCONTRADO", "Nenhum CRLV enviado para este veículo.");
  const conteudo = Buffer.from(linhas[0].conteudo);
  const modo = req.query && req.query.download === "1" ? "attachment" : "inline";
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${modo}; filename="${nomeSeguro(linhas[0].nome_arquivo)}"`);
  res.setHeader("Content-Length", String(conteudo.length));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(conteudo);
}

async function responderEnvio(req, res, sessao, id) {
  exigirPermissao(sessao, "veiculos");
  const corpo = await lerCorpoJson(req, LIMITE_CORPO_BYTES);
  const arquivo = validarArquivoPdf(corpo);

  const existe = await consultar(SQL_VEICULO_EXISTE, [sessao.empresa.id, id]);
  if (!existe[0]) throw new ApiError(404, "VEICULO_NAO_ENCONTRADO", "Veículo não encontrado nesta empresa.");

  const gravado = await executarDocumento(() => consultar(SQL_GRAVAR, [
    sessao.empresa.id,
    id,
    arquivo.nome,
    arquivo.conteudo.length,
    paraBytea(arquivo.conteudo),
    sessao.usuario.id,
  ]));

  await registrarAuditoria({
    acao: "CRLV_ENVIADO",
    entidade: "vehicle_documents",
    entidadeId: id,
    resultado: "SUCCESS",
    usuarioId: sessao.usuario.id,
    empresaId: sessao.empresa.id,
    metadados: { veiculoId: id, tamanhoBytes: arquivo.conteudo.length },
    ipHash: hashIp(req),
    userAgent: userAgent(req),
  });

  enviarDados(res, 200, {
    veiculoId: id,
    documento: { nomeArquivo: arquivo.nome, tamanhoBytes: arquivo.conteudo.length, enviadoEm: gravado[0].enviado_em },
  });
}

async function responderExclusao(req, res, sessao, id) {
  exigirPermissao(sessao, "veiculos");
  const removidos = await executarDocumento(() => consultar(SQL_EXCLUIR, [sessao.empresa.id, id]));
  if (removidos.length) {
    await registrarAuditoria({
      acao: "CRLV_EXCLUIDO",
      entidade: "vehicle_documents",
      entidadeId: id,
      resultado: "SUCCESS",
      usuarioId: sessao.usuario.id,
      empresaId: sessao.empresa.id,
      metadados: { veiculoId: id },
      ipHash: hashIp(req),
      userAgent: userAgent(req),
    });
  }
  enviarDados(res, 200, { veiculoId: id, removido: removidos.length > 0 });
}

async function handler(req, res) {
  exigirMetodo(req, ["GET", "PUT", "DELETE"]);
  if (req.method !== "GET") protegerAlteracao(req);

  const sessao = await exigirSessao(req);
  const id = identificadorVeiculo(req);

  if (req.method === "PUT") return responderEnvio(req, res, sessao, id);
  if (req.method === "DELETE") return responderExclusao(req, res, sessao, id);
  exigirAlgumaPermissao(sessao);
  if (req.query && req.query.arquivo === "1") return responderArquivo(req, res, sessao, id);
  return responderMetadados(res, sessao, id);
}

module.exports = comErros(handler);
