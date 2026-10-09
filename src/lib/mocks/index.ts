export * from './vehicles';
export * from './mechanics';
export * from './parts';
export * from './workOrders';
export * from './requests';
export * from './movements';

// Simple in-memory mutable stores (for demo)
import { vehicles } from './vehicles';
import { mechanics } from './mechanics';
import { parts } from './parts';
import { workOrders } from './workOrders';
import { partRequests } from './requests';
import { stockMovements } from './movements';

import type { StockMovement } from '@/types';

export const db = {
  vehicles,
  mechanics,
  parts,
  workOrders,
  partRequests,
  stockMovements,
};

export interface OperationResult {
  success: boolean;
  message: string;
}

export interface MovementWithBalance extends StockMovement {
  balance: number;
}

// Helper functions
export function findVehicle(id: string) {
  return vehicles.find(v => v.id === id);
}
export function findMechanic(id: string) {
  return mechanics.find(m => m.id === id);
}
export function findPart(id: string) {
  return parts.find(p => p.id === id);
}
export function findWorkOrder(id: string) {
  return workOrders.find(wo => wo.id === id);
}
export function findRequest(id: string) {
  return partRequests.find(r => r.id === id);
}

// A request can be processed/rejected only while it is not finalized.
export function isRequestOpen(status: string) {
  return status === 'Pendente' || status === 'Separada';
}

// An OS that is already finalized must not receive stock-related changes.
export function isWorkOrderLocked(status: string) {
  return status === 'Finalizada';
}

let movementSequence = 0;
function makeMovementId() {
  movementSequence += 1;
  return `mov-${Date.now()}-${movementSequence}`;
}

// Mutations
export function updatePartStock(partId: string, delta: number) {
  const part = findPart(partId);
  if (part) part.stock += delta;
}
export function addStockMovement(mov: StockMovement) {
  stockMovements.unshift(mov);
}
export function updateRequestStatus(requestId: string, status: typeof partRequests[0]['status']) {
  const req = findRequest(requestId);
  if (req) req.status = status;
}
export function addWorkOrderItem(woId: string, item: typeof workOrders[0]['items'][0]) {
  const wo = findWorkOrder(woId);
  if (wo) wo.items.push(item);
}
export function updateWorkOrderStatus(woId: string, status: typeof workOrders[0]['status']) {
  const wo = findWorkOrder(woId);
  if (wo) {
    wo.status = status;
    wo.updatedAt = new Date().toISOString();
  }
}

// Aggregates a request's items by partId, summing repeated parts.
export function groupRequestItems(items: { partId: string; quantity: number }[]) {
  const grouped = new Map<string, number>();
  for (const item of items) {
    grouped.set(item.partId, (grouped.get(item.partId) ?? 0) + item.quantity);
  }
  return grouped;
}

export function createWorkOrder(data: { vehicleId: string; mechanicId: string; problem: string; observations?: string }) {
  const newId = `OS-${String(workOrders.length + 1).padStart(5, '0')}`;
  const now = new Date().toISOString();
  const wo = {
    id: newId,
    vehicleId: data.vehicleId,
    mechanicId: data.mechanicId,
    status: 'Aberta' as const,
    problem: data.problem,
    observations: data.observations ?? '',
    services: [] as string[],
    items: [] as typeof workOrders[0]['items'],
    createdAt: now,
    updatedAt: now,
  };
  workOrders.unshift(wo);
  return wo;
}
export function addServiceToWorkOrder(woId: string, service: string) {
  const wo = findWorkOrder(woId);
  if (wo) {
    wo.services.push(service);
    wo.updatedAt = new Date().toISOString();
  }
}
export function finalizeWorkOrder(woId: string) {
  const wo = findWorkOrder(woId);
  if (wo) {
    wo.status = 'Finalizada';
    wo.updatedAt = new Date().toISOString();
  }
}

// Stock specific mutations

// Returns the movement history with the running balance per part, computed
// chronologically and stably. The balance is attached to each movement, so
// filtering/sorting the list for display never changes the stored balance.
export function getMovementsWithBalance(): MovementWithBalance[] {
  // Stable sort by date (Array#sort is stable in ES2019+), keeping the
  // insertion order as tiebreaker for movements with the same timestamp.
  const ordered = [...stockMovements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const balances: Record<string, number> = {};
  return ordered.map(m => {
    const next = (balances[m.partId] ?? 0) + m.quantity;
    balances[m.partId] = next;
    return { ...m, balance: next };
  });
}

export function getLastMovementForPart(partId: string) {
  // Latest movement for the part, using the same stable chronological order.
  const ordered = getMovementsWithBalance().filter(m => m.partId === partId);
  return ordered.length ? ordered[ordered.length - 1] : undefined;
}

export function addStockEntry(partId: string, quantity: number, observation: string): OperationResult {
  const part = findPart(partId);
  if (!part) return { success: false, message: 'Peça não encontrada.' };
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { success: false, message: 'Informe uma quantidade válida maior que zero.' };
  }
  part.stock += quantity;
  addStockMovement({
    id: makeMovementId(),
    date: new Date().toISOString(),
    type: 'Entrada',
    partId,
    quantity,
    origin: 'Entrada manual',
    responsible: 'Almoxarifado',
    observation: observation?.trim() ? observation.trim() : undefined,
  });
  return { success: true, message: 'Entrada de estoque registrada com sucesso.' };
}

