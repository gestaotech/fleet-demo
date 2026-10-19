const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const W = () => app.api('Warehouse');
const V = () => app.api('Vehicles');

test('dados: identificadores são únicos', () => {
  const s = app.fresh();
  const unique = list => new Set(list).size === list.length;
  assert.ok(unique(s.veiculos.map(v => v.id)));
  assert.ok(unique(s.veiculos.map(v => v.placa)));
  assert.ok(unique(s.veiculos.map(v => v.identificacao)));
  assert.ok(unique(s.pecas.map(p => p.codigo)));
  assert.ok(unique(s.usuarios.map(u => u.login)));
  assert.ok(unique(s.movimentacoes.map(m => m.id)));
  assert.ok(unique(s.manutencoes.map(m => m.id)));
});

test('dados: todas as referências entre módulos existem e são coerentes', () => {
  const s = app.fresh();
  const vehicleIds = new Set(s.veiculos.map(v => v.id));
  const partIds = new Set(s.pecas.map(p => p.id));
  const maintenance = new Map(s.manutencoes.map(m => [m.id, m]));

  for (const m of s.movimentacoes) {
    assert.ok(partIds.has(m.pecaId), `peça ${m.pecaId} em ${m.id}`);
    if (m.veiculoId) assert.ok(vehicleIds.has(m.veiculoId), `veículo em ${m.id}`);
    if (m.manutencaoId) {
      const linked = maintenance.get(m.manutencaoId);
      assert.ok(linked, `manutenção em ${m.id}`);
      assert.equal(linked.veiculoId, m.veiculoId, `veículo da retirada ${m.id} deve ser o da manutenção`);
    }
  }
  for (const e of s.pecasExternas) {
    assert.ok(vehicleIds.has(e.veiculoId), `veículo em ${e.id}`);
    if (e.manutencaoId) assert.equal(maintenance.get(e.manutencaoId).veiculoId, e.veiculoId);
  }
  for (const d of s.despesas) assert.ok(maintenance.has(d.manutencaoId), `manutenção em ${d.id}`);
  for (const m of s.manutencoes) assert.ok(vehicleIds.has(m.veiculoId));
});

test('dados: saldo nunca fica negativo ao longo do histórico e fecha com o saldo atual', () => {
  const s = app.fresh();
  for (const p of s.pecas) {
    const history = app.api('Warehouse').movementsOf(s, p.id);
    for (const row of history) assert.ok(row.saldoApos >= 0, `saldo negativo em ${p.id}`);
    const last = history.length ? history[history.length - 1].saldoApos : 0;
    assert.equal(last, app.api('Warehouse').balance(s, p.id));
  }
});

test('dados: saldos conferidos manualmente a partir das movimentações', () => {
  const s = app.fresh();
  const esperado = {
    'PEC-001': 47, 'PEC-002': 20, 'PEC-003': 14, 'PEC-004': 16, 'PEC-005': 8,
    'PEC-006': 162, 'PEC-007': 9, 'PEC-008': 3, 'PEC-009': 26, 'PEC-010': 4,
  };
  for (const [id, saldo] of Object.entries(esperado)) {
    assert.equal(W().balance(s, id), saldo, `saldo de ${id}`);
  }
});

test('dados: indicadores da frota e estoque baixo', () => {
  const s = app.fresh();
  assert.deepEqual(JSON.parse(JSON.stringify(V().summary(s))), { total: 8, ativos: 6, inativos: 2, emManutencao: 2 });
  const baixos = W().inventory(s).filter(r => r.baixo).map(r => r.id).sort();
  assert.deepEqual(baixos, ['PEC-005', 'PEC-010']);
});

test('dados: são fictícios e identificados como demonstração', () => {
  const s = app.fresh();
  for (const v of s.veiculos) assert.ok(v.placa.startsWith('DEM'), `placa ${v.placa} deve ser fictícia`);
  const admin = s.usuarios.find(u => u.login === 'admin');
  assert.ok(admin && admin.ativo && admin.permissoes.includes('admin'));
});
