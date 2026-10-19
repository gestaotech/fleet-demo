const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const M = () => app.api('Maintenance');
const C = () => app.api('Costs');
const V = () => app.api('Vehicles');
const W = () => app.api('Warehouse');

const abertura = (overrides = {}) => ({
  veiculoId: 'VEI-004',
  dataEntrada: '2026-10-19T09:00',
  descricaoProblema: 'Barulho na suspensão dianteira',
  observacoes: '',
  responsavel: 'Márcia Lopes',
  ...overrides,
});

test('abertura cria manutenção Aberta com identificador próprio e histórico', () => {
  const s = app.fresh();
  const r = M().open(s, abertura());
  assert.equal(r.ok, true);
  assert.equal(r.value.id, 'MNT-0007');
  assert.equal(r.value.status, 'Aberta');
  assert.equal(r.value.historico.length, 1);
});

test('abertura exige veículo ativo, problema, responsável e data e hora válidas', () => {
  const s = app.fresh();
  assert.equal(M().open(s, abertura({ veiculoId: 'VEI-007' })).ok, false, 'inativo');
  assert.equal(M().open(s, abertura({ veiculoId: 'INEXISTENTE' })).ok, false);
  assert.equal(M().open(s, abertura({ descricaoProblema: '' })).ok, false);
  assert.equal(M().open(s, abertura({ responsavel: '' })).ok, false);
  assert.equal(M().open(s, abertura({ dataEntrada: '2026-10-19' })).ok, false, 'sem hora');
  assert.equal(s.manutencoes.length, 6, 'nenhuma manutenção criada em caso de erro');
});

test('situação operacional muda com a manutenção, mas a cadastral permanece', () => {
  const s = app.fresh();
  assert.equal(V().operationalStatus(s, 'VEI-004'), 'Disponível');
  const r = M().open(s, abertura());
  assert.equal(V().operationalStatus(s, 'VEI-004'), 'Em manutenção');
  assert.equal(V().find(s, 'VEI-004').situacao, 'Ativo');
  M().conclude(s, r.value.id, { dataConclusao: '2026-10-19T17:00' });
  assert.equal(V().operationalStatus(s, 'VEI-004'), 'Disponível');
  assert.equal(V().find(s, 'VEI-004').situacao, 'Ativo', 'concluir não altera o cadastro');
});

test('veículo com duas manutenções abertas só volta a Disponível após concluir ambas', () => {
  const s = app.fresh();
  const a = M().open(s, abertura({ veiculoId: 'VEI-002' }));
  const b = M().open(s, abertura({ veiculoId: 'VEI-002', dataEntrada: '2026-10-19T10:00' }));
  M().conclude(s, a.value.id, { dataConclusao: '2026-10-19T12:00' });
  assert.equal(V().operationalStatus(s, 'VEI-002'), 'Em manutenção');
  M().conclude(s, b.value.id, { dataConclusao: '2026-10-19T13:00' });
  assert.equal(V().operationalStatus(s, 'VEI-002'), 'Disponível');
});

test('iniciar só funciona a partir de Aberta', () => {
  const s = app.fresh();
  assert.equal(M().start(s, 'MNT-0005').value.status, 'Em andamento');
  assert.equal(M().start(s, 'MNT-0005').ok, false, 'já em andamento');
  assert.equal(M().start(s, 'MNT-0001').ok, false, 'concluída');
});

test('conclusão não pode ser anterior à entrada e não se repete', () => {
  const s = app.fresh();
  assert.equal(M().conclude(s, 'MNT-0005', { dataConclusao: '2026-10-05T10:00' }).ok, false);
  assert.equal(M().conclude(s, 'MNT-0005', { dataConclusao: 'ontem' }).ok, false);
  assert.equal(M().conclude(s, 'MNT-0005', { dataConclusao: '2026-10-07T10:00' }).ok, true);
  assert.equal(M().conclude(s, 'MNT-0005', { dataConclusao: '2026-10-08T10:00' }).ok, false, 'já concluída');
});

