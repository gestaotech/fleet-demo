import { PartRequest } from '@/types';

export const partRequests: PartRequest[] = [
  {
    id: 'REQ-0048',
    workOrderId: 'OS-00125',
    vehicleId: 'v1',
    requesterId: 'm1',
    items: [
      { partId: 'p1', quantity: 2 },
      { partId: 'p2', quantity: 2 },
      { partId: 'p3', quantity: 2 },
    ],
    status: 'Pendente',
    createdAt: '2026-10-02T10:15:00Z',
  },
  {
    id: 'REQ-0047',
    workOrderId: 'OS-00123',
    vehicleId: 'v3',
    requesterId: 'm3',
    items: [
      { partId: 'p7', quantity: 2 },
      { partId: 'p8', quantity: 2 },
    ],
    status: 'Pendente',
    createdAt: '2026-10-01T14:05:00Z',
  },
  {
    id: 'REQ-0046',
    workOrderId: 'OS-00119',
    vehicleId: 'v7',
    requesterId: 'm2',
    items: [
      { partId: 'p19', quantity: 1 },
    ],
    status: 'Separada',
    createdAt: '2026-09-30T13:10:00Z',
  },
  {
    id: 'REQ-0045',
    workOrderId: 'OS-00120',
    vehicleId: 'v6',
    requesterId: 'm1',
    items: [
      { partId: 'p17', quantity: 1 },
      { partId: 'p13', quantity: 10 },
    ],
    status: 'Retirada confirmada',
    createdAt: '2026-10-02T09:00:00Z',
  },
  {
    id: 'REQ-0044',
    workOrderId: 'OS-00122',
    vehicleId: 'v4',
    requesterId: 'm4',
    items: [
      { partId: 'p9', quantity: 4 },
    ],
    status: 'Recusada',
    createdAt: '2026-10-03T08:30:00Z',
  },
];