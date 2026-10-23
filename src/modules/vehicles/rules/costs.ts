/*
 * Regras de custos (portado de js/core/costs.js).
 *
 * Cada item existe uma unica vez no historico:
 *  - retiradas do almoxarifado: movimentacoes Saida (qtd * valorUnitario da retirada)
 *  - pecas externas: pecasExternas (qtd * valorUnitario)
 *  - outras despesas: despesas vinculadas a manutencao
 *  - trocas de oleo proprias: quando o oleo vem do almoxarifado (movimentacaoId
 *    preenchido), o custo ja esta na retirada e NAO e somado de novo.
 * O custo de combustivel e separado da manutencao e entra em totalGeral.
 */
import { inPeriod, round2, sum } from "./shared";
import { oilOwnCost } from "./oil";
import { fuelSummary } from "./fuel";
import type { DadosFrota } from "./types";

export type FiltrosCustos = {
  veiculoId?: string;
  manutencaoId?: string;
  from?: string;
  to?: string;
};

/**
 * Adaptador de combustivel para o formato de custos.
 * fuelSummary expoe `valor`; os custos consolidados usam `total` para manter
 * o mesmo contrato da demo aprovada (relatorios e testes).
 */
function fuelCostSummary(
  data: DadosFrota,
  filters: { veiculoId?: string; from?: string; to?: string },
) {
  const resumo = fuelSummary(data, filters);
  return {
    registros: resumo.registros,
    litros: resumo.litros,
    total: resumo.valor,
    precoMedio: resumo.precoMedio,
  };
}

function vehicleOfMaintenance(data: DadosFrota, manutencaoId: string): string | null {
  const maintenance = data.manutencoes.find((m) => m.id === manutencaoId);
  return maintenance ? maintenance.veiculoId : null;
}

export function collectCosts(data: DadosFrota, filters: FiltrosCustos = {}) {
  const { veiculoId, manutencaoId, from, to } = filters;

  const retiradas = data.movimentacoes.filter(
    (m) =>
      m.tipo === "Saida" &&
      (!veiculoId || m.veiculoId === veiculoId) &&
      (!manutencaoId || m.manutencaoId === manutencaoId) &&
      inPeriod(m.data, from, to),
  );

  const externas = data.pecasExternas.filter(
    (e) =>
      (!veiculoId || e.veiculoId === veiculoId) &&
      (!manutencaoId || e.manutencaoId === manutencaoId) &&
      inPeriod(e.data, from, to),
  );

  const despesas = data.despesas.filter(
    (d) =>
      (!manutencaoId || d.manutencaoId === manutencaoId) &&
      (!veiculoId || vehicleOfMaintenance(data, d.manutencaoId) === veiculoId) &&
      inPeriod(d.data, from, to),
  );

  const trocasOleo = (data.trocasOleo ?? []).filter(
    (t) =>
      (!veiculoId || t.veiculoId === veiculoId) &&
      (!manutencaoId || t.manutencaoId === manutencaoId) &&
      inPeriod(t.data, from, to),
  );

  const pecasAlmoxarifado = sum(retiradas, (m) => m.quantidade * m.valorUnitario);
  const pecasExternas = sum(externas, (e) => e.quantidade * e.valorUnitario);
  const outrasDespesas = sum(despesas, (d) => d.valor);
  const trocasOleoProprias = sum(trocasOleo, (t) => oilOwnCost(t));

  return {
    retiradas,
    externas,
    despesas,
    trocasOleo,
    pecasAlmoxarifado,
    pecasExternas,
    pecas: round2(pecasAlmoxarifado + pecasExternas),
    outrasDespesas,
    trocasOleoProprias: round2(trocasOleoProprias),
    total: round2(
      pecasAlmoxarifado + pecasExternas + outrasDespesas + trocasOleoProprias,
    ),
  };
}

export function vehicleCosts(data: DadosFrota, veiculoId: string, period: { from?: string; to?: string } = {}) {
  const manutencao = collectCosts(data, {
    veiculoId,
    from: period.from,
    to: period.to,
  });
  const combustivel = fuelCostSummary(data, { veiculoId, from: period.from, to: period.to });
  return {
    ...manutencao,
    combustivel,
    totalGeral: round2(manutencao.total + combustivel.total),
  };
}

export function fleetCosts(data: DadosFrota, period: { from?: string; to?: string } = {}) {
  const manutencao = collectCosts(data, { from: period.from, to: period.to });
  const combustivel = fuelCostSummary(data, { from: period.from, to: period.to });
  return {
    ...manutencao,
    combustivel,
    totalGeral: round2(manutencao.total + combustivel.total),
  };
}

