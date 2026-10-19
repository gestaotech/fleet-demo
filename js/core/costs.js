/*
 * Cálculo de custos de manutenção.
 * Cada item existe uma única vez no histórico:
 *  - retiradas do almoxarifado: movimentações do tipo "Saida" (quantidade x valor unitário da retirada);
 *  - peças externas: registros de pecasExternas (quantidade x valor unitário);
 *  - outras despesas: registros de despesas vinculados a uma manutenção.
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

    const pecasAlmoxarifado = Utils.sum(retiradas, m => m.quantidade * m.valorUnitario);
    const pecasExternas = Utils.sum(externas, e => e.quantidade * e.valorUnitario);
    const outrasDespesas = Utils.sum(despesas, d => d.valor);

    return {
      retiradas,
      externas,
      despesas,
      pecasAlmoxarifado,
      pecasExternas,
      pecas: Utils.round2(pecasAlmoxarifado + pecasExternas),
      outrasDespesas,
      total: Utils.round2(pecasAlmoxarifado + pecasExternas + outrasDespesas),
    };
  }

  function vehicleCosts(state, veiculoId, period = {}) {
    return collect(state, { veiculoId, from: period.from, to: period.to });
  }

  function maintenanceCosts(state, manutencaoId) {
    return collect(state, { manutencaoId });
  }

  function fleetCosts(state, period = {}) {
    return collect(state, { from: period.from, to: period.to });
  }

  return { collect, vehicleCosts, maintenanceCosts, fleetCosts };
})();
