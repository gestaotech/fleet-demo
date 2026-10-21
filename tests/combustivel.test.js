const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const F = () => app.api('Fuel');
const V = () => app.api('Vehicles');

const abastecimento = (overrides = {}) => ({
  veiculoId: 'VEI-004',
  dataHora: '2026-10-19T08:00',
  quilometragem: '31200',
  litros: '80',
  valorTotal: '488,00',
  precoLitro: '',
  posto: 'Posto Central',
  responsavel: 'Juliana Prado',
  observacao: '',
  tanqueCheio: true,
  ...overrides,
});

test('registro de abastecimento calcula o preço por litro a partir do valor total', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento());
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.equal(result.value.id, 'ABS-0017');
  assert.equal(result.value.precoLitro, 6.1);
  assert.equal(result.value.valorTotal, 488);
  assert.equal(result.value.litros, 80);
});

test('preço por litro informado calcula o valor total quando só ele foi digitado', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento({ valorTotal: '', precoLitro: '6,259', litros: '80' }));
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.equal(result.value.valorTotal, 500.72);
  assert.equal(result.value.precoLitro, 6.259);
});

test('valor total e preço por litro divergentes são recusados juntos', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento({ valorTotal: '488,00', precoLitro: '5,000' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /divergem/i);
});

test('valor e preço por litro coerentes são aceitos e arredondam o preço', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento({ valorTotal: '500,00', precoLitro: '6,25' }));
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.equal(result.value.precoLitro, 6.25);
});

test('abastecimento exige veículo, data e hora, litros, valor, posto e responsável', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento({
    veiculoId: '', dataHora: '', litros: '0', valorTotal: '', precoLitro: '', posto: '', responsavel: '',
  }));
  assert.equal(result.ok, false);
  const texto = result.errors.join(' ');
  assert.match(texto, /veículo/i);
  assert.match(texto, /data e a hora/i);
  assert.match(texto, /litros maior que zero/i);
  assert.match(texto, /valor total pago ou o preço por litro/i);
  assert.match(texto, /posto/i);
  assert.match(texto, /responsável/i);
});

test('quilometragem não pode diminuir em relação ao abastecimento anterior', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento({ quilometragem: '30000' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /não pode ser menor/i);
});

test('veículo inativo não recebe novo abastecimento', () => {
  const s = app.fresh();
  const result = F().create(s, abastecimento({ veiculoId: 'VEI-007' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /inativo/i);
});

test('edição corrige um abastecimento mantendo o identificador', () => {
  const s = app.fresh();
  const result = F().update(s, 'ABS-0005', abastecimento({ quilometragem: '50200', litros: '150', valorTotal: '930,00' }));
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.equal(result.value.id, 'ABS-0005');
  assert.equal(result.value.quilometragem, 50200);
  assert.equal(result.value.precoLitro, 6.2);
});

test('consumo médio usa o método de tanque cheio e ignora abastecimento parcial como limite', () => {
  const s = app.fresh();
  const consumo = F().consumption(s, 'VEI-001');
  assert.equal(consumo.suficiente, true);
  assert.equal(consumo.segmentos.length, 3);
  /* 48000->48540 (150 L), 48540->49095 (155 L), 49095->49640 (160 L) */
  assert.equal(consumo.distancia, 1640);
  assert.equal(consumo.litros, 465);
  assert.equal(consumo.media, 3.53);
});

test('consumo fica indisponível sem dois tanques cheios', () => {
  const s = app.fresh();
  const consumo = F().consumption(s, 'VEI-005');
  assert.equal(consumo.suficiente, false);
  assert.equal(consumo.media, null);
  assert.equal(consumo.tanquesCheios, 1);
});

test('consumo ignora intervalo com quilometragem inválida e informa dados insuficientes', () => {
  const s = app.fresh();
  /* Registro inserido diretamente simulando base antiga com km fora de ordem. */
  s.abastecimentos.push({
    id: 'ABS-9000', veiculoId: 'VEI-005', dataHora: '2026-10-10T08:00', quilometragem: 118000,
    litros: 200, valorTotal: 1200, precoLitro: 6, posto: 'Posto Rodovia',
    responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true,
  });
  const consumo = F().consumption(s, 'VEI-005');
  assert.equal(consumo.suficiente, false);
  assert.equal(consumo.media, null);
  assert.equal(consumo.ignorados, 1);
});

test('resumo de combustível soma litros, valor e preço médio', () => {
  const s = app.fresh();
  const resumo = F().summary(s, { veiculoId: 'VEI-004' });
  assert.equal(resumo.registros, 2);
  assert.equal(resumo.litros, 175);
  assert.equal(resumo.valor, 1067.5);
  assert.equal(resumo.precoMedio, 6.1);
});

test('lista de abastecimentos filtra por veículo e período', () => {
  const s = app.fresh();
  assert.equal(F().list(s, { veiculoId: 'VEI-002' }).length, 4);
  assert.equal(F().list(s, { from: '2026-09-01', to: '2026-09-30' }).length, 6);
});

test('quilometragem atual do veículo é a maior registrada entre os módulos', () => {
  const s = app.fresh();
  assert.equal(V().currentKm(s, 'VEI-001'), 50180);
  assert.equal(V().currentKm(s, 'VEI-006'), 150980);
  assert.equal(V().currentKm(s, 'VEI-007'), null);
});
