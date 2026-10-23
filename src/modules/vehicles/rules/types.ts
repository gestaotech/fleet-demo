/*
 * Tipos do conjunto de dados legado (demo vanilla).
 *
 * Estes tipos descrevem o formato em que as regras de negocio aprovadas foram
 * escritas. Na Fase 1 eles servem para os testes de regressao; nas fases
 * seguintes, os repositorios Prisma convertem para/da estes tipos, mantendo as
 * regras puras e testaveis sem banco.
 *
 * Valores monetarios continuam em number aqui (regra de calculo), mas na
 * persistencia devem usar Decimal no PostgreSQL (ver docs/banco.md).
 */

export type TipoMovimentacao = "Entrada" | "Saida";
export type SituacaoVeiculo = "Ativo" | "Inativo";

export type Veiculo = {
  id: string;
  marca: string;
  identificacao: string;
  placa: string;
  dataEntrada: string;
  situacao: SituacaoVeiculo;
};

export type Peca = {
  id: string;
  codigo: string;
  descricao: string;
  valorUnitario: number;
  estoqueMinimo: number;
  dataEntrada: string;
};

export type Movimentacao = {
  id: string;
  tipo: TipoMovimentacao;
  pecaId: string;
  quantidade: number;
  valorUnitario: number;
  data: string;
  veiculoId: string | null;
  manutencaoId: string | null;
  responsavel?: string;
  observacao?: string;
};

export type PecaExterna = {
  id: string;
  veiculoId: string;
  manutencaoId: string | null;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  data: string;
  responsavel?: string;
  motivo?: string;
};

export type Despesa = {
  id: string;
  manutencaoId: string;
  descricao?: string;
  valor: number;
  data: string;
};

export type TrocaOleo = {
  id: string;
  veiculoId: string;
  data: string;
  quilometragem: number;
  especificacao: string;
  quantidade: number;
  valorUnitario: number;
  responsavel?: string;
  observacao?: string;
  intervaloKm: number | null;
  intervaloMeses: number | null;
  manutencaoId: string | null;
  pecaId: string | null;
  movimentacaoId: string | null;
};

export type Abastecimento = {
  id: string;
  veiculoId: string;
  dataHora: string;
  quilometragem: number;
  litros: number;
  valorTotal: number;
  precoLitro: number;
  posto?: string;
  responsavel?: string;
  observacao?: string;
  tanqueCheio: boolean;
};

export type Manutencao = {
  id: string;
  veiculoId: string;
  status: string;
  dataEntrada: string;
  dataConclusao: string | null;
  descricao?: string;
  quilometragem?: number | null;
};

export type Configuracoes = {
  alertaTrocaOleoKm: number;
  alertaTrocaOleoDias: number;
};

export type DadosFrota = {
  veiculos: Veiculo[];
  pecas: Peca[];
  movimentacoes: Movimentacao[];
  pecasExternas: PecaExterna[];
  despesas: Despesa[];
  manutencoes: Manutencao[];
  abastecimentos: Abastecimento[];
  trocasOleo: TrocaOleo[];
  configuracoes?: Partial<Configuracoes>;
};

export type Periodo = {
  from?: string;
  to?: string;
};

export type IntervaloMensal = {
  anoMes: string;
  ano: number;
  mes: number;
  from: string;
  to: string;
};
