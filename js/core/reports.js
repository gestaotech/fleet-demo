/*
 * Montagem dos dados dos relatórios. Todos os números são derivados das entidades compartilhadas.
 * Não há valores digitados manualmente nem totais armazenados.
 */
const Reports = (function () {
  function fleetGeneral(state, period = {}) {
    const summary = Vehicles.summary(state);
    const manutencoes = Maintenance.list(state, period);
    const custos = Costs.fleetCosts(state, period);
    return {
      ...summary,
      manutencoesAbertas: state.manutencoes.filter(Maintenance.isOpen).length,
      manutencoesNoPeriodo: manutencoes.length,
      gastos: custos.total,
      custos,
    };
  }

  /* Linha por veículo, com situação cadastral, operacional e custo total do período. */
  function vehiclesReport(state, filters = {}) {
    const period = { from: filters.from, to: filters.to };
    return Vehicles.filter(state, filters).map(v => ({
      ...v,
      operacional: Vehicles.operationalStatus(state, v.id),
      custoTotal: Costs.vehicleCosts(state, v.id, period).total,
    })).sort((a, b) => a.placa.localeCompare(b.placa));
  }

  function warehouseReport(state, filters = {}) {
    const rows = Warehouse.filterInventory(Warehouse.inventory(state), filters);
    const totals = {
      pecas: rows.length,
      saldoTotal: rows.reduce((acc, r) => acc + r.saldo, 0),
      valorEstimado: Utils.sum(rows, r => r.valorEstimado),
      baixo: rows.filter(r => r.baixo).length,
      entradas: rows.reduce((acc, r) => acc + r.entradas, 0),
      retiradas: rows.reduce((acc, r) => acc + r.retiradas, 0),
    };
    return { rows, totals };
  }

  function withdrawalsReport(state, filters = {}) {
    const rows = Warehouse.withdrawals(state, filters);
    return {
      rows,
      totals: {
        quantidade: rows.reduce((acc, r) => acc + r.quantidade, 0),
        valor: Utils.sum(rows, r => r.valorTotal),
      },
    };
  }

  /* Custos separados: peças (almoxarifado + externas), despesas registradas e custo total. */
  function maintenanceReport(state, filters = {}) {
    const rows = Maintenance.list(state, filters).map(m => {
      const costs = Costs.maintenanceCosts(state, m.id);
      const vehicle = Vehicles.find(state, m.veiculoId);
      return {
        ...m,
        veiculoPlaca: vehicle ? vehicle.placa : m.veiculoId,
        veiculoMarca: vehicle ? vehicle.marca : '',
        pecasUtilizadas: costs.retiradas.length + costs.externas.length,
        custoPecas: costs.pecas,
        despesas: costs.outrasDespesas,
        custoTotal: costs.total,
      };
    });
    return {
      rows,
      totals: {
        quantidade: rows.length,
        abertas: rows.filter(r => r.status === 'Aberta').length,
        emAndamento: rows.filter(r => r.status === 'Em andamento').length,
        concluidas: rows.filter(r => r.status === 'Concluída').length,
        custoTotal: Utils.sum(rows, r => r.custoTotal),
      },
    };
  }

  /* Visão consolidada por seções, para o relatório completo. */
  function fullReport(state, period = {}) {
    const general = fleetGeneral(state, period);
    const vehicles = vehiclesReport(state, period);
    const maintenances = maintenanceReport(state, period).totals;
    const withdrawals = withdrawalsReport(state, period).totals;
    const entries = state.movimentacoes
      .filter(m => m.tipo === 'Entrada' && Utils.inPeriod(m.data, period.from, period.to));
    const external = Warehouse.externalParts(state, period);
    const warehouse = warehouseReport(state);

    return {
      periodo: period,
      geral: general,
      situacaoVeiculos: vehicles.map(v => ({ placa: v.placa, marca: v.marca, situacao: v.situacao, operacional: v.operacional })),
      manutencoes: maintenances,
      almoxarifado: {
        ...warehouse.totals,
        entradasPeriodo: entries.length,
        entradasValor: Utils.sum(entries, m => m.quantidade * m.valorUnitario),
        retiradasPeriodo: withdrawals.quantidade,
        retiradasValor: withdrawals.valor,
      },
      externas: {
        quantidade: external.reduce((acc, e) => acc + e.quantidade, 0),
        valor: Utils.sum(external, e => e.valorTotal),
        registros: external.length,
      },
      custos: general.custos,
      veiculosPorCusto: [...vehicles].sort((a, b) => b.custoTotal - a.custoTotal),
    };
  }

  /* CSV com separador ";" e BOM UTF-8, para abrir corretamente no Excel em português. */
  function toCsv(headers, rows) {
    const escape = (value) => {
      if (value === null || value === undefined) return '';
      const text = typeof value === 'number' ? Utils.csvNumber(value) : String(value);
      return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return '\uFEFF' + [headers, ...rows].map(row => row.map(escape).join(';')).join('\r\n');
  }

  return { fleetGeneral, vehiclesReport, warehouseReport, withdrawalsReport, maintenanceReport, fullReport, toCsv };
})();
