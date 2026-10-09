import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  db,
  confirmWithdrawal,
  rejectRequest,
  addStockEntry,
  adjustStock,
  getMovementsWithBalance,
} from '../src/lib/mocks';

type RequestStatus = (typeof db.partRequests)[number]['status'];
type Snapshot = {
  parts: typeof db.parts;
  workOrders: typeof db.workOrders;
  partRequests: typeof db.partRequests;
  stockMovements: typeof db.stockMovements;
};

const cloneParts = () => db.parts.map(p => ({ ...p }));
const cloneWorkOrders = () =>
  db.workOrders.map(w => ({ ...w, services: [...w.services], items: w.items.map(i => ({ ...i })) }));
const cloneRequests = () => db.partRequests.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) }));
const cloneMovements = () => db.stockMovements.map(m => ({ ...m }));

function snapshot(): Snapshot {
  return {
    parts: cloneParts(),
    workOrders: cloneWorkOrders(),
    partRequests: cloneRequests(),
    stockMovements: cloneMovements(),
  };
}

function restore(s: Snapshot) {
  db.parts.splice(0, db.parts.length, ...s.parts.map(p => ({ ...p })));
  db.workOrders.splice(
    0,
    db.workOrders.length,
    ...s.workOrders.map(w => ({ ...w, services: [...w.services], items: w.items.map(i => ({ ...i })) }))
  );
  db.partRequests.splice(0, db.partRequests.length, ...s.partRequests.map(r => ({ ...r, items: r.items.map(i => ({ ...i })) })));
  db.stockMovements.splice(0, db.stockMovements.length, ...s.stockMovements.map(m => ({ ...m })));
}

let pristine: Snapshot | null = null;

beforeEach(() => {
  if (!pristine) pristine = snapshot();
  restore(pristine);
});

const part = (id: string) => {
  const p = db.parts.find(x => x.id === id);
  if (!p) throw new Error(`part ${id} not found`);
  return p;
};

const workOrder = (id: string) => {
  const w = db.workOrders.find(x => x.id === id);
  if (!w) throw new Error(`work order ${id} not found`);
  return w;
};

const movementsFor = (partId: string) => db.stockMovements.filter(m => m.partId === partId);

function makeRequest(partial: {
  id: string;
  workOrderId: string;
  items: { partId: string; quantity: number }[];
  status?: RequestStatus;
}) {
  const wo = workOrder(partial.workOrderId);
  const req = {
    id: partial.id,
    workOrderId: partial.workOrderId,
    vehicleId: wo.vehicleId,
    requesterId: wo.mechanicId,
    items: partial.items.map(i => ({ ...i })),
    status: partial.status ?? ('Pendente' as RequestStatus),
    createdAt: new Date().toISOString(),
  };
  db.partRequests.push(req);
  for (const item of req.items) {
    wo.items.push({ partId: item.partId, quantity: item.quantity, status: 'Solicitada', requestId: req.id });
  }
  return req;
}

test('A — retirada normal baixa estoque, cria uma saída e atualiza a OS', () => {
  const wo = workOrder('OS-00117');
  wo.status = 'Aguardando peças';
  const p1 = part('p1');
  const before = p1.stock;
  const saidasBefore = movementsFor('p1').filter(m => m.type === 'Saída').length;

  const req = makeRequest({ id: 'REQ-TEST-A', workOrderId: wo.id, items: [{ partId: 'p1', quantity: 2 }] });
  const result = confirmWithdrawal(req.id);

  assert.equal(result.success, true);
  assert.equal(before, 18);
  assert.equal(p1.stock, 16);

  const saída = movementsFor('p1').find(m => m.observation === `Retirada da solicitação ${req.id}`);
  assert.ok(saída, 'deve existir a movimentação de saída da solicitação');
  assert.equal(saída.quantity, -2);
  assert.equal(saída.origin, wo.id);
  assert.equal(movementsFor('p1').filter(m => m.type === 'Saída').length, saidasBefore + 1);

  assert.equal(req.status, 'Retirada confirmada');
  const item = wo.items.find(i => i.requestId === req.id && i.partId === 'p1');
  assert.ok(item);
  assert.equal(item.status, 'Retirada');
  assert.equal(wo.status, 'Em andamento');
});

test('B — confirmação duplicada não gera segunda baixa nem duplica item', () => {
  const wo = workOrder('OS-00117');
  const p1 = part('p1');
  const req = makeRequest({ id: 'REQ-TEST-B', workOrderId: wo.id, items: [{ partId: 'p1', quantity: 2 }] });

  assert.equal(confirmWithdrawal(req.id).success, true);
  const stockAfter = p1.stock;
  const movCount = db.stockMovements.length;
  const itemCount = wo.items.filter(i => i.requestId === req.id).length;

  const second = confirmWithdrawal(req.id);
  assert.equal(second.success, false);
  assert.equal(p1.stock, stockAfter);
  assert.equal(db.stockMovements.length, movCount);
  assert.equal(wo.items.filter(i => i.requestId === req.id).length, itemCount);
});

