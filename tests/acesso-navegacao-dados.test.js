const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

/*
 * Roteamento, permissões de exibição e utilitários da interface.
 * Login, usuários e senhas não são mais tratados no navegador: estão em
 * tests/unit/usuarios-permissoes.test.js e tests/integration/api.test.js.
 */

const app = loadApp();
const A = () => app.api('Access');
const RT = () => app.api('Router');
const U = () => app.api('Utils');

const usuario = (login) => {
  const base = app.fresh().usuarios.find(u => u.login === login);
  return { id: base.id, nome: base.nome, ativo: base.ativo, permissoes: base.permissoes };
};

test('permissões de exibição seguem a lista de permissões do usuário', () => {
  const oficina = usuario('oficina');
  assert.equal(A().canAccess(oficina, 'manutencao'), true);
  assert.equal(A().canAccess(oficina, 'veiculos'), true);
  assert.equal(A().canAccess(oficina, 'combustivel'), true);
  assert.equal(A().canAccess(oficina, 'almoxarifado'), false);
  assert.equal(A().canAccess(oficina, 'admin'), false);
  assert.equal(A().canAccess(null, 'veiculos'), false);
  assert.equal(A().canAccess({ ...oficina, ativo: false }, 'manutencao'), false);
});

test('o módulo Combustível existe na lista de módulos', () => {
  assert.equal(A().MODULES.length, 6);
  assert.deepEqual([...A().MODULE_IDS], ['admin', 'almoxarifado', 'veiculos', 'manutencao', 'combustivel', 'relatorios']);
  const operador = { id: 'X', nome: 'Operador', ativo: true, permissoes: ['combustivel'] };
  assert.equal(A().canAccess(operador, 'combustivel'), true);
});

test('roteamento: página inicial, login exigido e acesso negado', () => {
  const router = RT();
  const oficina = usuario('oficina');
  assert.equal(router.resolve('#/', null).page, 'home');
  assert.equal(router.resolve('#/admin', null).kind, 'login');
  assert.equal(router.resolve('#/almoxarifado', oficina).kind, 'denied');
  assert.equal(router.resolve('#/manutencao', oficina).page, 'maintenanceList');
});

test('roteamento: subpáginas com parâmetros e precedência de rotas fixas', () => {
  const router = RT();
  const almox = usuario('almoxarifado');
  const admin = usuario('admin');
  assert.equal(router.resolve('#/almoxarifado/estoque/novo', almox).page, 'partForm');
  assert.equal(router.resolve('#/almoxarifado/estoque/entrada', almox).page, 'entryForm');
  const hist = router.resolve('#/almoxarifado/estoque/PEC-001', almox);
  assert.equal(hist.page, 'partHistory');
  assert.equal(hist.params.id, 'PEC-001');
  assert.equal(router.resolve('#/manutencao/nova', usuario('oficina')).page, 'maintenanceForm');
  assert.equal(router.resolve('#/manutencao/MNT-0005', usuario('oficina')).page, 'maintenanceDetail');
  assert.equal(router.resolve('#/veiculos/VEI-001/editar', usuario('oficina')).page, 'vehicleForm');
  assert.equal(router.resolve('#/admin/usuarios/USR-002', admin).page, 'adminUserForm');
  assert.equal(router.resolve('#/admin/usuarios/novo', admin).page, 'adminUserForm');
  assert.equal(router.resolve('#/admin/parametros', admin).page, 'adminSettings');
});

test('roteamento: combustível, trocas de óleo e novos relatórios', () => {
  const router = RT();
  const admin = usuario('admin');
  const oficina = usuario('oficina');
  assert.equal(router.resolve('#/combustivel', admin).page, 'fuelList');
  assert.equal(router.resolve('#/combustivel/novo', admin).page, 'fuelForm');
  const edicao = router.resolve('#/combustivel/ABS-0001/editar', admin);
  assert.equal(edicao.page, 'fuelForm');
  assert.equal(edicao.params.id, 'ABS-0001');
  /* A rota fixa /manutencao/oleo tem precedência sobre /manutencao/:id. */
  assert.equal(router.resolve('#/manutencao/oleo', oficina).page, 'oilList');
  assert.equal(router.resolve('#/manutencao/oleo/nova', oficina).page, 'oilForm');
  assert.equal(router.resolve('#/manutencao/oleo/OLE-0001/editar', oficina).params.id, 'OLE-0001');
  assert.equal(router.resolve('#/relatorios/combustivel', admin).page, 'reportFuel');
  assert.equal(router.resolve('#/relatorios/trocas-oleo', admin).page, 'reportOil');
  assert.equal(router.resolve('#/combustivel', usuario('almoxarifado')).kind, 'denied', 'sem permissão de combustível');
});

test('roteamento: redirecionamentos e página inexistente', () => {
  const router = RT();
  const admin = usuario('admin');
  assert.equal(router.resolve('#/almoxarifado', admin).to, '#/almoxarifado/estoque');
  assert.equal(router.resolve('#/relatorios', admin).to, '#/relatorios/geral');
  assert.equal(router.resolve('#/rota/inexistente', admin).kind, 'notFound');
});

test('navegação: todas as rotas do menu resolvem para uma página com perfil completo', () => {
  const router = RT();
  const admin = usuario('admin');
  const paths = router.ROUTES.filter(r => !r.redirect).map(r => r.path);
  for (const path of paths) {
    const concrete = path.replace(':id', 'X-1');
    const resolved = router.resolve(`#${concrete}`, admin);
    assert.ok(['page', 'login'].includes(resolved.kind), `${concrete} -> ${resolved.kind}`);
  }
  const resolvedMenus = ['#/admin', '#/almoxarifado', '#/veiculos', '#/manutencao', '#/relatorios'].map(h => router.resolve(h, admin).kind);
  assert.deepEqual(resolvedMenus, ['page', 'redirect', 'page', 'page', 'redirect']);
});

test('utilitários: valores em reais, datas e identificadores', () => {
  const u = U();
  assert.equal(u.parseMoney('1.450,00'), 1450);
  assert.equal(u.parseMoney('1450,5'), 1450.5);
  assert.equal(u.parseMoney('1.450'), 1450, 'ponto de milhar com três dígitos');
  assert.equal(u.parseMoney('12.5'), 12.5);
  assert.ok(Number.isNaN(u.parseMoney('-3')));
  assert.ok(Number.isNaN(u.parseMoney('abc')));
  assert.equal(u.formatMoney(1450).replace(/\s/g, ' ').includes('1.450,00'), true);
  assert.equal(u.isValidDate('2026-02-29'), false, '2026 não é bissexto');
  assert.equal(u.isValidDate('2028-02-29'), true);
  assert.equal(u.nextId('VEI', [{ id: 'VEI-001' }, { id: 'VEI-007' }], 3), 'VEI-008');
  assert.equal(u.inPeriod('2026-09-15T10:00', '2026-09-15', '2026-09-15'), true);
});
