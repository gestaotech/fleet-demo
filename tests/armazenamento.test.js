const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const S = () => app.api('Storage');
const D = () => app.api('DemoData');

/* Monta um estado no formato antigo (schemaVersion 1), como ficaria salvo em um navegador já usado. */
function estadoV1() {
  const base = JSON.parse(JSON.stringify(D().createSeed()));
  delete base.abastecimentos;
  delete base.trocasOleo;
  delete base.configuracoes;
  base.manutencoes.forEach(m => { delete m.quilometragem; });
  base.usuarios.forEach(u => { u.permissoes = u.permissoes.filter(p => p !== 'combustivel'); });
  base.schemaVersion = 1;
  base.pecas.push({ id: 'PEC-900', codigo: 'PEC-900', descricao: 'Peça criada pelo usuário', valorUnitario: 10, estoqueMinimo: 0, dataEntrada: '2026-10-01' });
  return base;
}

test('schema atual da demonstração é a versão 2', () => {
  assert.equal(D().SCHEMA_VERSION, 2);
});

function salvarEVolver(sandbox, estado) {
  sandbox.localStorage.setItem('gestaotech.frota-demo.dados.v1', JSON.stringify(estado));
}

test('dados salvos na versão 1 são migrados sem perder registros', () => {
  const estado = estadoV1();
  salvarEVolver(app.sandbox, estado);
  const carregado = S().load();
  assert.equal(carregado.schemaVersion, 2);
  assert.equal(carregado.abastecimentos.length, 0);
  assert.equal(carregado.trocasOleo.length, 0);
  assert.equal(carregado.configuracoes.alertaTrocaOleoKm, 1000);
  assert.equal(carregado.manutencoes.length, estado.manutencoes.length);
  assert.ok(carregado.manutencoes.every(m => 'quilometragem' in m));
  assert.ok(carregado.pecas.some(p => p.id === 'PEC-900'), 'peça criada pelo usuário foi preservada');
  assert.equal(carregado.veiculos.length, estado.veiculos.length);
});

test('migração libera o módulo de combustível para administradores ativos', () => {
  const estado = estadoV1();
  salvarEVolver(app.sandbox, estado);
  const carregado = S().load();
  const admin = carregado.usuarios.find(u => u.id === 'USR-001');
  assert.ok(admin.permissoes.includes('combustivel'));
  const almoxarife = carregado.usuarios.find(u => u.id === 'USR-002');
  assert.ok(!almoxarife.permissoes.includes('combustivel'), 'permissões específicas não são ampliadas');
});

test('migração é persistida no armazenamento', () => {
  const estado = estadoV1();
  salvarEVolver(app.sandbox, estado);
  S().load();
  const salvo = JSON.parse(app.sandbox.localStorage.getItem('gestaotech.frota-demo.dados.v1'));
  assert.equal(salvo.schemaVersion, 2);
  assert.ok(Array.isArray(salvo.abastecimentos));
});

test('estrutura corrompida volta ao conjunto original sem lançar erro', () => {
  app.sandbox.localStorage.setItem('gestaotech.frota-demo.dados.v1', '{invalido');
  const carregado = S().load();
  assert.equal(carregado.schemaVersion, 2);
  assert.equal(carregado.abastecimentos.length, 16);
});

test('estrutura válida porém desconhecida (versão futura não migrável) volta ao original', () => {
  const estado = estadoV1();
  delete estado.pecas;
  estado.schemaVersion = 99;
  salvarEVolver(app.sandbox, estado);
  const carregado = S().load();
  assert.equal(carregado.pecas.length, 10, 'conjunto original restaurado');
});

test('restaurar dados originais limpa o armazenamento e devolve a semente', () => {
  salvarEVolver(app.sandbox, estadoV1());
  const seed = S().restoreSeed();
  assert.equal(seed.schemaVersion, 2);
  assert.equal(app.sandbox.localStorage.getItem('gestaotech.frota-demo.dados.v1'), null);
});
