/*
 * Periodos mensais (portado de js/core/period.js).
 *
 * O mes e derivado da DATA DO EVENTO, nunca da data de cadastro do veiculo:
 *  - movimentacoes (retiradas), pecas externas e despesas;
 *  - manutencoes (entrada e conclusao);
 *  - abastecimentos (data e hora);
 *  - trocas de oleo.
 *
 * A selecao "2026-10" vira { from: "2026-10-01", to: "2026-10-31" } e e aplicada
 * pelas demais regras via inPeriod. Nenhuma regra de tela e necessaria.
 */
import { inPeriod } from "./shared";
import type { DadosFrota, IntervaloMensal } from "./types";

const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

function lastDayOfMonth(ano: number, mes: number) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** "2026-10" -> intervalo completo; null quando o formato/valor e invalido. */
export function monthRange(anoMes: string): IntervaloMensal | null {
  if (typeof anoMes !== "string") return null;
  const match = MONTH_PATTERN.exec(anoMes.trim());
  if (!match) return null;
  const ano = Number(match[1]);
  const mes = Number(match[2]);
  if (mes < 1 || mes > 12) return null;
  const ultimoDia = lastDayOfMonth(ano, mes);
  return {
    anoMes: `${match[1]}-${match[2]}`,
    ano,
    mes,
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

/** Rotulo legivel: "Outubro de 2026". */
export function monthLabel(anoMes: string): string {
  const range = monthRange(anoMes);
  if (!range) return "Período inválido";
  const nome = MESES[range.mes - 1];
  if (!nome) return "Período inválido";
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${range.ano}`;
}

/** Mes (AAAA-MM) de uma data ISO, inclusive data/hora. */
export function monthOf(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string" || !/^\d{4}-\d{2}/.test(value)) return null;
  return value.slice(0, 7);
}

/** Meses com registros, do mais recente para o mais antigo. */
export function availableMonths(data: DadosFrota): string[] {
  const vistos = new Set<string>();
  const add = (value: string | null | undefined) => {
    const mes = monthOf(value);
    if (mes && monthRange(mes)) vistos.add(mes);
  };

  for (const m of data.movimentacoes ?? []) add(m.data);
  for (const e of data.pecasExternas ?? []) add(e.data);
  for (const d of data.despesas ?? []) add(d.data);
  for (const m of data.manutencoes ?? []) {
    add(m.dataEntrada);
    add(m.dataConclusao);
  }
  for (const a of data.abastecimentos ?? []) add(a.dataHora);
  for (const t of data.trocasOleo ?? []) add(t.data);

  return [...vistos].sort((a, b) => b.localeCompare(a));
}

export function monthOptions(data: DadosFrota, selecionado = "") {
  return [
    { value: "", label: "Todos os meses", selected: selecionado === "" },
    ...availableMonths(data).map((anoMes) => ({
      value: anoMes,
      label: monthLabel(anoMes),
      selected: anoMes === selecionado,
    })),
  ];
}

/** Selecao de mes -> periodo aplicavel. Vazio devolve periodo aberto. */
export function resolvePeriod(anoMes: string | null | undefined): {
  from: string;
  to: string;
  anoMes: string;
} {
  if (!anoMes) return { from: "", to: "", anoMes: "" };
  const range = monthRange(anoMes);
  if (!range) return { from: "", to: "", anoMes: "" };
  return { from: range.from, to: range.to, anoMes: range.anoMes };
}

/** Reexport para conveniencia dos consumidores das regras. */
export { inPeriod };
