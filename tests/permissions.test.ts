import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  can,
  defaultPathFor,
  isRole,
  roleCanAccess,
  navigationForRole,
  ROLE_DEFAULT_PATH,
} from '../src/lib/permissions';
import type { Action } from '../src/lib/permissions';
import {
  db,
  createPartRequest,
  addStockEntry,
  confirmWithdrawal,
  rejectRequest,
  finalizeWorkOrder,
  canFinalizeWorkOrder,
  getMovementsWithBalance,
} from '../src/lib/mocks';

const ALL_ACTIONS: Action[] = [
  'fleet:manage',
  'workorder:manage',
  'request:create',
  'request:process',
  'stock:entry',
  'stock:adjust',
];

type Snapshot = {
  parts: typeof db.parts;
  workOrders: typeof db.workOrders;
  partRequests: typeof db.partRequests;
  stockMovements: typeof db.stockMovements;
};

const snapshot = (): Snapshot => ({
  parts: db.parts.map(p => ({ ...p })),
  workOrders: db.workOrders.map(w => ({ ...w, services: [...w.services], items: w.items.map(i => ({ ...i })) })),
  partRequests: db.partRequests.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) })),
  stockMovements: db.stockMovements.map(m => ({ ...m })),
});

function restore(s: Snapshot) {
  db.parts.splice(0, db.parts.length, ...s.parts.map(p => ({ ...p })));
  db.workOrders.splice(0, db.workOrders.length, ...s.workOrders.map(w => ({ ...w, services: [...w.services], items: w.items.map(i => ({ ...i })) })));
  db.partRequests.splice(0, db.partRequests.length, ...s.partRequests.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) })));
  db.stockMovements.splice(0, db.stockMovements.length, ...s.stockMovements.map(m => ({ ...m })));
}

let pristine: Snapshot | null = null;
beforeEach(() => {
  if (!pristine) pristine = snapshot();
  restore(pristine);
});

test('Gestor é somente leitura: nenhuma ação operacional permitida', () => {
  for (const action of ALL_ACTIONS) {
    assert.equal(can('GESTOR', action), false, `gestor não pode ${action}`);
  }
});

test('Manutenção gerencia OS, solicita peças e frota, mas não mexe no estoque', () => {
  assert.equal(can('MANUTENCAO', 'workorder:manage'), true);
  assert.equal(can('MANUTENCAO', 'request:create'), true);
  assert.equal(can('MANUTENCAO', 'fleet:manage'), true);
  assert.equal(can('MANUTENCAO', 'stock:entry'), false);
  assert.equal(can('MANUTENCAO', 'stock:adjust'), false);
  assert.equal(can('MANUTENCAO', 'request:process'), false);
});

test('Almoxarifado movimenta estoque e processa solicitações, mas não altera OS', () => {
  assert.equal(can('ALMOXARIFADO', 'stock:entry'), true);
  assert.equal(can('ALMOXARIFADO', 'stock:adjust'), true);
  assert.equal(can('ALMOXARIFADO', 'request:process'), true);
  assert.equal(can('ALMOXARIFADO', 'workorder:manage'), false);
  assert.equal(can('ALMOXARIFADO', 'request:create'), false);
});

test('Perfil ausente ou inválido nunca tem permissão', () => {
  assert.equal(can(null, 'stock:entry'), false);
  assert.equal(can(undefined, 'workorder:manage'), false);
  assert.equal(can('ACESSO' as never, 'stock:entry'), false);
  assert.equal(isRole('ACESSO'), false);
  assert.equal(isRole('GESTOR'), true);
});

test('Caminho inicial de cada perfil e fallback', () => {
  assert.equal(defaultPathFor('GESTOR'), '/gestor');
  assert.equal(defaultPathFor('MANUTENCAO'), '/manutencao');
  assert.equal(defaultPathFor('ALMOXARIFADO'), '/almoxarifado');
  assert.equal(defaultPathFor(null), '/acesso');
  assert.equal(ROLE_DEFAULT_PATH.GESTOR, '/gestor');
});

test('Acesso por rota respeita os perfis permitidos', () => {
  assert.equal(roleCanAccess('GESTOR', ['GESTOR']), true);
  assert.equal(roleCanAccess('MANUTENCAO', ['GESTOR']), false);
  assert.equal(roleCanAccess('MANUTENCAO', ['GESTOR', 'MANUTENCAO']), true);
  assert.equal(roleCanAccess(null, ['GESTOR']), false);
});

