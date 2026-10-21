/*
 * Montagem dos dados dos relatórios. Todos os números são derivados das entidades compartilhadas.
 * Não há valores digitados manualmente nem totais armazenados.
 */
const Reports = (function () {
  function fleetGeneral(state, period = {}) {
    const summary = Vehicles.summary(state);
    const manutencoes = Maintenance.list(state, period);
    const custos = Costs.fleetCosts(state, period);
    const oleo = Oil.summary(state);
    return {
      ...summary,
      manutencoesAbertas: state.manutencoes.filter(Maintenance.isOpen).length,
      manutencoesNoPeriodo: manutencoes.length,
      abastecimentosNoPeriodo: Fuel.list(state, period).length,
      trocasOleo: oleo.total,
      trocasOleoVencidas: oleo.vencidas,
      gastos: custos.total,
      custos,
    };
  }

  /* Linha por veículo, com situação cadastral, operacional e custos separados. */
  function vehiclesReport(state, filters = {}) {
    const period = { from: filters.from, to: filters.to };
    return Vehicles.filter(state, filters).map(v => {
      const costs = Costs.vehicleCosts(state, v.id, period);
      const consumo = Fuel.consumption(state, v.id);
      return {
        ...v,
        operacional: Vehicles.operationalStatus(state, v.id),
        kmAtual: Vehicles.currentKm(state, v.id),
        consumoMedio: consumo.media,
        custoManutencao: costs.total,
        custoCombustivel: costs.combustivel.total,
        custoTotal: costs.totalGeral,
      };
    }).sort((a, b) => a.placa.localeCompare(b.placa));
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

  /* Relatório de combustível: gastos, litros, abastecimentos e consumo por veículo. */
  function fuelReport(state, filters = {}) {
    const period = { from: filters.from, to: filters.to };
    const rows = Fuel.list(state, filters);
    const vehicles = Vehicles.filter(state, { termo: filters.termo, situacao: filters.situacao, operacional: filters.operacional })
      .map(v => {
        const consumo = Fuel.consumption(state, v.id);
        const resumo = Fuel.summary(state, { veiculoId: v.id, from: period.from, to: period.to });
        return {
          veiculoId: v.id,
          placa: v.placa,
          marca: v.marca,
          kmAtual: Vehicles.currentKm(state, v.id),
          abastecimentos: resumo.registros,
          litros: resumo.litros,
          valor: resumo.valor,
          precoMedio: resumo.precoMedio,
          consumoMedio: consumo.media,
          consumoStatus: consumo.suficiente
            ? `${consumo.segmentos.length} intervalo(s) válido(s)`
            : 'Dados insuficientes para calcular o consumo',
        };
      })
      .filter(v => !filters.veiculoId || filters.veiculoId === 'Todos' || v.veiculoId === filters.veiculoId)
      .sort((a, b) => b.valor - a.valor);

    const litrosValidos = vehicles.reduce((acc, v) => acc + v.litros, 0);
    const valorValido = Utils.sum(vehicles, v => v.valor);
    return {
      rows,
      vehicles,
      totals: {
        registros: rows.length,
        litros: Math.round(litrosValidos * 1000) / 1000,
        valor: valorValido,
        precoMedio: litrosValidos > 0 ? Math.round((valorValido / litrosValidos) * 1000) / 1000 : null,
        veiculosComConsumo: vehicles.filter(v => v.consumoMedio !== null).length,
        veiculosSemDados: vehicles.filter(v => v.consumoMedio === null).length,
      },
    };
  }

  /* Relatório de trocas de óleo: última troca por veículo, próximos limites e alertas. */
  function oilReport(state, filters = {}, options = {}) {
    const rows = Oil.list(state, filters, options);
    const porVeiculo = Oil.statusByVehicle(state, options)
      .filter(v => !filters.veiculoId || filters.veiculoId === 'Todos' || v.veiculoId === filters.veiculoId);
    const contagem = {};
    Oil.SITUACOES.forEach(s => { contagem[s] = 0; });
    porVeiculo.forEach(v => { contagem[v.situacao] = (contagem[v.situacao] || 0) + 1; });
    return {
      rows,
      porVeiculo,
      configuracoes: Oil.configuracoes(state),
      totals: {
        total: rows.length,
        custoTotal: Utils.sum(rows, r => r.custoTotal),
        porSituacao: contagem,
        vencidas: (contagem['Vencida por quilometragem'] || 0) + (contagem['Vencida por tempo'] || 0) + (contagem['Vencida por ambos'] || 0),
        proximas: contagem['Próxima da troca'] || 0,
        pendentes: contagem['Pendente de dados'] || 0,
      },
    };
  }

  /* Visão consolidada por seções, para o relatório completo. */
  function fullReport(state, period = {}) {
    const general = fleetGeneral(state, period);
    const vehicles = vehiclesReport(state, period);
    const maintenances = maintenanceReport(state, period).totals;
    const withdrawals = withdrawalsReport(state, period).totals;
    const fuel = fuelReport(state, period);
    const oil = oilReport(state, period);
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
      combustivel: fuel.totals,
      trocasOleo: oil.totals,
      /* Custos de manutenção já incluem as trocas de óleo com custo próprio; o combustível é separado. */
      custos: general.custos,
      totalGeral: Utils.round2(general.custos.total + fuel.totals.valor),
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

  return { fleetGeneral, vehiclesReport, warehouseReport, withdrawalsReport, maintenanceReport, fuelReport, oilReport, fullReport, toCsv };
})();
