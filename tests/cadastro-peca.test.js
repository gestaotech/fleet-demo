const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const W = () => app.api('Warehouse');

const base = {
  codigo: 'TST-9001',
  descricao: 'Peça de teste',
  valorUnitario: '10,00',
  estoqueMinimo: '1',
  dataEntrada: '2026-08-01',
  quantidadeInicial: '0',
};

test('cadastro de peça guarda a observação informada', () => {
  const s = app.fresh();
  const result = W().createPart(s, { ...base, observacao: '  Fornecedor X  ' });
  assert.equal(result.ok, true);
  assert.equal(result.value.observacao, 'Fornecedor X');
});

test('observação é opcional e fica vazia quando não informada', () => {
  const s = app.fresh();
  const result = W().createPart(s, base);
  assert.equal(result.ok, true);
  assert.equal(result.value.observacao, '');
});

test('edição altera a observação sem mudar o histórico de movimentações', () => {
  const s = app.fresh();
  const movimentos = s.movimentacoes.length;
  const result = W().updatePart(s, 'PEC-001', { ...base, codigo: 'FLT-1001', observacao: 'Nova nota' });
  assert.equal(result.ok, true);
  assert.equal(result.value.observacao, 'Nova nota');
  assert.equal(s.movimentacoes.length, movimentos);
});

test('peça sem movimentações pode ser excluída', () => {
  const s = app.fresh();
  const criada = W().createPart(s, base);
  const antes = s.pecas.length;
  const result = W().deletePart(s, criada.value.id);
  assert.equal(result.ok, true);
  assert.equal(s.pecas.length, antes - 1);
  assert.equal(W().findPart(s, criada.value.id), null);
});

test('peça com movimentações não é excluída e nada é alterado', () => {
  const s = app.fresh();
  const pecas = s.pecas.length;
  const movimentos = s.movimentacoes.length;
  const result = W().deletePart(s, 'PEC-001');
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /movimentações/);
  assert.equal(s.pecas.length, pecas);
  assert.equal(s.movimentacoes.length, movimentos);
});

test('exclusão de peça inexistente é recusada', () => {
  const s = app.fresh();
  assert.equal(W().deletePart(s, 'PEC-999').ok, false);
});
