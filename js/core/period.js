/*
 * Períodos mensais.
 *
 * O filtro por mês é derivado da DATA DO EVENTO (entrada em manutenção, data da troca de óleo,
 * data e hora do abastecimento, data da retirada, data da peça externa, data da despesa),
 * nunca da data de cadastro do veículo.
 *
 * Um mês é representado por uma string "AAAA-MM" e convertido em { from, to } com datas ISO,
 * reaproveitando Utils.inPeriod nas demais regras. Não há regra de negócio nas telas.
 */
const Period = (function () {
  const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
  const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
  ];

  function lastDayOfMonth(ano, mes) {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  }

  /* "2026-10" -> { from: '2026-10-01', to: '2026-10-31' }. Retorna null quando inválido. */
  function monthRange(anoMes) {
    if (typeof anoMes !== 'string') return null;
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
      to: `${match[1]}-${match[2]}-${String(ultimoDia).padStart(2, '0')}`,
    };
  }

  /* Rótulo legível: "Outubro de 2026". */
  function monthLabel(anoMes) {
    const range = monthRange(anoMes);
    if (!range) return 'Período inválido';
    const nome = MESES[range.mes - 1];
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} de ${range.ano}`;
  }

  /* Mês (AAAA-MM) a que pertence uma data ISO (YYYY-MM-DD ou YYYY-MM-DDTHH:mm). */
  function monthOf(value) {
    if (!value || typeof value !== 'string' || !/^\d{4}-\d{2}/.test(value)) return null;
    return value.slice(0, 7);
  }

  /*
   * Meses disponíveis nos registros, do mais recente para o mais antigo.
   * Considera apenas datas de evento (não a data de cadastro do veículo).
   */
  function availableMonths(state) {
    const vistos = new Set();
    const add = (value) => {
      const mes = monthOf(value);
      if (mes && monthRange(mes)) vistos.add(mes);
    };
    (state.movimentacoes || []).forEach(m => add(m.data));
    (state.pecasExternas || []).forEach(e => add(e.data));
    (state.despesas || []).forEach(d => add(d.data));
    (state.manutencoes || []).forEach(m => { add(m.dataEntrada); add(m.dataConclusao); });
    (state.abastecimentos || []).forEach(a => add(a.dataHora));
    (state.trocasOleo || []).forEach(t => add(t.data));
    return [...vistos].sort((a, b) => b.localeCompare(a));
  }

  /*
   * Opções no formato usado pelas telas: { value, label }.
   * A primeira opção é sempre "Todos os meses" (value '').
   */
  function monthOptions(state, selecionado = '') {
    const opcoes = [{ value: '', label: 'Todos os meses' }];
    availableMonths(state).forEach(anoMes => {
      opcoes.push({ value: anoMes, label: monthLabel(anoMes) });
    });
    return opcoes.map(o => ({ ...o, selected: o.value === selecionado }));
  }

  /* Converte uma seleção de mês em { from, to }. Vazio devolve período aberto. */
  function resolve(anoMes) {
    if (!anoMes) return { from: '', to: '', anoMes: '' };
    const range = monthRange(anoMes);
    if (!range) return { from: '', to: '', anoMes: '' };
    return { from: range.from, to: range.to, anoMes: range.anoMes };
  }

  return { monthRange, monthLabel, monthOf, availableMonths, monthOptions, resolve, MESES };
})();
