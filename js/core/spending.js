/*
 * Gastos externos: compras de peças e insumos que não são de manutenção (material de limpeza,
 * EPI, lubrificantes avulsos etc.). O almoxarifado é responsável pelo registro, mas o gasto
 * não altera o saldo do estoque e não entra nos custos de manutenção dos veículos.
 */
const ExternalSpending = (function () {
  const TIPOS = ['Peça', 'Insumo'];

  function find(state, id) {
    return (state.gastosExternos || []).find(g => g.id === id) || null;
  }

  function validate(data) {
    const errors = [];
    const dataCompra = data.data;
    const tipo = data.tipo;
    const descricao = Utils.normalizeText(data.descricao);
    const quantidade = Utils.parseQuantidade(data.quantidade);
    const valorUnitario = Utils.parseMoney(data.valorUnitario);
    const fornecedor = Utils.normalizeText(data.fornecedor);
    const responsavel = Utils.normalizeText(data.responsavel);

    if (!Utils.isValidDate(dataCompra)) errors.push('Informe a data da compra.');
    if (!TIPOS.includes(tipo)) errors.push('Selecione o tipo: Peça ou Insumo.');
    if (!descricao) errors.push('Informe a descrição do item comprado.');
    if (!(quantidade > 0)) errors.push('Informe a quantidade maior que zero (use fração, como 1/2, se necessário).');
    if (!(valorUnitario > 0)) errors.push('Informe o valor unitário maior que zero.');
    if (!fornecedor) errors.push('Informe o fornecedor.');
    if (!responsavel) errors.push('Informe o responsável pelo registro.');

    const valorTotal = Number.isFinite(quantidade) && Number.isFinite(valorUnitario) ? Utils.round2(quantidade * valorUnitario) : NaN;
    return {
      errors,
      value: {
        data: dataCompra,
        tipo,
        descricao,
        quantidade,
        valorUnitario,
        valorTotal,
        fornecedor,
        responsavel,
        observacao: Utils.normalizeText(data.observacao),
      },
    };
  }

  function create(state, data) {
    const checked = validate(data);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    if (!state.gastosExternos) state.gastosExternos = [];
    const gasto = { id: Utils.nextId('GEX', state.gastosExternos, 4), ...checked.value };
    state.gastosExternos.push(gasto);
    return { ok: true, value: gasto };
  }

  function update(state, id, data) {
    const gasto = find(state, id);
    if (!gasto) return { ok: false, errors: ['Gasto não encontrado.'] };
    const checked = validate(data);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    Object.assign(gasto, checked.value);
    return { ok: true, value: gasto };
  }

  function remove(state, id) {
    const gasto = find(state, id);
    if (!gasto) return { ok: false, errors: ['Gasto não encontrado.'] };
    state.gastosExternos.splice(state.gastosExternos.indexOf(gasto), 1);
    return { ok: true, value: gasto };
  }

  /* filtros: { from, to, tipo: 'Todos'|'Peça'|'Insumo' }. Mais recentes primeiro. */
  function list(state, filters = {}) {
    return (state.gastosExternos || [])
      .filter(g => Utils.inPeriod(g.data, filters.from, filters.to))
      .filter(g => !filters.tipo || filters.tipo === 'Todos' || g.tipo === filters.tipo)
      .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  }

  function summary(rows) {
    return {
      registros: rows.length,
      valorTotal: Utils.sum(rows, r => r.valorTotal),
      porTipo: {
        'Peça': Utils.sum(rows.filter(r => r.tipo === 'Peça'), r => r.valorTotal),
        Insumo: Utils.sum(rows.filter(r => r.tipo === 'Insumo'), r => r.valorTotal),
      },
    };
  }

  return { TIPOS, find, validate, create, update, remove, list, summary };
})();
