export interface Vehicle {
  id: string;
  name: string;
  plate: string;
  model: string;
  year: number;
  km: number;
  status: 'Disponível' | 'Em manutenção' | 'Indisponível';
  lastMaintenance: string; // ISO date
  nextMaintenance: string; // ISO date
}

export interface Mechanic {
  id: string;
  name: string;
}

export interface Part {
  id: string;
  code: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unitPrice: number;
}

export interface WorkOrderItem {
  partId: string;
  quantity: number;
  status: 'Solicitada' | 'Retirada' | 'Utilizada';
}

export interface WorkOrder {
  id: string;
  vehicleId: string;
  mechanicId: string;
  status: 'Aberta' | 'Em andamento' | 'Aguardando peças' | 'Finalizada';
  problem: string;
  services: string[];
  items: WorkOrderItem[];
  createdAt: string; // ISO
  updatedAt: string;
}

export interface PartRequest {
  id: string;
  workOrderId: string;
  vehicleId: string;
  requesterId: string; // mechanic
  items: { partId: string; quantity: number }[];
  status: 'Pendente' | 'Separada' | 'Recusada' | 'Retirada confirmada';
  createdAt: string;
}

export interface StockMovement {
  id: string;
  date: string; // ISO
  type: 'Entrada' | 'Saída';
  partId: string;
  quantity: number; // positive for entry, negative for exit
  origin: string; // e.g., OS id or 'Compra'
  responsible: string;
}