test('C — estoque insuficiente rejeita e mantém todos os dados inalterados', () => {
  const wo = workOrder('OS-00117');
  const p20 = part('p20');
  const movCount = db.stockMovements.length;
  const req = makeRequest({ id: 'REQ-TEST-C', workOrderId: wo.id, items: [{ partId: 'p20', quantity: 5 }] });
  const itemsCount = wo.items.length;

  const result = confirmWithdrawal(req.id);
  assert.equal(result.success, false);
  assert.equal(p20.stock, 1);
  assert.equal(db.stockMovements.length, movCount);
  assert.equal(wo.items.length, itemsCount);
  assert.equal(req.status, 'Pendente');
});

test('D — peça repetida é agrupada e validada pelo total', () => {
  const wo = workOrder('OS-00117');
  const p3 = part('p3');
  const req = makeRequest({
    id: 'REQ-TEST-D',
    workOrderId: wo.id,
    items: [{ partId: 'p3', quantity: 2 }, { partId: 'p3', quantity: 3 }],
  });

  const result = confirmWithdrawal(req.id);
  assert.equal(result.success, true);
  assert.equal(p3.stock, 10);
  const saidas = movementsFor('p3').filter(m => m.observation === `Retirada da solicitação ${req.id}`);
  assert.equal(saidas.length, 1);
  assert.equal(saidas[0].quantity, -5);

  // Total agrupado acima do saldo deve falhar sem mutação.
  const p4 = part('p4');
  const stockBefore = p4.stock;
  const req2 = makeRequest({
    id: 'REQ-TEST-D2',
    workOrderId: wo.id,
    items: [{ partId: 'p4', quantity: 2 }, { partId: 'p4', quantity: 2 }],
  });
  assert.equal(confirmWithdrawal(req2.id).success, false);
  assert.equal(p4.stock, stockBefore);
  assert.equal(req2.status, 'Pendente');
});

test('E — entrada com observação atualiza estoque e preserva a observação', () => {
  const p6 = part('p6');
  const result = addStockEntry('p6', 5, 'Compra emergencial');
  assert.equal(result.success, true);
  assert.equal(p6.stock, 11);

  const mov = db.stockMovements.find(m => m.partId === 'p6' && m.type === 'Entrada' && m.observation === 'Compra emergencial');
  assert.ok(mov);
  assert.equal(mov.quantity, 5);

  assert.equal(addStockEntry('p6', 0, 'x').success, false);
  assert.equal(addStockEntry('inexistente', 5, 'x').success, false);
  assert.equal(p6.stock, 11);
});

test('F — ajuste inválido é rejeitado e ajustes válidos não são contados em dobro', () => {
  const p1 = part('p1');
  assert.equal(adjustStock('p1', -1, 'negativo').success, false);
  assert.equal(p1.stock, 18);
  assert.equal(adjustStock('p1', 5, '   ').success, false);
  assert.equal(p1.stock, 18);

  const movCount = db.stockMovements.length;
  assert.equal(adjustStock('p1', 18, 'conferência').success, true);
  assert.equal(db.stockMovements.length, movCount, 'delta zero não registra movimentação');

  assert.equal(adjustStock('p1', 20, 'inventário').success, true);
  assert.equal(p1.stock, 20);
  const up = db.stockMovements.find(m => m.partId === 'p1' && m.type === 'Ajuste');
  assert.ok(up);
  assert.equal(up.quantity, 2);

  assert.equal(adjustStock('p1', 12, 'perda').success, true);
  assert.equal(p1.stock, 12);
  const ajustes = db.stockMovements.filter(m => m.partId === 'p1' && m.type === 'Ajuste');
  assert.equal(ajustes.length, 2);
  const down = ajustes.find(m => m.quantity < 0);
  assert.ok(down);
  assert.equal(down.quantity, -8);
});

test('G — saldo histórico é cronológico, estável e termina no estoque atual', () => {
  const withBalance = getMovementsWithBalance();

  const finalByPart = new Map<string, number>();
  for (const m of withBalance) finalByPart.set(m.partId, m.balance);
  for (const p of db.parts) {
    assert.equal(finalByPart.get(p.id) ?? 0, p.stock, `saldo final de ${p.id} deve ser ${p.stock}`);
  }

  for (const id of ['p10', 'p17']) {
    const list = withBalance.filter(m => m.partId === id);
    assert.ok(list.length >= 2);
    assert.equal(list[0].type, 'Entrada', `${id} deve começar com entrada de abertura`);
    for (const m of list) assert.ok(m.balance >= 0, `saldo de ${id} não pode ser negativo`);
  }

  // Filtrar não altera o saldo registrado em cada movimentação.
  const allP1 = withBalance.filter(m => m.partId === 'p1');
  const saidasP1 = withBalance.filter(m => m.partId === 'p1' && m.type === 'Saída');
  for (const row of saidasP1) {
    const same = allP1.find(m => m.id === row.id);
    assert.ok(same);
    assert.equal(same.balance, row.balance);
  }
});

