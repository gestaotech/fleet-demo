/*
 * Regras do almoxarifado (portado de js/core/warehouse.js).
 *
 * O saldo nunca e digitado: e sempre Entrada - Saida das movimentacoes.
 * Cada retirada guarda o valor unitario vigente no momento, preservando o
 * custo historico mesmo que o cadastro da peca mude depois.
 */
import { inPeriod, round2 } from "./shared";
import type { DadosFrota, Movimentacao, Peca } from "./types";

export function findPart(data: DadosFrota, id: string): Peca | null {
  return data.pecas.find((p) => p.id === id) ?? null;
}

export function balance(data: DadosFrota, pecaId: string): number {
  return data.movimentacoes.reduce((acc, m) => {
    if (m.pecaId !== pecaId) return acc;
    return acc + (m.tipo === "Entrada" ? m.quantidade : -m.quantidade);
  }, 0);
}

export function isLowStock(part: Peca, saldo: number): boolean {
  return saldo <= part.estoqueMinimo;
}

export function inventory(data: DadosFrota) {
  return data.pecas.map((part) => {
    const saldo = balance(data, part.id);
    const entradas = data.movimentacoes
      .filter((m) => m.pecaId === part.id && m.tipo === "Entrada")
      .reduce((acc, m) => acc + m.quantidade, 0);
    const retiradas = data.movimentacoes
      .filter((m) => m.pecaId === part.id && m.tipo === "Saida")
      .reduce((acc, m) => acc + m.quantidade, 0);
    return {
      ...part,
      saldo,
      entradas,
      retiradas,
      valorEstimado: round2(saldo * part.valorUnitario),
      baixo: isLowStock(part, saldo),
    };
  });
}

/** Historico cronologico estavel com saldo acumulado apos cada movimento. */
export function movementsOf(data: DadosFrota, pecaId: string) {
  const ordered = data.movimentacoes
    .map((m, index) => ({ m, index }))
    .filter((item) => item.m.pecaId === pecaId)
    .sort((a, b) => a.m.data.localeCompare(b.m.data) || a.index - b.index)
    .map((item) => item.m);

  let saldo = 0;
  return ordered.map((m) => {
    saldo += m.tipo === "Entrada" ? m.quantidade : -m.quantidade;
    return { ...m, saldoApos: saldo };
  });
}

export type FiltroRetiradas = {
  from?: string;
  to?: string;
  veiculoId?: string;
  pecaId?: string;
};

export function withdrawals(data: DadosFrota, filters: FiltroRetiradas = {}) {
  return data.movimentacoes
    .filter((m) => m.tipo === "Saida")
    .filter((m) => inPeriod(m.data, filters.from, filters.to))
    .filter(
      (m) =>
        !filters.veiculoId ||
        filters.veiculoId === "Todos" ||
        m.veiculoId === filters.veiculoId,
    )
    .filter(
      (m) =>
        !filters.pecaId ||
        filters.pecaId === "Todas" ||
        m.pecaId === filters.pecaId,
    )
    .map((m) => {
      const part = findPart(data, m.pecaId);
      return {
        ...m,
        pecaDescricao: part ? part.descricao : m.pecaId,
        valorTotal: round2(m.quantidade * m.valorUnitario),
        origem: m.manutencaoId ? `Manutenção ${m.manutencaoId}` : "Retirada direta",
      };
    })
    .sort((a, b) => b.data.localeCompare(a.data));
}

export function externalParts(
  data: DadosFrota,
  filters: FiltroRetiradas = {},
) {
  return data.pecasExternas
    .filter((e) => inPeriod(e.data, filters.from, filters.to))
    .filter(
      (e) =>
        !filters.veiculoId ||
        filters.veiculoId === "Todos" ||
        e.veiculoId === filters.veiculoId,
    )
    .map((e) => ({ ...e, valorTotal: round2(e.quantidade * e.valorUnitario) }))
    .sort((a, b) => b.data.localeCompare(a.data));
}

/** Validacao de retirada (saldo insuficiente nao pode ser gravado). */
export function validateWithdrawal(
  data: DadosFrota,
  input: {
    pecaId: string;
    veiculoId: string;
    quantidade: number;
    manutencaoId?: string | null;
    data: string;
    responsavel?: string;
  },
): { errors: string[] } {
  const errors: string[] = [];
  const part = findPart(data, input.pecaId);
  const veiculo = data.veiculos.find((v) => v.id === input.veiculoId) ?? null;
  const manutencao = input.manutencaoId
    ? data.manutencoes.find((m) => m.id === input.manutencaoId) ?? null
    : null;

  if (!part) errors.push("Selecione a peça retirada.");
  if (!veiculo) errors.push("Selecione o veículo de destino.");
  else if (veiculo.situacao !== "Ativo")
    errors.push("Veículo inativo não pode receber peças do almoxarifado.");
  if (input.manutencaoId && !manutencao)
    errors.push("A manutenção informada não foi encontrada.");
  else if (manutencao && manutencao.status === "Concluída")
    errors.push("A manutenção informada não está aberta.");
  else if (manutencao && veiculo && manutencao.veiculoId !== veiculo.id)
    errors.push("A manutenção informada pertence a outro veículo.");

  if (!Number.isInteger(input.quantidade) || input.quantidade <= 0) {
    errors.push("Informe uma quantidade maior que zero.");
  } else if (part) {
    const saldo = balance(data, part.id);
    if (input.quantidade > saldo) {
      errors.push(
        `Saldo insuficiente para ${part.descricao}: disponível ${saldo}, solicitado ${input.quantidade}.`,
      );
    }
  }
  if (!input.responsavel?.trim()) errors.push("Informe o responsável pela solicitação.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.data)) errors.push("Informe a data da retirada.");

  return { errors };
}

/** Custo historico de uma retirada: valor unitario gravado no movimento. */
export function withdrawalCost(movimento: Movimentacao): number {
  return round2(movimento.quantidade * movimento.valorUnitario);
}
