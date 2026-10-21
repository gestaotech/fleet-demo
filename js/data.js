/*
 * Dados FICTÍCIOS de demonstração.
 * Nenhum registro representa pessoas, veículos, peças ou valores reais do cliente.
 * Placas no padrão "DEM" e nomes de usuários são inventados para a apresentação.
 */
const DemoData = (function () {
  const SCHEMA_VERSION = 2;

  /* Parâmetros configuráveis da demonstração (aplicados aos alertas de troca de óleo). */
  function defaultConfiguracoes() {
    return { alertaTrocaOleoKm: 1000, alertaTrocaOleoDias: 30 };
  }

  function createSeed() {
    return {
      schemaVersion: SCHEMA_VERSION,
      configuracoes: defaultConfiguracoes(),
      usuarios: [
        { id: 'USR-001', nome: 'Administrador da Demonstração', cargo: 'Administrador', login: 'admin', senha: 'demo123', ativo: true, permissoes: ['admin', 'almoxarifado', 'veiculos', 'manutencao', 'combustivel', 'relatorios'] },
        { id: 'USR-002', nome: 'Rogério Santana', cargo: 'Almoxarife', login: 'almoxarifado', senha: 'demo123', ativo: true, permissoes: ['almoxarifado'] },
        { id: 'USR-003', nome: 'Márcia Lopes', cargo: 'Supervisora de Oficina', login: 'oficina', senha: 'demo123', ativo: true, permissoes: ['veiculos', 'manutencao', 'combustivel'] },
        { id: 'USR-004', nome: 'Paulo Ferreira', cargo: 'Gerente de Operações', login: 'gerencia', senha: 'demo123', ativo: true, permissoes: ['veiculos', 'combustivel', 'relatorios'] },
        { id: 'USR-005', nome: 'Juliana Prado', cargo: 'Auxiliar Administrativo', login: 'juliana', senha: 'demo123', ativo: false, permissoes: ['almoxarifado'] },
      ],
      veiculos: [
        { id: 'VEI-001', marca: 'Mercedes-Benz Accelo', identificacao: 'FR-101', placa: 'DEM1A01', dataEntrada: '2023-03-10', situacao: 'Ativo' },
        { id: 'VEI-002', marca: 'Volkswagen Delivery', identificacao: 'FR-102', placa: 'DEM2B02', dataEntrada: '2023-05-22', situacao: 'Ativo' },
        { id: 'VEI-003', marca: 'Volvo FH 540', identificacao: 'FR-103', placa: 'DEM3C03', dataEntrada: '2022-11-08', situacao: 'Ativo' },
        { id: 'VEI-004', marca: 'Iveco Daily', identificacao: 'FR-104', placa: 'DEM4D04', dataEntrada: '2024-01-15', situacao: 'Ativo' },
        { id: 'VEI-005', marca: 'Scania R450', identificacao: 'FR-105', placa: 'DEM5E05', dataEntrada: '2021-07-30', situacao: 'Ativo' },
        { id: 'VEI-006', marca: 'Ford Cargo 1729', identificacao: 'FR-106', placa: 'DEM6F06', dataEntrada: '2020-09-02', situacao: 'Ativo' },
        { id: 'VEI-007', marca: 'Volkswagen Constellation', identificacao: 'FR-107', placa: 'DEM7G07', dataEntrada: '2018-04-18', situacao: 'Inativo' },
        { id: 'VEI-008', marca: 'Mercedes-Benz Atego', identificacao: 'FR-108', placa: 'DEM8H08', dataEntrada: '2017-12-05', situacao: 'Inativo' },
      ],
      pecas: [
        { id: 'PEC-001', codigo: 'FLT-1001', descricao: 'Filtro de óleo do motor', valorUnitario: 58.90, estoqueMinimo: 5, dataEntrada: '2026-08-01' },
        { id: 'PEC-002', codigo: 'FLT-1002', descricao: 'Filtro de ar', valorUnitario: 74.50, estoqueMinimo: 4, dataEntrada: '2026-08-01' },
        { id: 'PEC-003', codigo: 'FLT-1003', descricao: 'Filtro de combustível', valorUnitario: 96.00, estoqueMinimo: 4, dataEntrada: '2026-08-01' },
        { id: 'PEC-004', codigo: 'PST-2001', descricao: 'Pastilha de freio dianteira (jogo)', valorUnitario: 189.90, estoqueMinimo: 3, dataEntrada: '2026-08-01' },
        { id: 'PEC-005', codigo: 'LNT-3001', descricao: 'Lona de freio traseira (jogo)', valorUnitario: 164.00, estoqueMinimo: 10, dataEntrada: '2026-08-01' },
        { id: 'PEC-006', codigo: 'OLE-4001', descricao: 'Óleo do motor 15W40 (litro)', valorUnitario: 32.40, estoqueMinimo: 40, dataEntrada: '2026-08-01' },
        { id: 'PEC-007', codigo: 'CRR-5001', descricao: 'Correia poly-V', valorUnitario: 118.75, estoqueMinimo: 3, dataEntrada: '2026-08-01' },
        { id: 'PEC-008', codigo: 'BAT-6001', descricao: 'Bateria 150 Ah', valorUnitario: 689.00, estoqueMinimo: 2, dataEntrada: '2026-08-01' },
        { id: 'PEC-009', codigo: 'LMP-7001', descricao: 'Lâmpada H4 (par)', valorUnitario: 42.90, estoqueMinimo: 6, dataEntrada: '2026-08-01' },
        { id: 'PEC-010', codigo: 'PNE-8001', descricao: 'Pneu 295/80 R22.5', valorUnitario: 1450.00, estoqueMinimo: 4, dataEntrada: '2026-08-01' },
      ],
      movimentacoes: [
        { id: 'MOV-001', tipo: 'Entrada', pecaId: 'PEC-001', quantidade: 30, valorUnitario: 52.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-002', tipo: 'Entrada', pecaId: 'PEC-002', quantidade: 20, valorUnitario: 68.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-003', tipo: 'Entrada', pecaId: 'PEC-003', quantidade: 15, valorUnitario: 90.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-004', tipo: 'Entrada', pecaId: 'PEC-004', quantidade: 12, valorUnitario: 175.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-005', tipo: 'Entrada', pecaId: 'PEC-005', quantidade: 8, valorUnitario: 150.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-006', tipo: 'Entrada', pecaId: 'PEC-006', quantidade: 120, valorUnitario: 29.90, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-007', tipo: 'Entrada', pecaId: 'PEC-007', quantidade: 10, valorUnitario: 109.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-008', tipo: 'Entrada', pecaId: 'PEC-008', quantidade: 4, valorUnitario: 640.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-009', tipo: 'Entrada', pecaId: 'PEC-009', quantidade: 20, valorUnitario: 39.90, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-010', tipo: 'Entrada', pecaId: 'PEC-010', quantidade: 6, valorUnitario: 1380.00, data: '2026-08-01', veiculoId: null, manutencaoId: null, responsavel: 'Almoxarifado', observacao: 'Estoque inicial' },
        { id: 'MOV-011', tipo: 'Entrada', pecaId: 'PEC-001', quantidade: 20, valorUnitario: 55.00, data: '2026-09-03', veiculoId: null, manutencaoId: null, responsavel: 'Rogério Santana', observacao: 'Nota fiscal 1520 (reposição)' },
        { id: 'MOV-012', tipo: 'Entrada', pecaId: 'PEC-006', quantidade: 60, valorUnitario: 31.50, data: '2026-09-03', veiculoId: null, manutencaoId: null, responsavel: 'Rogério Santana', observacao: 'Reposição mensal de óleo' },
        { id: 'MOV-013', tipo: 'Entrada', pecaId: 'PEC-004', quantidade: 6, valorUnitario: 182.00, data: '2026-10-02', veiculoId: null, manutencaoId: null, responsavel: 'Rogério Santana', observacao: 'Reposição' },
        { id: 'MOV-014', tipo: 'Entrada', pecaId: 'PEC-009', quantidade: 10, valorUnitario: 41.00, data: '2026-10-02', veiculoId: null, manutencaoId: null, responsavel: 'Rogério Santana', observacao: 'Reposição' },
        { id: 'MOV-015', tipo: 'Saida', pecaId: 'PEC-001', quantidade: 2, valorUnitario: 52.00, data: '2026-08-05', veiculoId: 'VEI-002', manutencaoId: 'MNT-0001', responsavel: 'Rogério Santana', observacao: 'Revisão de 10 mil km' },
        { id: 'MOV-016', tipo: 'Saida', pecaId: 'PEC-006', quantidade: 10, valorUnitario: 29.90, data: '2026-08-05', veiculoId: 'VEI-002', manutencaoId: 'MNT-0001', responsavel: 'Rogério Santana', observacao: 'Troca de óleo' },
        { id: 'MOV-017', tipo: 'Saida', pecaId: 'PEC-004', quantidade: 2, valorUnitario: 175.00, data: '2026-08-12', veiculoId: 'VEI-004', manutencaoId: 'MNT-0002', responsavel: 'Rogério Santana', observacao: 'Troca de pastilhas dianteiras' },
        { id: 'MOV-018', tipo: 'Saida', pecaId: 'PEC-008', quantidade: 1, valorUnitario: 640.00, data: '2026-09-01', veiculoId: 'VEI-005', manutencaoId: 'MNT-0003', responsavel: 'Rogério Santana', observacao: 'Substituição da bateria' },
        { id: 'MOV-019', tipo: 'Saida', pecaId: 'PEC-007', quantidade: 1, valorUnitario: 109.00, data: '2026-09-15', veiculoId: 'VEI-006', manutencaoId: 'MNT-0004', responsavel: 'Rogério Santana', observacao: 'Correia do alternador' },
        { id: 'MOV-020', tipo: 'Saida', pecaId: 'PEC-006', quantidade: 8, valorUnitario: 31.50, data: '2026-09-15', veiculoId: 'VEI-006', manutencaoId: 'MNT-0004', responsavel: 'Rogério Santana', observacao: 'Complemento de óleo após vazamento' },
        { id: 'MOV-021', tipo: 'Saida', pecaId: 'PEC-001', quantidade: 1, valorUnitario: 55.00, data: '2026-10-06', veiculoId: 'VEI-001', manutencaoId: 'MNT-0005', responsavel: 'Rogério Santana', observacao: 'Diagnóstico do motor' },
        { id: 'MOV-022', tipo: 'Saida', pecaId: 'PEC-010', quantidade: 2, valorUnitario: 1380.00, data: '2026-10-08', veiculoId: 'VEI-003', manutencaoId: 'MNT-0006', responsavel: 'Rogério Santana', observacao: 'Troca de pneus dianteiros' },
        { id: 'MOV-023', tipo: 'Saida', pecaId: 'PEC-009', quantidade: 4, valorUnitario: 41.00, data: '2026-10-08', veiculoId: 'VEI-003', manutencaoId: 'MNT-0006', responsavel: 'Rogério Santana', observacao: 'Lâmpadas de farol' },
        { id: 'MOV-024', tipo: 'Saida', pecaId: 'PEC-003', quantidade: 1, valorUnitario: 90.00, data: '2026-10-10', veiculoId: 'VEI-002', manutencaoId: null, responsavel: 'Rogério Santana', observacao: 'Retirada direta (sem manutenção aberta)' },
      ],
      pecasExternas: [
        { id: 'EXT-001', veiculoId: 'VEI-006', manutencaoId: 'MNT-0004', descricao: 'Retentor do cabeçote (comprado em loja parceira)', quantidade: 1, valorUnitario: 245.00, data: '2026-09-15', responsavel: 'Márcia Lopes', motivo: 'Peça não disponível no almoxarifado.' },
        { id: 'EXT-002', veiculoId: 'VEI-007', manutencaoId: null, descricao: 'Amortecedor dianteiro', quantidade: 2, valorUnitario: 390.00, data: '2026-07-20', responsavel: 'Paulo Ferreira', motivo: 'Compra urgente fora do almoxarifado.' },
        { id: 'EXT-003', veiculoId: 'VEI-003', manutencaoId: 'MNT-0006', descricao: 'Lâmpada de farol especial', quantidade: 2, valorUnitario: 65.00, data: '2026-10-08', responsavel: 'Márcia Lopes', motivo: 'Modelo não cadastrado no almoxarifado.' },
      ],
      manutencoes: [
        {
          id: 'MNT-0001', veiculoId: 'VEI-002', dataEntrada: '2026-08-05T08:00', quilometragem: 61000, dataConclusao: '2026-08-07T17:00', status: 'Concluída',
          descricaoProblema: 'Revisão de 10 mil km: troca de óleo e filtros.', observacoes: 'Revisão programada.', responsavel: 'Márcia Lopes',
          historico: [
            { data: '2026-08-05T08:00', texto: 'Manutenção aberta por Márcia Lopes.' },
            { data: '2026-08-07T17:00', texto: 'Manutenção concluída.' },
          ],
        },
        {
          id: 'MNT-0002', veiculoId: 'VEI-004', dataEntrada: '2026-08-12T09:30', quilometragem: 30000, dataConclusao: '2026-08-12T16:00', status: 'Concluída',
          descricaoProblema: 'Ruído ao frear e pastilhas desgastadas.', observacoes: '', responsavel: 'Márcia Lopes',
          historico: [
            { data: '2026-08-12T09:30', texto: 'Manutenção aberta por Márcia Lopes.' },
            { data: '2026-08-12T16:00', texto: 'Manutenção concluída.' },
          ],
        },
        {
          id: 'MNT-0003', veiculoId: 'VEI-005', dataEntrada: '2026-09-01T07:45', quilometragem: 119500, dataConclusao: '2026-09-04T11:20', status: 'Concluída',
          descricaoProblema: 'Veículo não dá partida; bateria descarregada.', observacoes: 'Verificar alternador na próxima revisão.', responsavel: 'Márcia Lopes',
          historico: [
            { data: '2026-09-01T07:45', texto: 'Manutenção aberta por Márcia Lopes.' },
            { data: '2026-09-04T11:20', texto: 'Manutenção concluída.' },
          ],
        },
        {
          id: 'MNT-0004', veiculoId: 'VEI-006', dataEntrada: '2026-09-15T08:10', quilometragem: 150700, dataConclusao: '2026-09-16T15:00', status: 'Concluída',
          descricaoProblema: 'Vazamento de óleo e correia do alternador desgastada.', observacoes: '', responsavel: 'Márcia Lopes',
          historico: [
            { data: '2026-09-15T08:10', texto: 'Manutenção aberta por Márcia Lopes.' },
            { data: '2026-09-16T15:00', texto: 'Manutenção concluída.' },
          ],
        },
        {
          id: 'MNT-0005', veiculoId: 'VEI-001', dataEntrada: '2026-10-06T08:00', quilometragem: 50100, dataConclusao: null, status: 'Aberta',
          descricaoProblema: 'Barulho no motor ao acelerar.', observacoes: 'Aguardando diagnóstico completo.', responsavel: 'Márcia Lopes',
          historico: [
            { data: '2026-10-06T08:00', texto: 'Manutenção aberta por Márcia Lopes.' },
          ],
        },
        {
          id: 'MNT-0006', veiculoId: 'VEI-003', dataEntrada: '2026-10-08T13:00', quilometragem: 88930, dataConclusao: null, status: 'Em andamento',
          descricaoProblema: 'Desgaste irregular no pneu dianteiro esquerdo e lâmpadas de farol queimadas.', observacoes: '', responsavel: 'Márcia Lopes',
          historico: [
            { data: '2026-10-08T13:00', texto: 'Manutenção aberta por Márcia Lopes.' },
            { data: '2026-10-09T08:30', texto: 'Manutenção iniciada.' },
          ],
        },
      ],
      despesas: [
        { id: 'DES-001', manutencaoId: 'MNT-0001', descricao: 'Mão de obra – revisão', valor: 180.00, data: '2026-08-07' },
        { id: 'DES-002', manutencaoId: 'MNT-0002', descricao: 'Mão de obra – freios', valor: 220.00, data: '2026-08-12' },
        { id: 'DES-003', manutencaoId: 'MNT-0003', descricao: 'Mão de obra – elétrica e teste', valor: 150.00, data: '2026-09-04' },
        { id: 'DES-004', manutencaoId: 'MNT-0004', descricao: 'Serviço de alinhamento', valor: 90.00, data: '2026-09-16' },
        { id: 'DES-005', manutencaoId: 'MNT-0005', descricao: 'Diagnóstico do motor', valor: 120.00, data: '2026-10-06' },
      ],
      /* Abastecimentos fictícios. tanqueCheio = true marca os ciclos válidos para cálculo de consumo. */
      abastecimentos: [
        { id: 'ABS-0001', veiculoId: 'VEI-001', dataHora: '2026-08-03T07:20', quilometragem: 48000, litros: 180, valorTotal: 1080.00, precoLitro: 6.000, posto: 'Posto Rota Sul', responsavel: 'Paulo Ferreira', observacao: 'Tanque cheio', tanqueCheio: true },
        { id: 'ABS-0002', veiculoId: 'VEI-001', dataHora: '2026-08-18T18:40', quilometragem: 48540, litros: 150, valorTotal: 900.00, precoLitro: 6.000, posto: 'Posto Rota Sul', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0003', veiculoId: 'VEI-001', dataHora: '2026-09-02T06:50', quilometragem: 49095, litros: 155, valorTotal: 945.50, precoLitro: 6.100, posto: 'Posto Trevo', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0004', veiculoId: 'VEI-001', dataHora: '2026-09-20T19:10', quilometragem: 49640, litros: 160, valorTotal: 992.00, precoLitro: 6.200, posto: 'Posto Rota Sul', responsavel: 'Márcia Lopes', observacao: '', tanqueCheio: true },
        { id: 'ABS-0005', veiculoId: 'VEI-001', dataHora: '2026-10-05T08:30', quilometragem: 50180, litros: 148.5, valorTotal: 920.70, precoLitro: 6.200, posto: 'Posto Rota Sul', responsavel: 'Paulo Ferreira', observacao: 'Abastecimento parcial', tanqueCheio: false },
        { id: 'ABS-0006', veiculoId: 'VEI-002', dataHora: '2026-08-10T07:00', quilometragem: 61200, litros: 200, valorTotal: 1180.00, precoLitro: 5.900, posto: 'Posto Bandeirantes', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0007', veiculoId: 'VEI-002', dataHora: '2026-08-27T17:30', quilometragem: 61900, litros: 195, valorTotal: 1150.50, precoLitro: 5.900, posto: 'Posto Bandeirantes', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0008', veiculoId: 'VEI-002', dataHora: '2026-09-14T07:15', quilometragem: 62650, litros: 210, valorTotal: 1239.00, precoLitro: 5.900, posto: 'Posto Rota Sul', responsavel: 'Márcia Lopes', observacao: '', tanqueCheio: true },
        { id: 'ABS-0009', veiculoId: 'VEI-002', dataHora: '2026-10-03T18:00', quilometragem: 63380, litros: 198, valorTotal: 1168.20, precoLitro: 5.900, posto: 'Posto Bandeirantes', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0010', veiculoId: 'VEI-003', dataHora: '2026-09-05T07:40', quilometragem: 88000, litros: 250, valorTotal: 1500.00, precoLitro: 6.000, posto: 'Posto Rodovia', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0011', veiculoId: 'VEI-003', dataHora: '2026-09-22T19:20', quilometragem: 88950, litros: 260, valorTotal: 1560.00, precoLitro: 6.000, posto: 'Posto Rodovia', responsavel: 'Paulo Ferreira', observacao: '', tanqueCheio: true },
        { id: 'ABS-0012', veiculoId: 'VEI-004', dataHora: '2026-10-01T08:10', quilometragem: 30500, litros: 90, valorTotal: 549.00, precoLitro: 6.100, posto: 'Posto Central', responsavel: 'Juliana Prado', observacao: '', tanqueCheio: true },
        { id: 'ABS-0013', veiculoId: 'VEI-004', dataHora: '2026-10-10T09:05', quilometragem: 31040, litros: 85, valorTotal: 518.50, precoLitro: 6.100, posto: 'Posto Central', responsavel: 'Juliana Prado', observacao: '', tanqueCheio: true },
        { id: 'ABS-0014', veiculoId: 'VEI-005', dataHora: '2026-09-30T07:30', quilometragem: 120000, litros: 220, valorTotal: 1320.00, precoLitro: 6.000, posto: 'Posto Rodovia', responsavel: 'Paulo Ferreira', observacao: 'Apenas um abastecimento registrado.', tanqueCheio: true },
        { id: 'ABS-0015', veiculoId: 'VEI-006', dataHora: '2026-08-05T07:25', quilometragem: 150300, litros: 190, valorTotal: 1121.00, precoLitro: 5.900, posto: 'Posto Trevo', responsavel: 'Márcia Lopes', observacao: '', tanqueCheio: true },
        { id: 'ABS-0016', veiculoId: 'VEI-006', dataHora: '2026-08-22T18:15', quilometragem: 150980, litros: 185, valorTotal: 1091.50, precoLitro: 5.900, posto: 'Posto Trevo', responsavel: 'Márcia Lopes', observacao: '', tanqueCheio: true },
      ],
      /*
       * Trocas de óleo fictícias.
       * pecaId/movimentacaoId ficam nulos quando o custo é próprio (valorUnitario x quantidade).
       * Quando o óleo vem do almoxarifado, a troca aponta para a movimentação e não soma custo próprio.
       */
      trocasOleo: [
        { id: 'OLE-0001', veiculoId: 'VEI-001', data: '2026-07-10', quilometragem: 46000, especificacao: '15W40 mineral (API CI-4)', quantidade: 28, valorUnitario: 32.40, responsavel: 'Márcia Lopes', observacao: 'Uso severo; intervalo reduzido.', intervaloKm: 5000, intervaloMeses: 6, manutencaoId: null, pecaId: null, movimentacaoId: null },
        { id: 'OLE-0002', veiculoId: 'VEI-002', data: '2026-05-12', quilometragem: 58000, especificacao: '15W40 mineral (API CI-4)', quantidade: 30, valorUnitario: 31.50, responsavel: 'Márcia Lopes', observacao: 'Intervalo reduzido por uso severo.', intervaloKm: 5000, intervaloMeses: 6, manutencaoId: null, pecaId: null, movimentacaoId: null },
        { id: 'OLE-0003', veiculoId: 'VEI-004', data: '2026-02-20', quilometragem: 26000, especificacao: '10W30 sintético', quantidade: 12, valorUnitario: 32.40, responsavel: 'Márcia Lopes', observacao: '', intervaloKm: 10000, intervaloMeses: 6, manutencaoId: null, pecaId: null, movimentacaoId: null },
        { id: 'OLE-0004', veiculoId: 'VEI-003', data: '2026-09-20', quilometragem: 88900, especificacao: '15W40 semissintético', quantidade: 32, valorUnitario: 32.40, responsavel: 'Márcia Lopes', observacao: '', intervaloKm: 8000, intervaloMeses: 12, manutencaoId: null, pecaId: null, movimentacaoId: null },
        { id: 'OLE-0005', veiculoId: 'VEI-005', data: '2026-09-01', quilometragem: 120000, especificacao: '15W40 mineral', quantidade: 8, valorUnitario: 32.40, responsavel: 'Márcia Lopes', observacao: 'Intervalo não configurado.', intervaloKm: null, intervaloMeses: null, manutencaoId: null, pecaId: null, movimentacaoId: null },
        { id: 'OLE-0006', veiculoId: 'VEI-006', data: '2026-09-15', quilometragem: 150850, especificacao: '15W40 mineral (API CI-4)', quantidade: 8, valorUnitario: 31.50, responsavel: 'Márcia Lopes', observacao: 'Troca feita durante a manutenção MNT-0004.', intervaloKm: 8000, intervaloMeses: 12, manutencaoId: 'MNT-0004', pecaId: null, movimentacaoId: null },
      ],
    };
  }

  return { SCHEMA_VERSION, defaultConfiguracoes, createSeed };
})();
