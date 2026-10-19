const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const A = () => app.api('Access');
const RT = () => app.api('Router');
const S = () => app.api('Storage');
const U = () => app.api('Utils');

const usuario = (login) => app.fresh().usuarios.find(u => u.login === login);

test('login: credenciais corretas, senha errada e usuário inativo', () => {
  const s = app.fresh();
  assert.equal(A().authenticate(s, 'admin', 'demo123').ok, true);
  assert.equal(A().authenticate(s, 'ADMIN', 'demo123').ok, true, 'usuário sem diferença de caixa');
  assert.equal(A().authenticate(s, 'admin', 'errada').ok, false);
  assert.equal(A().authenticate(s, 'juliana', 'demo123').ok, false, 'inativo');
});

test('permissões por módulo seguem a configuração de cada usuário', () => {
  const oficina = usuario('oficina');
  assert.equal(A().canAccess(oficina, 'manutencao'), true);
  assert.equal(A().canAccess(oficina, 'veiculos'), true);
  assert.equal(A().canAccess(oficina, 'almoxarifado'), false);
  assert.equal(A().canAccess(oficina, 'admin'), false);
  assert.equal(A().canAccess(null, 'veiculos'), false);
  assert.equal(A().canAccess({ ...oficina, ativo: false }, 'manutencao'), false);
});

test('usuário: validações de cadastro e senha obrigatória apenas na criação', () => {
  const s = app.fresh();
  assert.equal(A().saveUser(s, { nome: 'Ab', cargo: 'x', login: 'novo', senha: 'segredo1', ativo: true, permissoes: [] }).ok, false, 'nome curto');
  assert.equal(A().saveUser(s, { nome: 'Novo Usuário', cargo: 'x', login: 'novo', senha: '', ativo: true, permissoes: [] }).ok, false, 'senha obrigatória');
  assert.equal(A().saveUser(s, { nome: 'Novo Usuário', cargo: 'x', login: 'admin', senha: 'segredo1', ativo: true, permissoes: [] }).ok, false, 'login duplicado');
  assert.equal(A().saveUser(s, { nome: 'Novo Usuário', cargo: 'x', login: 'novo', senha: '123', ativo: true, permissoes: [] }).ok, false, 'senha curta');
  const ok = A().saveUser(s, { nome: 'Novo Usuário', cargo: 'Operador', login: 'novo', senha: 'segredo1', ativo: true, permissoes: ['veiculos', 'modulo-falso'] });
  assert.equal(ok.ok, true);
  assert.deepEqual([...ok.value.permissoes], ['veiculos'], 'permissões desconhecidas são descartadas');
  const edit = A().saveUser(s, { nome: 'Novo Usuário', cargo: 'Operador', login: 'novo', senha: '', ativo: true, permissoes: ['veiculos'] }, ok.value.id);
  assert.equal(edit.ok, true, 'edição sem senha mantém a senha atual');
  assert.equal(s.usuarios.find(u => u.id === ok.value.id).senha, 'segredo1');
});

test('sempre resta ao menos um administrador ativo', () => {
  const s = app.fresh();
  assert.equal(A().setUserActive(s, 'USR-001', false).ok, false, 'último administrador');
  assert.equal(A().saveUser(s, { nome: 'Administrador da Demonstração', cargo: 'Administrador', login: 'admin', senha: '', ativo: true, permissoes: ['veiculos'] }, 'USR-001').ok, false, 'remover permissão do último administrador');

  const novo = A().saveUser(s, { nome: 'Segundo Admin', cargo: 'Administrador', login: 'admin2', senha: 'segredo1', ativo: true, permissoes: ['admin'] });
  assert.equal(novo.ok, true);
  assert.equal(A().setUserActive(s, 'USR-001', false).ok, true, 'há outro administrador ativo');
  assert.equal(A().setUserActive(s, novo.value.id, false).ok, false, 'agora é o último');
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

test('persistência: salvar, recarregar e restaurar os dados originais', () => {
  const storage = S();
  const seed = app.api('DemoData').createSeed();
  assert.equal(storage.load().veiculos.length, seed.veiculos.length, 'sem dados salvos, usa o original');

  const s = storage.load();
  s.veiculos[0].marca = 'Alterado na demonstração';
  assert.equal(storage.save(s).ok, true);
  assert.equal(storage.load().veiculos[0].marca, 'Alterado na demonstração', 'alteração persiste entre cargas');

  const restored = storage.restoreSeed();
  assert.equal(restored.veiculos[0].marca, seed.veiculos[0].marca);
  assert.equal(storage.load().veiculos[0].marca, seed.veiculos[0].marca, 'restauração remove a versão salva');
});

test('persistência: dados corrompidos ou de outra versão voltam ao conjunto original', () => {
  const storage = S();
  app.sandbox.localStorage.setItem('gestaotech.frota-demo.dados.v1', '{não é json');
  assert.equal(storage.load().veiculos.length, 8);
  app.sandbox.localStorage.setItem('gestaotech.frota-demo.dados.v1', JSON.stringify({ schemaVersion: 99, veiculos: [] }));
  assert.equal(storage.load().veiculos.length, 8);
  app.sandbox.localStorage.removeItem('gestaotech.frota-demo.dados.v1');
});

test('sessão: login e logout guardam apenas o identificador do usuário', () => {
  const storage = S();
  storage.saveSession('USR-002');
  assert.equal(storage.readSession(), 'USR-002');
  storage.clearSession();
  assert.equal(storage.readSession(), null);
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
