const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const V = () => app.api('Vehicles');

const novo = (overrides = {}) => ({
  marca: 'Volvo FH',
  identificacao: 'CAM-900',
  placa: 'KMT1A23',
  dataEntrada: '2026-03-10',
  situacao: 'Ativo',
  quilometragemCadastro: '',
  ...overrides,
});

test('quilometragem do cadastro é opcional', () => {
  const s = app.fresh();
  const result = V().create(s, novo());
  assert.equal(result.ok, true);
  assert.equal(result.value.quilometragemCadastro, null);
});

test('quilometragem do cadastro aceita número inteiro e vira a quilometragem atual sem outros registros', () => {
  const s = app.fresh();
  const result = V().create(s, novo({ quilometragemCadastro: '125000' }));
  assert.equal(result.ok, true);
  assert.equal(result.value.quilometragemCadastro, 125000);
  assert.equal(V().currentKm(s, result.value.id), 125000);
  assert.equal(V().currentKmSource(s, result.value.id).origem, 'Cadastro do veículo');
});

test('quilometragem do cadastro inválida é recusada', () => {
  const s = app.fresh();
  assert.equal(V().create(s, novo({ quilometragemCadastro: 'abc' })).ok, false);
  assert.equal(V().create(s, novo({ quilometragemCadastro: '-5' })).ok, false);
  assert.equal(V().create(s, novo({ quilometragemCadastro: '10,5' })).ok, false);
});

test('registros de abastecimento com quilometragem maior prevalecem sobre o cadastro', () => {
  const s = app.fresh();
  const result = V().create(s, novo({ quilometragemCadastro: '1000' }));
  s.abastecimentos.push({ id: 'ABS-X', veiculoId: result.value.id, dataHora: '2026-04-01T10:00', quilometragem: 5000, litros: 100 });
  assert.equal(V().currentKm(s, result.value.id), 5000);
  assert.equal(V().currentKmSource(s, result.value.id).origem, 'Abastecimento');
});

test('edição altera ou limpa a quilometragem do cadastro', () => {
  const s = app.fresh();
  const result = V().create(s, novo({ quilometragemCadastro: '2000' }));
  assert.equal(V().update(s, result.value.id, novo({ quilometragemCadastro: '3000' })).value.quilometragemCadastro, 3000);
  assert.equal(V().update(s, result.value.id, novo({ quilometragemCadastro: '' })).value.quilometragemCadastro, null);
});