export function adjustStock(partId: string, newQuantity: number, reason: string): OperationResult {
  const part = findPart(partId);
  if (!part) return { success: false, message: 'Peça não encontrada.' };
  if (!Number.isFinite(newQuantity) || newQuantity < 0) {
    return { success: false, message: 'Informe uma quantidade válida (não negativa).' };
  }
  const trimmedReason = reason?.trim() ?? '';
  if (!trimmedReason) return { success: false, message: 'Informe o motivo do ajuste.' };
  const delta = newQuantity - part.stock;
  if (delta === 0) {
    return { success: true, message: 'Estoque já estava no valor informado; nenhuma movimentação registrada.' };
  }
  part.stock = newQuantity;
  addStockMovement({
    id: makeMovementId(),
    date: new Date().toISOString(),
    type: 'Ajuste',
    partId,
    quantity: delta,
    origin: 'Ajuste de estoque',
    responsible: 'Almoxarifado',
    observation: trimmedReason,
  });
  return { success: true, message: 'Estoque ajustado com sucesso.' };
}

// Associa os itens da OS pertencentes a uma solicitação específica.
// Prioriza o vínculo por requestId; só recorre ao partId quando o item
// legado não possui vínculo e não há ambiguidade.
function claimWorkOrderItems(
  wo: typeof workOrders[0],
  requestId: string,
  partId: string,
  newStatus: 'Retirada' | 'Recusada'
) {
  const linked = wo.items.filter(i => i.requestId === requestId && i.partId === partId);
  if (linked.length) {
    for (const item of linked) item.status = newStatus;
    return;
  }
  const unlinked = wo.items.filter(i => i.partId === partId && !i.requestId && i.status === 'Solicitada');
  if (unlinked.length === 1) {
    unlinked[0].status = newStatus;
    unlinked[0].requestId = requestId;
  }
}

export function confirmWithdrawal(requestId: string): OperationResult {
  const req = findRequest(requestId);
  if (!req) return { success: false, message: 'Solicitação não encontrada.' };
  if (!isRequestOpen(req.status)) {
    return { success: false, message: 'Solicitação já processada ou recusada.' };
  }

  const wo = findWorkOrder(req.workOrderId);
  if (wo && isWorkOrderLocked(wo.status)) {
    return { success: false, message: 'Não é possível movimentar peças de uma OS finalizada.' };
  }

  // Agrupa por peça: se a mesma peça aparecer mais de uma vez, soma as quantidades.
  const grouped = groupRequestItems(req.items);
  if (grouped.size === 0) {
    return { success: false, message: 'Solicitação sem itens.' };
  }

  // Valida TUDO antes de qualquer mutação (operação atômica).
  for (const [partId, total] of grouped) {
    const part = findPart(partId);
    if (!part) return { success: false, message: `Peça ${partId} não encontrada.` };
    if (total <= 0) return { success: false, message: `Quantidade inválida para ${part.name}.` };
    if (part.stock < total) {
      return {
        success: false,
        message: `Estoque insuficiente para ${part.name}. Disponível: ${part.stock}, necessário: ${total}.`,
      };
    }
  }

  // Commit: baixa de estoque + uma movimentação por peça.
  const now = new Date().toISOString();
  for (const [partId, total] of grouped) {
    updatePartStock(partId, -total);
    addStockMovement({
      id: makeMovementId(),
      date: now,
      type: 'Saída',
      partId,
      quantity: -total,
      origin: req.workOrderId,
      responsible: 'Almoxarifado',
      observation: `Retirada da solicitação ${req.id}`,
    });
  }

  req.status = 'Retirada confirmada';

  if (wo) {
    for (const [partId] of grouped) {
      claimWorkOrderItems(wo, req.id, partId, 'Retirada');
    }
    wo.updatedAt = now;

    // Só libera a OS quando não há mais solicitações em aberto para ela.
    const otherPending = db.partRequests.some(
      r => r.workOrderId === req.workOrderId && r.id !== req.id && isRequestOpen(r.status)
    );
    if (!otherPending && wo.status === 'Aguardando peças') {
      updateWorkOrderStatus(wo.id, 'Em andamento');
    }
  }

  return { success: true, message: 'Retirada confirmada com sucesso.' };
}

export function rejectRequest(requestId: string, reason: string): OperationResult {
  const req = findRequest(requestId);
  if (!req) return { success: false, message: 'Solicitação não encontrada.' };
  if (!isRequestOpen(req.status)) {
    return { success: false, message: 'Solicitação já processada ou recusada.' };
  }

  const trimmedReason = reason?.trim() ?? '';
  if (!trimmedReason) {
    return { success: false, message: 'Informe uma justificativa para a recusa.' };
  }

  const wo = findWorkOrder(req.workOrderId);
  if (wo && isWorkOrderLocked(wo.status)) {
    return { success: false, message: 'Não é possível recusar peças de uma OS finalizada.' };
  }

  // Recusa não altera estoque nem cria movimentações.
  req.status = 'Recusada';

  if (wo) {
    const now = new Date().toISOString();
    for (const item of req.items) {
      claimWorkOrderItems(wo, req.id, item.partId, 'Recusada');
    }
    const note = `[${now.slice(0, 10)}] Recusa da solicitação ${req.id}: ${trimmedReason}`;
    wo.observations = wo.observations ? `${wo.observations}\n${note}` : note;
    wo.updatedAt = now;
    // Não marca a OS como "Em andamento": a necessidade de peças segue pendente.
  }

  return { success: true, message: 'Solicitação recusada.' };
}
