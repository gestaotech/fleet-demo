"use strict";

/*
 * Validação do documento do veículo (CRLV em PDF), antes de qualquer gravação.
 * O arquivo chega em base64 dentro do JSON. Só são aceitos PDFs reais (cabeçalho %PDF-)
 * de até 3 MB.
 */

const { ApiError } = require("./errors");

const LIMITE_PDF_BYTES = 3 * 1024 * 1024;
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function validarArquivoPdf(corpo) {
  const nome = typeof corpo.nomeArquivo === "string" ? corpo.nomeArquivo.trim() : "";
  if (!nome || nome.length > 120 || !/\.pdf$/i.test(nome)) {
    throw new ApiError(422, "ARQUIVO_INVALIDO", "Envie um arquivo PDF (.pdf) com nome de até 120 caracteres.");
  }
  const base64 = typeof corpo.conteudoBase64 === "string" ? corpo.conteudoBase64 : "";
  if (!base64 || base64.length % 4 !== 0 || !BASE64_PATTERN.test(base64)) {
    throw new ApiError(422, "ARQUIVO_INVALIDO", "Conteúdo do arquivo inválido.");
  }
  const conteudo = Buffer.from(base64, "base64");
  if (conteudo.length > LIMITE_PDF_BYTES) {
    throw new ApiError(413, "ARQUIVO_GRANDE_DEMAIS", "O arquivo deve ter no máximo 3 MB.");
  }
  if (conteudo.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ApiError(422, "ARQUIVO_INVALIDO", "O arquivo enviado não é um PDF válido.");
  }
  return { nome, conteudo };
}

/*
 * Conteúdo como texto no formato hexadecimal do PostgreSQL (\x...). Consultas aceitam só
 * texto, número e booleano como parâmetro; um Buffer seria recusado antes do banco.
 */
function paraBytea(conteudo) {
  return `\\x${conteudo.toString("hex")}`;
}

module.exports = { LIMITE_PDF_BYTES, validarArquivoPdf, paraBytea };
