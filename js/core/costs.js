/*
 * Cálculo de custos de manutenção.
 * Cada item existe uma única vez no histórico:
 *  - retiradas do almoxarifado: movimentações do tipo "Saida" (quantidade x valor unitário da retirada);
 *  - peças externas: registros de pecasExternas (quantidade x valor unitário);
 *  - outras despesas: registros de despesas vinculados a uma manutenção;
 *  - trocas de óleo: apenas o custo próprio da troca (quantidade x valor unitário). Quando o óleo
 *    vem do almoxarifado, a troca aponta para a movimentação e o custo já está em "retiradas",
 *    portanto não é somado de novo — evitando contagem duplicada.
 * Nenhum valor é copiado para outra entidade, por isso não há duplicidade de custos.
 */
const Costs = (function () {
  function vehicleOfMaintenance(state, manutencaoId) {
    const maintenance = Maintenance.find(state, manutencaoId);
    return maintenance ? maintenance.veiculoId : null;
  }

  /* filtros: { veiculoId, manutencaoId, from, to } — todos opcionais */
  function collect(state, filters = {}) {
    const { veiculoId, manutencaoId, from, to } = filters;

    const retiradas = state.movimentacoes.filter(m =>
      m.tipo === 'Saida' &&
      (!veiculoId || m.veiculoId === veiculoId) &&
      (!manutencaoId || m.manutencaoId === manutencaoId) &&
      Utils.inPeriod(m.data, from, to));

    const externas = state.pecasExternas.filter(e =>
      (!veiculoId || e.veiculoId === veiculoId) &&
      (!manutencaoId || e.manutencaoId === manutencaoId) &&
      Utils.inPeriod(e.data, from, to));

    const despesas = state.despesas.filter(d =>
      (!manutencaoId || d.manutencaoId === manutencaoId) &&
      (!veiculoId || vehicleOfMaintenance(state, d.manutencaoId) === veiculoId) &&
      Utils.inPeriod(d.data, from, to));

    const trocasOleo = (state.trocasOleo || []).filter(t =>
      (!veiculoId || t.veiculoId === veiculoId) &&
      (!manutencaoId || t.manutencaoId === manutencaoId) &&
      Utils.inPeriod(t.data, from, to));

    const pecasAlmoxarifado = Utils.sum(retiradas, m => m.quantidade * m.valorUnitario);
    const pecasExternas = Utils.sum(externas, e => e.quantidade * e.valorUnitario);
    const outrasDespesas = Utils.sum(despesas, d => d.valor);
    const trocasOleoProprias = Utils.sum(trocasOleo, t => Oil.ownCost(t));

    return {
      retiradas,
      externas,
      despesas,
      trocasOleo,
      pecasAlmoxarifado,
      pecasExternas,
      pecas: Utils.round2(pecasAlmoxarifado + pecasExternas),
      outrasDespesas,
      trocasOleoProprias: Utils.round2(trocasOleoProprias),
      total: Utils.round2(pecasAlmoxarifado + pecasExternas + outrasDespesas + trocasOleoProprias),
    };
  }

  /* Custo de combustível é separado da manutenção (não entra no total de manutenção). */
  function fuelCost(state, filters = {}) {
    const rows = Fuel.list(state, filters);
    return {
      registros: rows.length,
      litros: Math.round(rows.reduce((acc, r) => acc + r.litros, 0) * 1000) / 1000,
      total: Utils.sum(rows, r => r.valorTotal),
    };
  }

  function vehicleCosts(state, veiculoId, period = {}) {
    const manutencao = collect(state, { veiculoId, from: period.from, to: period.to });
    const combustivel = fuelCost(state, { veiculoId, from: period.from, to: period.to });
    return { ...manutencao, combustivel, totalGeral: Utils.round2(manutencao.total + combustivel.total) };
  }

  function maintenanceCosts(state, manutencaoId) {
    return collect(state, { manutencaoId });
  }

  function fleetCosts(state, period = {}) {
    const manutencao = collect(state, { from: period.from, to: period.to });
    const combustivel = fuelCost(state, { from: period.from, to: period.to });
    return { ...manutencao, combustivel, totalGeral: Utils.round2(manutencao.total + combustivel.total) };
  }

  return { collect, fuelCost, vehicleCosts, maintenanceCosts, fleetCosts };
})();
