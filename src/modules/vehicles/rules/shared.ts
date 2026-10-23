/*
 * Funcoes puras compartilhadas pelas regras portadas da demo aprovada.
 * Nao acessam DOM, banco ou variaveis de ambiente.
 */

export function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function round3(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

export function sum<T>(items: readonly T[], selector: (item: T) => number): number {
  return round2(items.reduce((acc, item) => acc + Number(selector(item) || 0), 0));
}

/** Compara apenas a parte da data (aceita data/hora ISO), inclusive nas bordas. */
export function inPeriod(
  value: string | null | undefined,
  from?: string,
  to?: string,
): boolean {
  if (!value) return false;
  const day = value.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

/** Soma meses a uma data ISO, ajustando o dia ao ultimo dia do mes destino. */
export function addMonths(isoDate: string, months: number): string | null {
  if (!isValidDate(isoDate) || !Number.isInteger(months) || months <= 0) return null;
  const [y, m, d] = isoDate.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return null;
  const targetMonth = m - 1 + months;
  const targetYear = y + Math.floor(targetMonth / 12);
  const monthIndex = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

export function daysBetween(fromIso: string, toIso: string): number | null {
  if (!isValidDate(fromIso) || !isValidDate(toIso)) return null;
  const parse = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1);
  };
  return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
}

/** Data de hoje em ISO (America/Sao_Paulo e apenas exibicao; a regra usa UTC). */
export function todayIso(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}`;
}
