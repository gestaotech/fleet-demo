/* Funções puras: formatação, datas, números e identificadores. Sem acesso ao DOM. */
const Utils = (function () {
  const moneyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function nowIso() {
    const d = new Date();
    return `${todayIso()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function isValidDate(value) {
    if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }

  function isValidDateTime(value) {
    if (typeof value !== 'string' || !ISO_DATETIME.test(value)) return false;
    const hours = Number(value.slice(11, 13));
    const minutes = Number(value.slice(14, 16));
    return isValidDate(value.slice(0, 10)) && hours < 24 && minutes < 60;
  }

  function round2(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatMoney(value) {
    return moneyFormatter.format(round2(Number(value) || 0));
  }

  function formatDate(value) {
    if (!value) return '—';
    const [y, m, d] = value.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  function formatDateTime(value) {
    if (!value) return '—';
    return `${formatDate(value)} ${value.slice(11, 16)}`;
  }

  /* Aceita "1.450,00", "1450,5", "1450.50" e "1.450" (ponto como milhar quando há três dígitos após ele). */
  function parseMoney(text) {
    if (typeof text === 'number') {
      return Number.isFinite(text) && text >= 0 ? round2(text) : NaN;
    }
    let t = String(text ?? '').trim().replace(/\s/g, '').replace(/^R\$/, '');
    if (!t) return NaN;
    if (t.includes(',')) {
      t = t.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
      t = t.replace(/\./g, '');
    }
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
    return round2(Number(t));
  }

  function parseInteger(text) {
    if (typeof text === 'number') return Number.isInteger(text) ? text : NaN;
    const t = String(text ?? '').trim();
    return /^\d+$/.test(t) ? Number(t) : NaN;
  }

  /* Quantidades com até 3 casas (litros, por exemplo), aceitando vírgula ou ponto decimal. */
  function parseDecimal(text) {
    if (typeof text === 'number') return Number.isFinite(text) && text >= 0 ? round2(text) : NaN;
    let t = String(text ?? '').trim().replace(/\s/g, '');
    if (!t) return NaN;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,3})?$/.test(t)) return NaN;
    return Math.round(Number(t) * 1000) / 1000;
  }

  /* Soma meses a uma data ISO (AAAA-MM-DD), ajustando o dia ao fim do mês quando necessário. */
  function addMonths(isoDate, months) {
    if (!isValidDate(isoDate) || !Number.isInteger(months) || months <= 0) return null;
    const [y, m, d] = isoDate.split('-').map(Number);
    const targetMonth = m - 1 + months;
    const targetYear = y + Math.floor(targetMonth / 12);
    const monthIndex = ((targetMonth % 12) + 12) % 12;
    const lastDay = new Date(Date.UTC(targetYear, monthIndex + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${targetYear}-${pad(monthIndex + 1)}-${pad(day)}`;
  }

  /* Diferença em dias inteiros entre duas datas ISO (b - a). */
  function utcTime(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  }

  function daysBetween(fromIso, toIso) {
    if (!isValidDate(fromIso) || !isValidDate(toIso)) return null;
    return Math.round((utcTime(toIso) - utcTime(fromIso)) / 86400000);
  }

  const quantityFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
  const kmFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

  function formatQuantity(value) {
    return quantityFormatter.format(Number(value) || 0);
  }

  function formatKm(value) {
    if (value === null || value === undefined || value === '') return '—';
    return `${kmFormatter.format(Number(value))} km`;
  }

  function nextId(prefix, items, width = 3) {
    const pattern = new RegExp(`^${prefix}-(\\d+)$`);
    const max = items.reduce((acc, item) => {
      const match = pattern.exec(item.id);
      return match ? Math.max(acc, Number(match[1])) : acc;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(width, '0')}`;
  }

  function normalizeText(value) {
    return String(value ?? '').trim().replace(/\s+/g, ' ');
  }

  /*
   * Texto para comparação de pesquisa: sem acentos, minúsculo e sem espaços nas pontas.
   * Assim "oleo" encontra "Óleo" e "filtro de ar" é encontrado por "FILTRO".
   */
  function searchKey(value) {
    return normalizeText(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function normalizePlate(value) {
    return String(value ?? '').toUpperCase().replace(/[\s-]/g, '');
  }

  function sameText(a, b) {
    return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
  }

  /* Período por datas ISO (YYYY-MM-DD); aceita também datas com hora, comparando só o dia. */
  function inPeriod(value, from, to) {
    if (!value) return false;
    const day = value.slice(0, 10);
    if (from && day < from) return false;
    if (to && day > to) return false;
    return true;
  }

  function sum(items, selector) {
    return round2(items.reduce((acc, item) => acc + Number(selector(item) || 0), 0));
  }

  function csvNumber(value) {
    return round2(value).toFixed(2).replace('.', ',');
  }

  return {
    todayIso, nowIso, isValidDate, isValidDateTime, round2,
    formatMoney, formatDate, formatDateTime, formatQuantity, formatKm,
    parseMoney, parseInteger, parseDecimal, nextId,
    addMonths, daysBetween,
    normalizeText, normalizePlate, sameText, searchKey, inPeriod, sum, csvNumber,
  };
})();