test('após concluir, peças, peças externas e despesas são recusadas', () => {
  const s = app.fresh();
  assert.equal(M().registerWithdrawal(s, 'MNT-0001', { pecaId: 'PEC-006', quantidade: '1', data: '2026-10-19', responsavel: 'x' }).ok, false);
  assert.equal(M().registerExternalPart(s, 'MNT-0001', { descricao: 'x', quantidade: '1', valorUnitario: '1', data: '2026-10-19', responsavel: 'x' }).ok, false);
  assert.equal(M().registerExpense(s, 'MNT-0001', { descricao: 'x', valor: '10', data: '2026-10-19' }).ok, false);
});

test('retirada na manutenção baixa o estoque uma única vez e entra no custo uma única vez', () => {
  const s = app.fresh();
  const costBefore = C().maintenanceCosts(s, 'MNT-0005').total;
  const vehicleBefore = C().vehicleCosts(s, 'VEI-001').total;
  const stockBefore = W().balance(s, 'PEC-009');

  const r = M().registerWithdrawal(s, 'MNT-0005', { pecaId: 'PEC-009', quantidade: '2', data: '2026-10-19', responsavel: 'Rogério Santana' });
  assert.equal(r.ok, true);
  assert.equal(W().balance(s, 'PEC-009'), stockBefore - 2);
  const valorRetirada = 2 * W().findPart(s, 'PEC-009').valorUnitario;
  assert.equal(C().maintenanceCosts(s, 'MNT-0005').total, costBefore + valorRetirada, 'usa o valor vigente da peça');
  assert.equal(C().vehicleCosts(s, 'VEI-001').total, vehicleBefore + valorRetirada);
  assert.equal(s.manutencoes.find(m => m.id === 'MNT-0005').historico.at(-1).texto.includes('Lâmpada H4'), true);
});

test('peça externa e despesa na manutenção aparecem nos custos sem duplicidade', () => {
  const s = app.fresh();
  M().registerExternalPart(s, 'MNT-0005', { descricao: 'Sensor', quantidade: '2', valorUnitario: '100', data: '2026-10-19', responsavel: 'x' });
  M().registerExpense(s, 'MNT-0005', { descricao: 'Teste de compressão', valor: '150,50', data: '2026-10-19' });
  const costs = C().maintenanceCosts(s, 'MNT-0005');
  assert.equal(costs.pecasExternas, 200);
  assert.equal(costs.outrasDespesas, 120 + 150.5);
  assert.equal(costs.total, Math.round((costs.pecasAlmoxarifado + 200 + 270.5) * 100) / 100);
});

test('custos de referência da demonstração (conferidos manualmente)', () => {
  const s = app.fresh();
  assert.equal(C().maintenanceCosts(s, 'MNT-0001').total, 583, 'peças 403 + mão de obra 180');
  assert.equal(C().vehicleCosts(s, 'VEI-002').total, 673, 'retiradas 104 + 299 + 90 (direta) + despesa 180');
  assert.equal(C().vehicleCosts(s, 'VEI-006').total, 696, 'peças 109 + 252 + externa 245 + despesa 90');
});

test('soma dos custos por veículo bate com o total da frota (nenhum custo contado duas vezes)', () => {
  const s = app.fresh();
  const soma = s.veiculos.reduce((acc, v) => acc + C().vehicleCosts(s, v.id).total, 0);
  assert.equal(Math.round(soma * 100) / 100, C().fleetCosts(s).total);
});

test('filtro de manutenções por veículo, situação e período de entrada', () => {
  const s = app.fresh();
  assert.equal(M().list(s, { veiculoId: 'VEI-002' }).length, 1);
  assert.equal(M().list(s, { status: 'Em andamento' }).map(m => m.id).join(), 'MNT-0006');
  assert.equal(M().list(s, { from: '2026-09-01', to: '2026-09-30' }).length, 2);
});
