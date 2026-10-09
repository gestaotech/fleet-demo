import { StockMovement } from '@/types';

// Histórico de movimentações de demonstração.
// Regra de consistência: para cada peça, a soma cronológica das movimentações
// (abertura + entradas + ajustes - saídas) deve ser igual ao estoque atual
// cadastrado em `parts.ts`. Assim o saldo do histórico nunca "começa do zero"
// sem justificativa e termina exatamente no estoque registrado.
export const stockMovements: StockMovement[] = [
  // --- Saldos de abertura (01/09/2026) ---
  { id: 'mov-open-p1', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p1', quantity: 10, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p2', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p2', quantity: 5, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p3', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p3', quantity: 10, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p4', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p4', quantity: 2, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p5', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p5', quantity: 8, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p6', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p6', quantity: 6, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p7', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p7', quantity: 4, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p8', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p8', quantity: 5, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p9', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p9', quantity: 20, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p10', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p10', quantity: 8, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p11', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p11', quantity: 10, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p12', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p12', quantity: 10, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p13', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p13', quantity: 30, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p14', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p14', quantity: 2, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p15', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p15', quantity: 1, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p16', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p16', quantity: 3, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p17', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p17', quantity: 3, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p18', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p18', quantity: 4, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p19', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p19', quantity: 2, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },
  { id: 'mov-open-p20', date: '2026-09-01T00:00:00Z', type: 'Entrada', partId: 'p20', quantity: 1, origin: 'Saldo inicial', responsible: 'Sistema', observation: 'Saldo inicial' },

  // --- Compras ---
  { id: 'mov-buy-p1', date: '2026-09-10T10:00:00Z', type: 'Entrada', partId: 'p1', quantity: 14, origin: 'Compra', responsible: 'Almoxarifado' },
  { id: 'mov-buy-p2', date: '2026-09-10T10:01:00Z', type: 'Entrada', partId: 'p2', quantity: 5, origin: 'Compra', responsible: 'Almoxarifado' },
  { id: 'mov-buy-p3', date: '2026-09-10T10:02:00Z', type: 'Entrada', partId: 'p3', quantity: 7, origin: 'Compra', responsible: 'Almoxarifado' },
  { id: 'mov-buy-p4', date: '2026-09-15T09:00:00Z', type: 'Entrada', partId: 'p4', quantity: 3, origin: 'Compra', responsible: 'Almoxarifado' },
  { id: 'mov-buy-p5', date: '2026-09-15T09:01:00Z', type: 'Entrada', partId: 'p5', quantity: 6, origin: 'Compra', responsible: 'Almoxarifado' },
  { id: 'mov-buy-p13', date: '2026-09-15T09:02:00Z', type: 'Entrada', partId: 'p13', quantity: 50, origin: 'Compra', responsible: 'Almoxarifado' },

  // --- Saídas (consumo por OS) ---
  { id: 'mov-14', date: '2026-09-18T11:00:00Z', type: 'Saída', partId: 'p12', quantity: -2, origin: 'OS-00116', responsible: 'Almoxarifado' },
  { id: 'mov-10', date: '2026-09-20T14:00:00Z', type: 'Saída', partId: 'p4', quantity: -1, origin: 'OS-00118', responsible: 'Almoxarifado' },
  { id: 'mov-11', date: '2026-09-20T14:01:00Z', type: 'Saída', partId: 'p5', quantity: -1, origin: 'OS-00118', responsible: 'Almoxarifado' },
  { id: 'mov-12', date: '2026-09-20T14:02:00Z', type: 'Saída', partId: 'p13', quantity: -20, origin: 'OS-00118', responsible: 'Almoxarifado' },
  { id: 'mov-13', date: '2026-09-20T14:03:00Z', type: 'Saída', partId: 'p1', quantity: -4, origin: 'OS-00118', responsible: 'Almoxarifado' },
  { id: 'mov-7', date: '2026-09-25T11:00:00Z', type: 'Saída', partId: 'p10', quantity: -1, origin: 'OS-00121', responsible: 'Almoxarifado' },
  { id: 'mov-4', date: '2026-09-28T12:00:00Z', type: 'Saída', partId: 'p4', quantity: -1, origin: 'OS-00124', responsible: 'Almoxarifado' },
  { id: 'mov-5', date: '2026-09-28T12:01:00Z', type: 'Saída', partId: 'p5', quantity: -1, origin: 'OS-00124', responsible: 'Almoxarifado' },
  { id: 'mov-6', date: '2026-09-28T12:02:00Z', type: 'Saída', partId: 'p13', quantity: -20, origin: 'OS-00124', responsible: 'Almoxarifado' },
  { id: 'mov-1', date: '2026-10-02T10:30:00Z', type: 'Saída', partId: 'p1', quantity: -2, origin: 'OS-00125', responsible: 'Almoxarifado' },
  { id: 'mov-2', date: '2026-10-02T10:31:00Z', type: 'Saída', partId: 'p2', quantity: -2, origin: 'OS-00125', responsible: 'Almoxarifado' },
  { id: 'mov-3', date: '2026-10-02T10:32:00Z', type: 'Saída', partId: 'p3', quantity: -2, origin: 'OS-00125', responsible: 'Almoxarifado' },
  { id: 'mov-8', date: '2026-10-03T09:10:00Z', type: 'Saída', partId: 'p17', quantity: -1, origin: 'OS-00120', responsible: 'Almoxarifado' },
  { id: 'mov-9', date: '2026-10-03T09:11:00Z', type: 'Saída', partId: 'p13', quantity: -10, origin: 'OS-00120', responsible: 'Almoxarifado' },
];
