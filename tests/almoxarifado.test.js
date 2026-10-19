const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const W = () => app.api('Warehouse');
const M = () => app.api('Maintenance');

const retirada = (overrides = {}) => ({
  pecaId: 'PEC-001',
  veiculoId: 'VEI-001',
  quantidade: '3',
  data: '2026-10-19',
  responsavel: 'Teste',
  ...overrides,
});

test('retirada válida baixa o saldo, registra a saída e guarda o valor vigente', () => {
  const s = app.fresh();
  const result = W().registerWithdrawal(s, retirada());
  assert.equal(result.ok, true);
  assert.equal(W().balance(s, 'PEC-001'), 44);
  assert.equal(result.value.tipo, 'Saida');
  assert.equal(result.value.valorUnitario, 58.9);
});

test('retirada acima do saldo é recusada sem alterar nada', () => {
  const s = app.fresh();
  const movements = s.movimentacoes.length;
  const result = W().registerWithdrawal(s, retirada({ pecaId: 'PEC-010', quantidade: '5' }));
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /Saldo insuficiente/);
  assert.equal(W().balance(s, 'PEC-010'), 4);
  assert.equal(s.movimentacoes.length, movements);
});

test('retirada igual ao saldo disponível é aceita e zera o estoque', () => {
  const s = app.fresh();
  assert.equal(W().registerWithdrawal(s, retirada({ pecaId: 'PEC-010', quantidade: '4' })).ok, true);
  assert.equal(W().balance(s, 'PEC-010'), 0);
});

test('quantidades inválidas são recusadas', () => {
  for (const quantidade of ['0', '-1', '1,5', 'abc', '']) {
    const s = app.fresh();
    const result = W().registerWithdrawal(s, retirada({ quantidade }));
    assert.equal(result.ok, false, `quantidade "${quantidade}" deveria ser recusada`);
  }
});

test('retirada exige peça, veículo ativo, responsável e data válidos', () => {
  const s = app.fresh();
  assert.equal(W().registerWithdrawal(s, retirada({ pecaId: 'X' })).ok, false);
  assert.equal(W().registerWithdrawal(s, retirada({ veiculoId: 'VEI-007' })).ok, false, 'veículo inativo');
  assert.equal(W().registerWithdrawal(s, retirada({ responsavel: '  ' })).ok, false);
  assert.equal(W().registerWithdrawal(s, retirada({ data: '2026-02-30' })).ok, false);
});

test('retirada vinculada a manutenção fechada ou de outro veículo é recusada', () => {
  const s = app.fresh();
  assert.equal(W().registerWithdrawal(s, retirada({ manutencaoId: 'MNT-0001' })).ok, false, 'concluída');
  assert.equal(W().registerWithdrawal(s, retirada({ veiculoId: 'VEI-002', manutencaoId: 'MNT-0005' })).ok, false, 'outro veículo');
  assert.equal(W().registerWithdrawal(s, retirada({ manutencaoId: 'MNT-0005' })).ok, true, 'aberta e do mesmo veículo');
});

test('alterar o preço cadastral não altera retiradas já registradas', () => {
  const s = app.fresh();
  const antes = W().movementsOf(s, 'PEC-001').find(m => m.id === 'MOV-015');
  const r = W().updatePart(s, 'PEC-001', { codigo: 'FLT-1001', descricao: 'Filtro de óleo', valorUnitario: '99,90', estoqueMinimo: '5', dataEntrada: '2026-08-01' });
  assert.equal(r.ok, true);
  const depois = W().movementsOf(s, 'PEC-001').find(m => m.id === 'MOV-015');
  assert.equal(depois.valorUnitario, antes.valorUnitario);
  assert.equal(depois.saldoApos, antes.saldoApos, 'histórico de saldo preservado');
});

test('cadastro de peça: validações e estoque inicial gerando movimentação', () => {
  const s = app.fresh();
  const base = { codigo: 'NOV-1', descricao: 'Peça nova', valorUnitario: '12,50', estoqueMinimo: '2', dataEntrada: '2026-10-19', quantidadeInicial: '5' };
  assert.equal(W().createPart(s, { ...base, codigo: 'flt-1001' }).ok, false, 'código duplicado sem diferença de caixa');
  assert.equal(W().createPart(s, { ...base, valorUnitario: 'abc' }).ok, false);
  const r = W().createPart(s, base);
  assert.equal(r.ok, true);
  assert.equal(W().balance(s, r.value.id), 5);
  assert.equal(s.movimentacoes.filter(m => m.pecaId === r.value.id).length, 1);
  assert.equal(W().createPart(s, { ...base, codigo: 'NOV-2', quantidadeInicial: '0' }).ok, true, 'sem estoque inicial');
});

test('entrada aumenta o saldo e aceita valor no formato brasileiro', () => {
  const s = app.fresh();
  const r = W().addEntry(s, { pecaId: 'PEC-010', quantidade: '2', data: '2026-10-19', valorUnitario: '1.450,00', responsavel: 'Rogério' });
  assert.equal(r.ok, true);
  assert.equal(r.value.valorUnitario, 1450);
  assert.equal(W().balance(s, 'PEC-010'), 6);
  assert.equal(W().addEntry(s, { pecaId: 'PEC-010', quantidade: '0', data: '2026-10-19', valorUnitario: '1', responsavel: 'x' }).ok, false);
});

test('histórico de movimentações exibe saldo acumulado em ordem cronológica', () => {
  const s = app.fresh();
  const history = W().movementsOf(s, 'PEC-001');
  assert.deepEqual(history.map(h => h.saldoApos), [30, 28, 48, 47]);
});

test('peça externa não altera o saldo do almoxarifado e entra nos custos do veículo', () => {
  const s = app.fresh();
  const before = W().balance(s, 'PEC-001');
  const r = W().registerExternalPart(s, {
    veiculoId: 'VEI-001', manutencaoId: 'MNT-0005', descricao: 'Sensor de rotação', quantidade: '1',
    valorUnitario: '320,00', data: '2026-10-19', responsavel: 'Márcia Lopes', motivo: 'Não existe no almoxarifado',
  });
  assert.equal(r.ok, true);
  assert.equal(W().balance(s, 'PEC-001'), before);
  assert.equal(W().externalParts(s, { veiculoId: 'VEI-001' }).some(e => e.descricao === 'Sensor de rotação'), true);
});

test('peça externa vinculada a manutenção fechada é recusada', () => {
  const s = app.fresh();
  const r = W().registerExternalPart(s, {
    veiculoId: 'VEI-002', manutencaoId: 'MNT-0001', descricao: 'Peça', quantidade: '1',
    valorUnitario: '10', data: '2026-10-19', responsavel: 'x',
  });
  assert.equal(r.ok, false);
});

test('filtro de estoque por situação e pesquisa por código ou descrição', () => {
  const s = app.fresh();
  const rows = W().inventory(s);
  assert.equal(W().filterInventory(rows, { situacao: 'Baixo' }).length, 2);
  assert.equal(W().filterInventory(rows, { situacao: 'Zerado' }).length, 0);
  assert.equal(W().filterInventory(rows, { termo: 'flt-1002' }).length, 1);
  assert.equal(W().filterInventory(rows, { termo: 'pneu' }).length, 1);
});
