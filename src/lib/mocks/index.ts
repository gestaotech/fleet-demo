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

export const db = {
  vehicles,
  mechanics,
  parts,
  workOrders,
  partRequests,
  stockMovements,
};

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

// Mutations
export function updatePartStock(partId: string, delta: number) {
  const part = findPart(partId);
  if (part) part.stock += delta;
}
export function addStockMovement(mov: typeof stockMovements[0]) {
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
  if (wo) wo.status = status;
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
export function addStockEntry(partId: string, quantity: number, _observation: string) {
  const part = findPart(partId);
  if (!part) return false;
  part.stock += quantity;
  addStockMovement({
    id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
    type: 'Entrada',
    partId,
    quantity,
    origin: 'Entrada manual',
    responsible: 'Almoxarifado',
  });
  void _observation;
  return true;
}

export function adjustStock(partId: string, newQuantity: number, _reason: string) {
  const part = findPart(partId);
  if (!part) return false;
  const delta = newQuantity - part.stock;
  part.stock = newQuantity;
  addStockMovement({
    id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
    type: 'Ajuste',
    partId,
    quantity: Math.abs(delta),
    origin: 'Ajuste de estoque',
    responsible: 'Almoxarifado',
  });
  void _reason;
  return true;
}

export function getLastMovementForPart(partId: string) {
  return stockMovements.find(m => m.partId === partId);
}