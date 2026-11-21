const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarArquivoPdf, LIMITE_PDF_BYTES } = require('../../lib/documentos');

const pdfBase64 = (conteudo = '%PDF-1.4\n%teste\n') => Buffer.from(conteudo).toString('base64');

function erroDe(fn) {
  try {
    fn();
  } catch (erro) {
    return erro;
  }
  return null;
}

test('aceita PDF real e devolve o nome e o conteúdo decodificado', () => {
  const resultado = validarArquivoPdf({ nomeArquivo: 'crlv.pdf', conteudoBase64: pdfBase64() });
  assert.equal(resultado.nome, 'crlv.pdf');
  assert.equal(resultado.conteudo.subarray(0, 5).toString('latin1'), '%PDF-');
});

test('recusa arquivo que não começa com o cabeçalho de PDF', () => {
  const erro = erroDe(() => validarArquivoPdf({ nomeArquivo: 'crlv.pdf', conteudoBase64: pdfBase64('imagem falsa') }));
  assert.equal(erro.code, 'ARQUIVO_INVALIDO');
  assert.equal(erro.status, 422);
});

test('recusa nome sem extensão .pdf', () => {
  const erro = erroDe(() => validarArquivoPdf({ nomeArquivo: 'crlv.png', conteudoBase64: pdfBase64() }));
  assert.equal(erro.code, 'ARQUIVO_INVALIDO');
});

test('recusa conteúdo base64 malformado', () => {
  const erro = erroDe(() => validarArquivoPdf({ nomeArquivo: 'crlv.pdf', conteudoBase64: '%%%' }));
  assert.equal(erro.code, 'ARQUIVO_INVALIDO');
});

test('recusa arquivo acima de 3 MB', () => {
  const grande = Buffer.alloc(LIMITE_PDF_BYTES + 1, 0x20);
  grande.write('%PDF-', 0, 'latin1');
  const erro = erroDe(() => validarArquivoPdf({ nomeArquivo: 'crlv.pdf', conteudoBase64: grande.toString('base64') }));
  assert.equal(erro.code, 'ARQUIVO_GRANDE_DEMAIS');
  assert.equal(erro.status, 413);
});
