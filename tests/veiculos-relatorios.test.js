const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const V = () => app.api('Vehicles');
const R = () => app.api('Reports');

const veiculo = (overrides = {}) => ({
  marca: 'Volvo FM 370',
  identificacao: 'FR-109',
  placa: 'DEM9I09',
  dataEntrada: '2026-10-01',
  situacao: 'Ativo',
  ...overrides,
});

test('cadastro de veículo: campos obrigatórios e formato de placa', () => {
  const s = app.fresh();
  assert.equal(V().create(s, veiculo({ marca: '' })).ok, false);
  assert.equal(V().create(s, veiculo({ identificacao: '' })).ok, false);
  assert.equal(V().create(s, veiculo({ placa: 'AB1' })).ok, false);
  assert.equal(V().create(s, veiculo({ dataEntrada: '2026-13-01' })).ok, false);
  assert.equal(V().create(s, veiculo({ situacao: 'Talvez' })).ok, false);
  assert.equal(s.veiculos.length, 8, 'nada gravado em caso de erro');
});

test('cadastro de veículo impede placa e identificação duplicadas', () => {
  const s = app.fresh();
  const dupPlaca = V().create(s, veiculo({ placa: 'dem1-a01' }));
  assert.equal(dupPlaca.ok, false);
  assert.match(dupPlaca.errors.join(' '), /placa/);
  const dupId = V().create(s, veiculo({ identificacao: ' fr-101 ' }));
  assert.equal(dupId.ok, false);
  assert.match(dupId.errors.join(' '), /identificação/);
});

test('cadastro válido gera identificador próprio e aceita placa no padrão antigo', () => {
  const s = app.fresh();
  const r = V().create(s, veiculo({ placa: 'abc-1234' }));
  assert.equal(r.ok, true);
  assert.equal(r.value.id, 'VEI-009');
  assert.equal(r.value.placa, 'ABC1234');
});

test('edição mantém o identificador e aplica as mesmas regras', () => {
  const s = app.fresh();
  assert.equal(V().update(s, 'VEI-001', { ...veiculo(), placa: 'DEM2B02' }).ok, false, 'placa de outro veículo');
  const r = V().update(s, 'VEI-001', { ...veiculo(), marca: 'Mercedes-Benz Accelo 1719', placa: 'DEM1A01', identificacao: 'FR-101', situacao: 'Inativo' });
  assert.equal(r.ok, true);
  assert.equal(r.value.id, 'VEI-001');
  assert.equal(V().find(s, 'VEI-001').situacao, 'Inativo');
});

test('filtro de veículos por pesquisa e situações', () => {
  const s = app.fresh();
  assert.equal(V().filter(s, { termo: 'volvo' }).length, 1);
  assert.equal(V().filter(s, { situacao: 'Inativo' }).length, 2);
  assert.equal(V().filter(s, { operacional: 'Em manutenção' }).length, 2);
});

test('indicadores gerais são calculados a partir dos dados', () => {
  const s = app.fresh();
  const g = R().fleetGeneral(s);
  assert.equal(g.total, 8);
  assert.equal(g.ativos, 6);
  assert.equal(g.inativos, 2);
  assert.equal(g.emManutencao, 2);
  assert.equal(g.manutencoesAbertas, 2);
  assert.equal(g.gastos, R().fleetGeneral(s).custos.total);
});

test('relatório completo: custos e gastos coerentes entre seções', () => {
  const s = app.fresh();
  const full = R().fullReport(s);
  assert.equal(full.custos.total, full.geral.gastos);
  assert.equal(full.manutencoes.quantidade, 6);
  assert.equal(full.manutencoes.abertas + full.manutencoes.emAndamento + full.manutencoes.concluidas, 6);
  assert.equal(full.almoxarifado.saldoTotal, 47 + 20 + 14 + 16 + 8 + 162 + 9 + 3 + 26 + 4);
  assert.equal(full.veiculosPorCusto[0].custoTotal >= full.veiculosPorCusto[1].custoTotal, true);
});

test('relatório completo respeita o período informado', () => {
  const s = app.fresh();
  const todo = R().fullReport(s).custos.total;
  const setembro = R().fullReport(s, { from: '2026-09-01', to: '2026-09-30' }).custos.total;
  assert.ok(setembro < todo);
  const r = R().withdrawalsReport(s, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(r.rows.length, 4, 'MOV-021 a MOV-024');
});

test('relatório de retiradas filtra por veículo e peça', () => {
  const s = app.fresh();
  assert.equal(R().withdrawalsReport(s, { veiculoId: 'VEI-002' }).rows.length, 3);
  assert.equal(R().withdrawalsReport(s, { pecaId: 'PEC-006' }).rows.length, 2);
  assert.equal(R().withdrawalsReport(s, { pecaId: 'Todas', veiculoId: 'Todos' }).rows.length, 10);
});

test('relatório do almoxarifado indica estoque baixo e valor estimado', () => {
  const s = app.fresh();
  const w = R().warehouseReport(s);
  assert.equal(w.totals.baixo, 2);
  assert.equal(w.totals.pecas, 10);
  const pneu = w.rows.find(r => r.codigo === 'PNE-8001');
  assert.equal(pneu.valorEstimado, 5800, '4 unidades x R$ 1.450,00');
});

test('exportação CSV: separador, aspas, decimal com vírgula e BOM', () => {
  const csv = R().toCsv(['Nome', 'Valor'], [['Filtro "A"; especial', 1234.5], ['Outro', 0.1]]);
  assert.equal(csv.charCodeAt(0), 0xfeff);
  const linhas = csv.slice(1).split('\r\n');
  assert.equal(linhas[0], 'Nome;Valor');
  assert.equal(linhas[1], '"Filtro ""A""; especial";1234,50');
  assert.equal(linhas[2], 'Outro;0,10');
});

test('exportação do relatório de manutenções gera uma linha por manutenção', () => {
  const s = app.fresh();
  const r = R().maintenanceReport(s);
  const csv = R().toCsv(['Código'], r.rows.map(x => [x.id]));
  assert.equal(csv.slice(1).split('\r\n').length, 1 + r.rows.length);
});