test('Menu de cada perfil não possui links duplicados', () => {
  for (const role of ['GESTOR', 'MANUTENCAO', 'ALMOXARIFADO'] as const) {
    const hrefs = navigationForRole(role).flatMap(g => g.items.map(i => i.href));
    assert.ok(hrefs.length > 0, `${role} deve ter itens de menu`);
    assert.equal(new Set(hrefs).size, hrefs.length, `${role} não pode ter hrefs duplicados`);
  }
  assert.deepEqual(navigationForRole(null), []);
});

test('Apenas o Gestor acessa relatórios e o painel do gestor', () => {
  const gestorHrefs = navigationForRole('GESTOR').flatMap(g => g.items.map(i => i.href));
  assert.ok(gestorHrefs.includes('/relatorios/manutencao'));
  assert.ok(gestorHrefs.includes('/relatorios/estoque'));
  const manutHrefs = navigationForRole('MANUTENCAO').flatMap(g => g.items.map(i => i.href));
  assert.ok(!manutHrefs.some(h => h.startsWith('/relatorios')));
});

test('Fluxo integrado: manutenção solicita, OS trava, almoxarifado confirma e OS libera', () => {
  const wo = db.workOrders.find(w => w.id === 'OS-00120');
  assert.ok(wo);
  wo!.status = 'Aberta';

  const pendingBefore = db.partRequests.filter(r => r.status === 'Pendente').length;

  const created = createPartRequest({ workOrderId: wo!.id, items: [{ partId: 'p1', quantity: 2 }] });
  assert.equal(created.success, true);
  const req = db.partRequests[db.partRequests.length - 1];
  assert.equal(req.status, 'Pendente');
  assert.equal(wo!.status, 'Aguardando peças', 'OS aberta passa a aguardar peças');
  assert.equal(db.partRequests.filter(r => r.status === 'Pendente').length, pendingBefore + 1);

  // OS não pode ser finalizada enquanto houver solicitação aberta.
  const blocked = finalizeWorkOrder(wo!.id);
  assert.equal(blocked.success, false);
  assert.equal(canFinalizeWorkOrder(wo!.id).success, false);

  // Almoxarifado confirma: baixa estoque + cria saída + libera item e OS.
  const p1 = db.parts.find(p => p.id === 'p1')!;
  const stockBefore = p1.stock;
  const movBefore = db.stockMovements.length;
  const confirmed = confirmWithdrawal(req.id);
  assert.equal(confirmed.success, true);
  assert.equal(p1.stock, stockBefore - 2);
  assert.equal(db.stockMovements.length, movBefore + 1);
  assert.equal(req.status, 'Retirada confirmada');
  assert.equal(wo!.status, 'Em andamento');
  const item = wo!.items.find(i => i.requestId === req.id);
  assert.ok(item);
  assert.equal(item!.status, 'Retirada');

  // Sem pendências, a OS pode ser finalizada.
  const ok = finalizeWorkOrder(wo!.id);
  assert.equal(ok.success, true);
  assert.equal(wo!.status, 'Finalizada');
});

test('Fluxo integrado: recusa exige justificativa e mantém a OS bloqueada', () => {
  const wo = db.workOrders.find(w => w.id === 'OS-00120')!;
  wo.status = 'Aguardando peças';
  const created = createPartRequest({ workOrderId: wo.id, items: [{ partId: 'p6', quantity: 1 }] });
  assert.equal(created.success, true);
  const req = db.partRequests[db.partRequests.length - 1];

  // A recusa é feita por rejectRequest; sem justificativa, falha.
  assert.equal(rejectRequest(req.id, '  ').success, false);
  assert.equal(req.status, 'Pendente');
  assert.equal(finalizeWorkOrder(wo.id).success, false, 'ainda bloqueada');

  assert.equal(rejectRequest(req.id, 'Peça errada').success, true);
  assert.equal(req.status, 'Recusada');
  // Após a recusa, não há mais peças em aberto: a OS pode ser finalizada.
  assert.equal(canFinalizeWorkOrder(wo.id).success, true);
});

test('Saída e entrada aparecem no histórico com saldo recalculado', () => {
  addStockEntry('p6', 3, 'Reposição');
  const movements = getMovementsWithBalance().filter(m => m.partId === 'p6');
  const last = movements[movements.length - 1];
  assert.equal(last.type, 'Entrada');
  assert.equal(last.balance, db.parts.find(p => p.id === 'p6')!.stock);
});
