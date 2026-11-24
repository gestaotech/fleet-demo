const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const G = () => app.api('ExternalSpending');
const W = () => app.api('Warehouse');

const gasto = (overrides = {}) => ({
  data: '2026-10-05',
  tipo: 'Insumo',
  descricao: 'Lubrificante para correntes',
  quantidade: '2 1/2',
  valorUnitario: '35,90',
  fornecedor: 'Casa do Óleo',
  responsavel: 'Rogério Santana',
  observacao: '',
  ...overrides,
});

test('registra gasto externo, calcula o total e gera identificador próprio', () => {
  const s = app.fresh();
  const result = G().create(s, gasto());
  assert.equal(result.ok, true);
  assert.equal(result.value.id, 'GEX-0001');
  assert.equal(result.value.quantidade, 2.5);
  assert.equal(result.value.valorTotal, 89.75);
  assert.equal(G().list(s).length, 1);
});

test('gasto não altera o saldo do estoque nem cria movimentação', () => {
  const s = app.fresh();
  const saldoAntes = W().balance(s, 'PEC-001');
  const movimentosAntes = s.movimentacoes.length;
  G().create(s, gasto({ tipo: 'Peça', descricao: 'Filtro de óleo avulso' }));
  assert.equal(W().balance(s, 'PEC-001'), saldoAntes);
  assert.equal(s.movimentacoes.length, movimentosAntes);
});

test('exige data, tipo, descrição, quantidade, valor, fornecedor e responsável', () => {
  const s = app.fresh();
  assert.equal(G().create(s, gasto({ data: '' })).ok, false);
  assert.equal(G().create(s, gasto({ tipo: 'Outro' })).ok, false);
  assert.equal(G().create(s, gasto({ descricao: '' })).ok, false);
  assert.equal(G().create(s, gasto({ quantidade: '0' })).ok, false);
  assert.equal(G().create(s, gasto({ quantidade: '1/0' })).ok, false);
  assert.equal(G().create(s, gasto({ valorUnitario: '0' })).ok, false);
  assert.equal(G().create(s, gasto({ fornecedor: '' })).ok, false);
  assert.equal(G().create(s, gasto({ responsavel: '' })).ok, false);
  assert.equal((s.gastosExternos || []).length, 0);
});

test('filtra por período e tipo, do mais recente para o mais antigo', () => {
  const s = app.fresh();
  G().create(s, gasto({ data: '2026-09-01', tipo: 'Peça' }));
  G().create(s, gasto({ data: '2026-10-05', tipo: 'Insumo' }));
  G().create(s, gasto({ data: '2026-10-20', tipo: 'Insumo' }));
  assert.equal(JSON.stringify(G().list(s, { from: '2026-10-01', to: '2026-10-31' }).map(g => g.data)), JSON.stringify(['2026-10-20', '2026-10-05']));
  assert.equal(G().list(s, { tipo: 'Peça' }).length, 1);
  assert.equal(G().list(s, { tipo: 'Todos' }).length, 3);
});

test('resumo separa peças e insumos e soma o total', () => {
  const s = app.fresh();
  G().create(s, gasto({ tipo: 'Peça', quantidade: '2', valorUnitario: '10' }));
  G().create(s, gasto({ tipo: 'Insumo', quantidade: '1/2', valorUnitario: '30' }));
  const resumo = G().summary(G().list(s));
  assert.equal(resumo.registros, 2);
  assert.equal(resumo.porTipo['Peça'], 20);
  assert.equal(resumo.porTipo.Insumo, 15);
  assert.equal(resumo.valorTotal, 35);
});

test('atualiza e exclui gasto existente; identificador inexistente é recusado', () => {
  const s = app.fresh();
  const criado = G().create(s, gasto());
  assert.equal(G().update(s, criado.value.id, gasto({ valorUnitario: '40' })).value.valorTotal, 100);
  assert.equal(G().remove(s, criado.value.id).ok, true);
  assert.equal(G().list(s).length, 0);
  assert.equal(G().update(s, 'GEX-9999', gasto()).ok, false);
  assert.equal(G().remove(s, 'GEX-9999').ok, false);
});
