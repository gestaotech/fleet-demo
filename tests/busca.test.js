const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const S = () => app.api('Search');

test('placa exata encontra o veículo, sem diferenciar maiúsculas, espaços e hífen', () => {
  const s = app.fresh();
  const placa = s.veiculos[0].placa;
  assert.equal(S().vehicle(s, placa.toLowerCase()).id, s.veiculos[0].id);
  assert.equal(S().vehicle(s, ` ${placa.slice(0, 3)}-${placa.slice(3)} `).id, s.veiculos[0].id);
});

test('placa parcial com uma única correspondência é aceita; com mais de uma não escolhe nenhuma', () => {
  const s = app.fresh();
  s.veiculos = [
    { ...s.veiculos[0], id: 'VEI-A', placa: 'ABC1D23', situacao: 'Ativo' },
    { ...s.veiculos[0], id: 'VEI-B', placa: 'ABD9E88', situacao: 'Ativo' },
    { ...s.veiculos[0], id: 'VEI-C', placa: 'XYZ0000', situacao: 'Ativo' },
  ];
  assert.equal(S().vehicle(s, 'XYZ').id, 'VEI-C');
  const ambiguo = S().vehicle(s, 'AB');
  assert.equal(ambiguo.id, null);
  assert.equal(ambiguo.count, 2);
});

test('formulários só aceitam veículos ativos quando apenasAtivos é informado', () => {
  const s = app.fresh();
  s.veiculos[0].situacao = 'Inativo';
  const placa = s.veiculos[0].placa;
  assert.equal(S().vehicle(s, placa, { apenasAtivos: true }).id, null);
  assert.equal(S().vehicle(s, placa).id, s.veiculos[0].id);
});

test('peça por código ou descrição; descrição ambígua não escolhe peça', () => {
  const s = app.fresh();
  const primeira = s.pecas[0];
  assert.equal(S().part(s, primeira.codigo.toLowerCase()).id, primeira.id);
  const porDescricao = S().part(s, 'filtro');
  assert.ok(porDescricao.count >= 2);
  assert.equal(porDescricao.id, null);
});

test('busca vazia não encontra registro', () => {
  const s = app.fresh();
  assert.equal(S().vehicle(s, '  ').id, null);
  assert.equal(S().vehicle(s, '  ').count, 0);
  assert.equal(S().part(s, '').id, null);
  assert.equal(S().part(s, '').count, 0);
});

test('filtros: vazio ou "Todos" não filtram; texto sem correspondência mantém o texto', () => {
  const s = app.fresh();
  assert.equal(S().vehicleFilter(s, ''), 'Todos');
  assert.equal(S().vehicleFilter(s, 'todas'), 'Todos');
  assert.equal(S().vehicleFilter(s, s.veiculos[0].placa), s.veiculos[0].id);
  assert.equal(S().vehicleFilter(s, 'ZZZ9999'), 'ZZZ9999');
  assert.equal(S().partFilter(s, ''), 'Todas');
  assert.equal(S().partFilter(s, s.pecas[0].codigo), s.pecas[0].id);
});
