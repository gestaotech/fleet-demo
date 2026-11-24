const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const W = () => app.api('Warehouse');
const V = () => app.api('Vehicles');
const U = () => app.api('Utils');

test('leitura de quantidade aceita fração, mista, decimal e recusa valores inválidos', () => {
  assert.equal(U().parseQuantidade('1/2'), 0.5);
  assert.equal(U().parseQuantidade('2 1/2'), 2.5);
  assert.equal(U().parseQuantidade('1,5'), 1.5);
  assert.ok(Number.isNaN(U().parseQuantidade('1/0')));
  assert.ok(Number.isNaN(U().parseQuantidade('abc')));
  assert.ok(Number.isNaN(U().parseQuantidade('0,0001')));
});

test('ajuste define a nova quantidade sem registrar saída nem custo', () => {
  const s = app.fresh();
  const saidasAntes = s.movimentacoes.filter(m => m.tipo === 'Saida').length;
  const result = W().addAdjustment(s, { pecaId: 'PEC-001', novaQuantidade: '60', motivoAjuste: 'Contagem de inventário' }, 'Admin Teste');
  assert.equal(result.ok, true);
  assert.equal(result.value.tipo, 'Ajuste');
  assert.equal(W().balance(s, 'PEC-001'), 60);
  assert.equal(s.movimentacoes.filter(m => m.tipo === 'Saida').length, saidasAntes);
});

test('ajuste para menos reduz o saldo com sinal negativo', () => {
  const s = app.fresh();
  const result = W().addAdjustment(s, { pecaId: 'PEC-001', novaQuantidade: '40,5', motivoAjuste: 'Perda' }, 'Admin Teste');
  assert.equal(result.ok, true);
  assert.equal(result.value.quantidade, -6.5);
  assert.equal(W().balance(s, 'PEC-001'), 40.5);
});

test('ajuste exige motivo, quantidade diferente da atual e quantidade não negativa', () => {
  const s = app.fresh();
  const atual = String(W().balance(s, 'PEC-001'));
  assert.equal(W().addAdjustment(s, { pecaId: 'PEC-001', novaQuantidade: '10', motivoAjuste: '' }, 'Admin').ok, false);
  assert.equal(W().addAdjustment(s, { pecaId: 'PEC-001', novaQuantidade: atual, motivoAjuste: 'x' }, 'Admin').ok, false);
  assert.equal(W().addAdjustment(s, { pecaId: 'PEC-001', novaQuantidade: '-1', motivoAjuste: 'x' }, 'Admin').ok, false);
});

test('histórico mostra o saldo após o ajuste na mesma sequência das movimentações', () => {
  const s = app.fresh();
  W().addAdjustment(s, { pecaId: 'PEC-001', novaQuantidade: '100', motivoAjuste: 'Inventário' }, 'Admin');
  const historico = W().movementsOf(s, 'PEC-001');
  assert.equal(historico[historico.length - 1].saldoApos, 100);
  assert.equal(W().balance(s, 'PEC-001'), 100);
});

test('veículo sem registros pode ser excluído', () => {
  const s = app.fresh();
  const criado = V().create(s, {
    marca: 'Teste', identificacao: 'EXC-001', placa: 'EXC1A23', dataEntrada: '2026-03-10', situacao: 'Ativo', quilometragemCadastro: '',
  });
  const antes = s.veiculos.length;
  const result = V().remove(s, criado.value.id);
  assert.equal(result.ok, true);
  assert.equal(s.veiculos.length, antes - 1);
  assert.equal(V().find(s, criado.value.id), null);
});

test('veículo com histórico não é excluído e nada muda', () => {
  const s = app.fresh();
  const antes = s.veiculos.length;
  const result = V().remove(s, 'VEI-002');
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /histórico/);
  assert.equal(s.veiculos.length, antes);
});
