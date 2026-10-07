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