test('H — recusa não altera estoque, atualiza itens e exige justificativa', () => {
  const wo = workOrder('OS-00117');
  const p6 = part('p6');
  const p11 = part('p11');
  const s6 = p6.stock;
  const s11 = p11.stock;
  const movCount = db.stockMovements.length;

  const req = makeRequest({
    id: 'REQ-TEST-H',
    workOrderId: wo.id,
    items: [{ partId: 'p6', quantity: 1 }, { partId: 'p11', quantity: 2 }],
  });
  const result = rejectRequest(req.id, 'Peça incorreta para o veículo');
  assert.equal(result.success, true);
  assert.equal(req.status, 'Recusada');
  assert.equal(p6.stock, s6);
  assert.equal(p11.stock, s11);
  assert.equal(db.stockMovements.length, movCount);
  for (const item of wo.items.filter(i => i.requestId === req.id)) {
    assert.equal(item.status, 'Recusada');
  }

  const req2 = makeRequest({ id: 'REQ-TEST-H2', workOrderId: wo.id, items: [{ partId: 'p6', quantity: 1 }] });
  assert.equal(rejectRequest(req2.id, '   ').success, false);
  assert.equal(req2.status, 'Pendente');
  assert.equal(confirmWithdrawal(req.id).success, false, 'recusada não pode ser processada');
});

test('I — duas solicitações da mesma OS: apenas uma afeta o estado da OS', () => {
  const wo = workOrder('OS-00117');
  wo.status = 'Aguardando peças';
  const reqA = makeRequest({ id: 'REQ-TEST-I1', workOrderId: wo.id, items: [{ partId: 'p6', quantity: 1 }] });
  const reqB = makeRequest({ id: 'REQ-TEST-I2', workOrderId: wo.id, items: [{ partId: 'p11', quantity: 2 }] });

  assert.equal(confirmWithdrawal(reqA.id).success, true);
  assert.equal(reqA.status, 'Retirada confirmada');
  assert.equal(reqB.status, 'Pendente');
  assert.equal(wo.status, 'Aguardando peças', 'ainda há solicitação pendente');

  assert.equal(confirmWithdrawal(reqB.id).success, true);
  assert.equal(wo.status, 'Em andamento');
});

test('J — falha de validação não deixa mutação parcial', () => {
  const wo = workOrder('OS-00117');
  const p6 = part('p6');
  const p20 = part('p20');
  const s6 = p6.stock;
  const s20 = p20.stock;
  const movCount = db.stockMovements.length;

  const req = makeRequest({
    id: 'REQ-TEST-J',
    workOrderId: wo.id,
    items: [{ partId: 'p6', quantity: 1 }, { partId: 'p20', quantity: 5 }],
  });

  const result = confirmWithdrawal(req.id);
  assert.equal(result.success, false);
  assert.equal(p6.stock, s6, 'peça válida não pode ser baixada');
  assert.equal(p20.stock, s20);
  assert.equal(db.stockMovements.length, movCount);
  assert.equal(req.status, 'Pendente');
  for (const item of wo.items.filter(i => i.requestId === req.id)) {
    assert.equal(item.status, 'Solicitada');
  }
});

test('OS finalizada não pode ter peças movimentadas nem recusadas', () => {
  const wo = workOrder('OS-00124');
  assert.equal(wo.status, 'Finalizada');
  const p1 = part('p1');
  const before = p1.stock;
  const req = makeRequest({ id: 'REQ-TEST-K', workOrderId: wo.id, items: [{ partId: 'p1', quantity: 1 }] });

  assert.equal(confirmWithdrawal(req.id).success, false);
  assert.equal(p1.stock, before);
  assert.equal(req.status, 'Pendente');
  assert.equal(rejectRequest(req.id, 'motivo').success, false);
  assert.equal(req.status, 'Pendente');
});

test('Dados de demonstração: todo saldo histórico é consistente com o cadastro', () => {
  const withBalance = getMovementsWithBalance();
  const finalByPart = new Map<string, number>();
  for (const m of withBalance) finalByPart.set(m.partId, m.balance);
  for (const p of db.parts) {
    assert.equal(finalByPart.get(p.id) ?? 0, p.stock, `peça ${p.id} inconsistente`);
  }
  // Toda solicitação referencia peças existentes e está vinculada a uma OS existente.
  for (const req of db.partRequests) {
    assert.ok(db.workOrders.find(w => w.id === req.workOrderId), `OS ${req.workOrderId} inexistente para ${req.id}`);
    for (const item of req.items) {
      assert.ok(db.parts.find(p => p.id === item.partId), `peça ${item.partId} inexistente em ${req.id}`);
      assert.ok(item.quantity > 0, `quantidade inválida em ${req.id}`);
    }
  }
});
