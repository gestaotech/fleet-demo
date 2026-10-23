/*
 * Regras de troca de oleo (portado de js/core/oil.js).
 *
 * Nao existe intervalo universal: cada troca informa (ou deixa pendente) o
 * intervalo em km e em meses. O sistema apenas projeta limites e classifica.
 *
 * Custo: quando o oleo vem do almoxarifado, a troca aponta para a movimentacao
 * de retirada e NAO soma custo proprio. Assim o mesmo valor nunca entra duas
 * vezes no total do veiculo.
 */
import { addMonths, daysBetween, round2, todayIso, isValidDate } from "./shared";
import { currentKm } from "./vehicles";
import type { Configuracoes, DadosFrota, TrocaOleo } from "./types";

export const SITUACOES_OLEO = [
  "Em dia",
  "Próxima da troca",
  "Vencida por quilometragem",
  "Vencida por tempo",
  "Vencida por ambos",
  "Pendente de dados",
] as const;

export type SituacaoOleo = (typeof SITUACOES_OLEO)[number];

const CONFIG_PADRAO: Configuracoes = {
  alertaTrocaOleoKm: 1000,
  alertaTrocaOleoDias: 30,
};

export function oilConfig(data: DadosFrota): Configuracoes {
  const atual = data.configuracoes ?? {};
  const km = Number(atual.alertaTrocaOleoKm);
  const dias = Number(atual.alertaTrocaOleoDias);
  return {
    alertaTrocaOleoKm:
      Number.isFinite(km) && km >= 0 ? km : CONFIG_PADRAO.alertaTrocaOleoKm,
    alertaTrocaOleoDias:
      Number.isFinite(dias) && dias >= 0 ? dias : CONFIG_PADRAO.alertaTrocaOleoDias,
  };
}

/** Custo proprio (zero quando o oleo veio do estoque e o custo esta na retirada). */
export function oilOwnCost(troca: TrocaOleo): number {
  if (troca.movimentacaoId) return 0;
  const quantidade = Number(troca.quantidade);
  const valorUnitario = Number(troca.valorUnitario);
  if (!Number.isFinite(quantidade) || !Number.isFinite(valorUnitario)) return 0;
  return round2(quantidade * valorUnitario);
}

export function oilWithdrawalCost(data: DadosFrota, troca: TrocaOleo): number {
  if (!troca.movimentacaoId) return 0;
  const movimento = data.movimentacoes.find((m) => m.id === troca.movimentacaoId);
  if (!movimento) return 0;
  return round2(Number(movimento.quantidade) * Number(movimento.valorUnitario));
}

export function oilTotalCost(data: DadosFrota, troca: TrocaOleo): number {
  return troca.movimentacaoId
    ? oilWithdrawalCost(data, troca)
    : oilOwnCost(troca);
}

export function oilRecords(data: DadosFrota, veiculoId: string): TrocaOleo[] {
  return data.trocasOleo
    .filter((t) => t.veiculoId === veiculoId)
    .slice()
    .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
}

export function lastOilChange(data: DadosFrota, veiculoId: string) {
  return oilRecords(data, veiculoId)[0] ?? null;
}

export type StatusOleo = {
  situacao: SituacaoOleo;
  limiteKm: number | null;
  limiteData: string | null;
  kmTroca: number | null;
  kmAtual: number | null;
  kmRestante: number | null;
  diasRestantes: number | null;
  intervaloKm: number | null;
  intervaloMeses: number | null;
  avaliavel: boolean;
};

/** Situacao da troca. `options.hoje` congela a data de referencia nos testes. */
export function oilStatus(
  data: DadosFrota,
  troca: TrocaOleo,
  options: { hoje?: string } = {},
): StatusOleo {
  const hoje = options.hoje ?? todayIso();
  const conf = oilConfig(data);
  const kmTroca = Number.isInteger(troca.quilometragem) ? troca.quilometragem : null;
  const intervaloKm =
    Number.isInteger(troca.intervaloKm) && (troca.intervaloKm ?? 0) > 0
      ? troca.intervaloKm
      : null;
  const intervaloMeses =
    Number.isInteger(troca.intervaloMeses) && (troca.intervaloMeses ?? 0) > 0
      ? troca.intervaloMeses
      : null;

  const limiteKm = kmTroca !== null && intervaloKm !== null ? kmTroca + intervaloKm : null;
  const limiteData =
    intervaloMeses !== null && isValidDate(troca.data)
      ? addMonths(troca.data, intervaloMeses)
      : null;

  const kmAtual = currentKm(data, troca.veiculoId);
  const kmRestante = limiteKm !== null && kmAtual !== null ? limiteKm - kmAtual : null;
  const diasRestantes =
    limiteData !== null ? daysBetween(hoje, limiteData) : null;

  const vencidaKm = kmRestante !== null && kmRestante <= 0;
  const vencidaTempo = diasRestantes !== null && diasRestantes <= 0;

  let situacao: SituacaoOleo;
  if (vencidaKm && vencidaTempo) situacao = "Vencida por ambos";
  else if (vencidaKm) situacao = "Vencida por quilometragem";
  else if (vencidaTempo) situacao = "Vencida por tempo";
  else if (kmRestante !== null && kmRestante <= conf.alertaTrocaOleoKm)
    situacao = "Próxima da troca";
  else if (diasRestantes !== null && diasRestantes <= conf.alertaTrocaOleoDias)
    situacao = "Próxima da troca";
  else if (limiteKm === null && limiteData === null) situacao = "Pendente de dados";
  else if (limiteKm !== null && kmAtual === null) situacao = "Pendente de dados";
  else situacao = "Em dia";

  return {
    situacao,
    limiteKm,
    limiteData,
    kmTroca,
    kmAtual,
    kmRestante,
    diasRestantes,
    intervaloKm,
    intervaloMeses,
    avaliavel: limiteKm !== null || limiteData !== null,
  };
}

export function oilStatusByVehicle(
  data: DadosFrota,
  options: { hoje?: string } = {},
) {
  return data.veiculos.map((veiculo) => {
    const ultima = lastOilChange(data, veiculo.id);
    const info = ultima ? oilStatus(data, ultima, options) : null;
    return {
      veiculoId: veiculo.id,
      placa: veiculo.placa,
      kmAtual: currentKm(data, veiculo.id),
      ultimaTroca: ultima,
      situacao: info ? info.situacao : ("Pendente de dados" as SituacaoOleo),
      limiteKm: info ? info.limiteKm : null,
      limiteData: info ? info.limiteData : null,
      kmRestante: info ? info.kmRestante : null,
      diasRestantes: info ? info.diasRestantes : null,
      custoTotal: ultima ? oilTotalCost(data, ultima) : 0,
    };
  });
}
