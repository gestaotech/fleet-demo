/* Telas do módulo Relatórios: menu lateral, filtros, resultados, exportação CSV e impressão. */
const ReportScreens = (function () {
  const { esc, kpi, table, option, badge } = UI;

  const MENU = [
    { id: 'geral', label: 'Relatório geral da frota', route: '#/relatorios/geral' },
    { id: 'veiculos', label: 'Relatório de veículos', route: '#/relatorios/veiculos' },
    { id: 'almoxarifado', label: 'Relatório do almoxarifado', route: '#/relatorios/almoxarifado' },
    { id: 'retiradas', label: 'Relatório de retiradas', route: '#/relatorios/retiradas' },
    { id: 'manutencoes', label: 'Relatório de manutenções', route: '#/relatorios/manutencoes' },
    { id: 'combustivel', label: 'Relatório de combustível', route: '#/relatorios/combustivel' },
    { id: 'trocas', label: 'Relatório de trocas de óleo', route: '#/relatorios/trocas-oleo' },
    { id: 'completo', label: 'Relatório completo', route: '#/relatorios/completo' },
  ];

  const money = (v) => Utils.formatMoney(v);

  function download(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function periodFields(from = '', to = '') {
    return `<label class="field">De<input type="date" name="from" value="${esc(from)}"></label>
            <label class="field">Até<input type="date" name="to" value="${esc(to)}"></label>`;
  }

  function vehicleSelect(state) {
    return `<label class="field">Veículo<select name="veiculoId"><option value="Todos">Todos</option>${state.veiculos.map(v => option(v.id, v.placa)).join('')}</select></label>`;
  }

  function readFilters(container) {
    const values = {};
    container.querySelectorAll('[name]').forEach(el => { values[el.name] = el.value; });
    return values;
  }

  /* build(filters) -> { html, csv: { name, headers, rows } } */
  function reportPage(main, ctx, active, title, subtitle, filtersHtml, build) {
    const menu = MENU.map(item => `<a class="${item.id === active ? 'active' : ''}" href="${item.route}">${esc(item.label)}</a>`).join('');
    main.innerHTML = `
      <div class="report-layout">
        <nav class="report-menu" aria-label="Relatórios">${menu}</nav>
        <div class="report-content">
          ${UI.pageHeader(title, subtitle)}
          <section class="card"><div class="filter-bar" id="report-filters">${filtersHtml}</div></section>
          <div id="report-results"></div>
        </div>
      </div>`;

    const filters = main.querySelector('#report-filters');
    const results = main.querySelector('#report-results');
    let current = null;

    const run = () => {
      current = build(readFilters(filters));
      results.innerHTML = `
        <div class="report-actions">
          <button type="button" class="btn btn-ghost" data-export>Exportar CSV</button>
          <button type="button" class="btn btn-ghost" data-print>Imprimir</button>
        </div>
        ${current.html}`;
    };

    filters.addEventListener('change', run);
    filters.addEventListener('input', run);
    results.addEventListener('click', event => {
      if (event.target.closest('[data-export]') && current) {
        download(`${current.csv.name}.csv`, Reports.toCsv(current.csv.headers, current.csv.rows));
      }
      if (event.target.closest('[data-print]')) window.print();
    });
    run();
  }

  function general(main, params, ctx) {
    reportPage(main, ctx, 'geral', 'Relatório geral da frota',
      'Indicadores calculados a partir dos cadastros e lançamentos. Período aplica-se aos custos e às manutenções.',
      periodFields(),
      (f) => {
        const r = Reports.fleetGeneral(ctx.state, f);
        const items = [
          ['Total de veículos', r.total], ['Veículos ativos', r.ativos], ['Veículos inativos', r.inativos],
          ['Veículos em manutenção', r.emManutencao], ['Manutenções abertas (Aberta ou Em andamento)', r.manutencoesAbertas],
          ['Manutenções com entrada no período', r.manutencoesNoPeriodo],
          ['Trocas de óleo registradas', r.trocasOleo], ['Trocas de óleo vencidas', r.trocasOleoVencidas],
          ['Abastecimentos no período', r.abastecimentosNoPeriodo],
          ['Peças do almoxarifado (R$)', r.custos.pecasAlmoxarifado], ['Peças externas (R$)', r.custos.pecasExternas],
          ['Outras despesas (R$)', r.custos.outrasDespesas], ['Trocas de óleo com custo próprio (R$)', r.custos.trocasOleoProprias],
          ['Gastos acumulados com manutenção (R$)', r.gastos], ['Gasto com combustível (R$)', r.custos.combustivel.total],
          ['Total geral (R$)', r.custos.totalGeral],
        ];
        return {
          html: `<section class="kpi-grid">
                   ${kpi('Total de veículos', r.total)}${kpi('Ativos / inativos', `${r.ativos} / ${r.inativos}`)}
                   ${kpi('Em manutenção', r.emManutencao)}${kpi('Manutenções abertas', r.manutencoesAbertas)}
                   ${kpi('Trocas de óleo vencidas', r.trocasOleoVencidas)}
                   ${kpi('Gastos com manutenção', money(r.gastos))}
                   ${kpi('Gasto com combustível', money(r.custos.combustivel.total))}
                   ${kpi('Total geral', money(r.custos.totalGeral))}
                 </section>
                 <section class="card">${table([{ label: 'Indicador' }, { label: 'Valor', align: 'right' }],
                   items.map(([label, value]) => [esc(label), typeof value === 'number' && label.includes('(R$)') ? money(value) : String(value)]))}</section>`,
          csv: { name: 'relatorio-geral', headers: ['Indicador', 'Valor'], rows: items },
        };
      });
  }

  function vehicles(main, params, ctx) {
    reportPage(main, ctx, 'veiculos', 'Relatório de veículos',
      'Relação da frota com situação, custos separados (manutenção e combustível) e consumo médio. Clique em Detalhes para a ficha completa.',
      `${periodFields()}
       <label class="field">Situação cadastral<select name="situacao"><option value="Todos">Todas</option><option value="Ativo">Ativos</option><option value="Inativo">Inativos</option></select></label>
       <label class="field">Situação operacional<select name="operacional"><option value="Todos">Todas</option><option value="Disponível">Disponíveis</option><option value="Em manutenção">Em manutenção</option></select></label>`,
      (f) => {
        const rows = Reports.vehiclesReport(ctx.state, f);
        return {
          html: `<section class="card">${table(
            [{ label: 'Placa' }, { label: 'Marca / modelo' }, { label: 'Identificação' }, { label: 'Km atual', align: 'right' },
              { label: 'Cadastro' }, { label: 'Operacional' }, { label: 'Consumo médio' }, { label: 'Manutenção', align: 'right' },
              { label: 'Combustível', align: 'right' }, { label: 'Custo total', align: 'right' }, { label: '' }],
            rows.map(v => [`<strong>${esc(v.placa)}</strong>`, esc(v.marca), esc(v.identificacao), Utils.formatKm(v.kmAtual),
              UI.situacaoBadge(v.situacao), UI.operacionalBadge(v.operacional),
              v.consumoMedio === null ? badge('Sem dados', 'muted') : badge(`${String(v.consumoMedio).replace('.', ',')} km/l`, 'ok'),
              money(v.custoManutencao), money(v.custoCombustivel), money(v.custoTotal),
              `<a class="link" href="#/veiculos/${esc(v.id)}">Detalhes</a>`]),
            'Nenhum veículo corresponde ao filtro.')}</section>`,
          csv: {
            name: 'relatorio-veiculos',
            headers: ['Placa', 'Marca', 'Identificação', 'Km atual', 'Situação cadastral', 'Situação operacional', 'Consumo médio (km/l)', 'Custo manutenção', 'Custo combustível', 'Custo total'],
            rows: rows.map(v => [v.placa, v.marca, v.identificacao, v.kmAtual, v.situacao, v.operacional,
              v.consumoMedio === null ? 'Dados insuficientes' : v.consumoMedio, v.custoManutencao, v.custoCombustivel, v.custoTotal]),
          },
        };
      });
  }

  function warehouse(main, params, ctx) {
    reportPage(main, ctx, 'almoxarifado', 'Relatório do almoxarifado',
      'O valor do estoque é uma ESTIMATIVA: saldo atual multiplicado pelo valor unitário de referência cadastrado.',
      `<label class="field">Pesquisar<input type="search" name="termo" placeholder="Código ou descrição"></label>
       <label class="field">Situação<select name="situacao"><option value="Todas">Todas</option><option value="Baixo">Estoque baixo</option><option value="Zerado">Zeradas</option></select></label>`,
      (f) => {
        const r = Reports.warehouseReport(ctx.state, f);
        return {
          html: `<section class="kpi-grid">
                   ${kpi('Peças listadas', r.totals.pecas)}${kpi('Saldo total (un.)', r.totals.saldoTotal)}
                   ${kpi('Valor estimado do estoque', money(r.totals.valorEstimado), 'Estimativa')}
                   ${kpi('Estoque baixo', r.totals.baixo)}
                 </section>
                 <section class="card">${table(
                   [{ label: 'Código' }, { label: 'Descrição' }, { label: 'Valor unit.', align: 'right' }, { label: 'Saldo', align: 'right' },
                     { label: 'Mínimo', align: 'right' }, { label: 'Valor estimado', align: 'right' }, { label: 'Entradas', align: 'right' },
                     { label: 'Retiradas', align: 'right' }, { label: 'Situação' }],
                   r.rows.map(x => [esc(x.codigo), esc(x.descricao), money(x.valorUnitario), `<strong>${x.saldo}</strong>`, String(x.estoqueMinimo),
                     money(x.valorEstimado), String(x.entradas), String(x.retiradas),
                     x.saldo === 0 ? badge('Zerado', 'danger') : x.baixo ? badge('Estoque baixo', 'warn') : badge('Normal', 'ok')]),
                   'Nenhuma peça corresponde ao filtro.')}</section>`,
          csv: {
            name: 'relatorio-almoxarifado',
            headers: ['Código', 'Descrição', 'Valor unitário', 'Saldo', 'Mínimo', 'Valor estimado', 'Entradas', 'Retiradas', 'Estoque baixo'],
            rows: r.rows.map(x => [x.codigo, x.descricao, x.valorUnitario, x.saldo, x.estoqueMinimo, x.valorEstimado, x.entradas, x.retiradas, x.baixo ? 'Sim' : 'Não']),
          },
        };
      });
  }

  function withdrawals(main, params, ctx) {
    reportPage(main, ctx, 'retiradas', 'Relatório de retiradas',
      'Saídas do almoxarifado. O valor usa o valor unitário vigente na data da retirada.',
      `${periodFields()}${vehicleSelect(ctx.state)}
       <label class="field">Peça<select name="pecaId"><option value="Todas">Todas</option>${ctx.state.pecas.map(p => option(p.id, p.descricao)).join('')}</select></label>`,
      (f) => {
        const r = Reports.withdrawalsReport(ctx.state, f);
        return {
          html: `<section class="kpi-grid">${kpi('Unidades retiradas', r.totals.quantidade)}${kpi('Valor total', money(r.totals.valor))}</section>
                 <section class="card">${table(
                   [{ label: 'Data' }, { label: 'Peça' }, { label: 'Qtd.', align: 'right' }, { label: 'Veículo' }, { label: 'Responsável' },
                     { label: 'Valor', align: 'right' }, { label: 'Origem' }],
                   r.rows.map(x => {
                     const v = Vehicles.find(ctx.state, x.veiculoId);
                     return [Utils.formatDate(x.data), esc(x.pecaDescricao), String(x.quantidade), esc(v ? v.placa : x.veiculoId),
                       esc(x.responsavel), money(x.valorTotal), esc(x.origem)];
                   }),
                   'Nenhuma retirada no período selecionado.')}</section>`,
          csv: {
            name: 'relatorio-retiradas',
            headers: ['Data', 'Peça', 'Quantidade', 'Veículo', 'Responsável', 'Valor unitário', 'Valor total', 'Origem'],
            rows: r.rows.map(x => {
              const v = Vehicles.find(ctx.state, x.veiculoId);
              return [Utils.formatDate(x.data), x.pecaDescricao, x.quantidade, v ? v.placa : x.veiculoId, x.responsavel, x.valorUnitario, x.valorTotal, x.origem];
            }),
          },
        };
      });
  }

  function maintenances(main, params, ctx) {
    reportPage(main, ctx, 'manutencoes', 'Relatório de manutenções',
      'Custos separados por origem. Custo total = peças do almoxarifado + peças externas + despesas.',
      `${periodFields()}${vehicleSelect(ctx.state)}
       <label class="field">Situação<select name="status"><option value="Todos">Todas</option>${Maintenance.STATUS.map(s => option(s, s)).join('')}</select></label>`,
      (f) => {
        const r = Reports.maintenanceReport(ctx.state, f);
        return {
          html: `<section class="kpi-grid">
                   ${kpi('Manutenções', r.totals.quantidade)}${kpi('Abertas', r.totals.abertas)}
                   ${kpi('Em andamento', r.totals.emAndamento)}${kpi('Concluídas', r.totals.concluidas)}
                   ${kpi('Custo total', money(r.totals.custoTotal))}
                 </section>
                 <section class="card">${table(
                   [{ label: 'Código' }, { label: 'Veículo' }, { label: 'Problema' }, { label: 'Entrada' }, { label: 'Conclusão' },
                     { label: 'Situação' }, { label: 'Peças', align: 'right' }, { label: 'Despesas', align: 'right' }, { label: 'Custo total', align: 'right' }],
                   r.rows.map(x => [esc(x.id), esc(x.veiculoPlaca), esc(x.descricaoProblema), Utils.formatDateTime(x.dataEntrada),
                     Utils.formatDateTime(x.dataConclusao), UI.manutencaoBadge(x.status), money(x.custoPecas), money(x.despesas), money(x.custoTotal)]),
                   'Nenhuma manutenção corresponde ao filtro.')}</section>`,
          csv: {
            name: 'relatorio-manutencoes',
            headers: ['Código', 'Veículo', 'Problema', 'Entrada', 'Conclusão', 'Situação', 'Peças utilizadas', 'Custo peças', 'Despesas', 'Custo total'],
            rows: r.rows.map(x => [x.id, x.veiculoPlaca, x.descricaoProblema, x.dataEntrada, x.dataConclusao || '', x.status,
              x.pecasUtilizadas, x.custoPecas, x.despesas, x.custoTotal]),
          },
        };
      });
  }

  function fuel(main, params, ctx) {
    reportPage(main, ctx, 'combustivel', 'Relatório de combustível',
      'Gastos, litros, número de abastecimentos e consumo médio por veículo (método de tanque cheio). Sem dados suficientes, o consumo não é calculado.',
      `${periodFields()}${vehicleSelect(ctx.state)}`,
      (f) => {
        const r = Reports.fuelReport(ctx.state, f);
        return {
          html: `<section class="kpi-grid">
                   ${kpi('Abastecimentos', r.totals.registros)}${kpi('Litros', Utils.formatQuantity(r.totals.litros))}
                   ${kpi('Gasto total', money(r.totals.valor))}${kpi('Preço médio por litro', r.totals.precoMedio === null ? '—' : money(r.totals.precoMedio))}
                   ${kpi('Veículos com consumo', r.totals.veiculosComConsumo)}${kpi('Veículos sem dados', r.totals.veiculosSemDados)}
                 </section>
                 <section class="card"><h2>Resumo por veículo</h2>${table(
                   [{ label: 'Veículo' }, { label: 'Km atual', align: 'right' }, { label: 'Abastecimentos', align: 'right' },
                     { label: 'Litros', align: 'right' }, { label: 'Gasto', align: 'right' }, { label: 'Preço médio', align: 'right' }, { label: 'Consumo médio' }],
                   r.vehicles.map(v => [esc(v.placa), Utils.formatKm(v.kmAtual), String(v.abastecimentos), Utils.formatQuantity(v.litros),
                     money(v.valor), v.precoMedio === null ? '—' : money(v.precoMedio),
                     v.consumoMedio === null ? badge(v.consumoStatus, 'muted') : badge(`${String(v.consumoMedio).replace('.', ',')} km/l`, 'ok')]),
                   'Nenhum veículo para o filtro informado.')}</section>
                 <section class="card"><h2>Abastecimentos no período</h2>${table(
                   [{ label: 'Data e hora' }, { label: 'Veículo' }, { label: 'Km', align: 'right' }, { label: 'Litros', align: 'right' },
                     { label: 'Preço/litro', align: 'right' }, { label: 'Valor total', align: 'right' }, { label: 'Posto' }, { label: 'Tanque' }],
                   r.rows.map(x => [Utils.formatDateTime(x.dataHora), esc(x.veiculoPlaca), Utils.formatKm(x.quilometragem),
                     Utils.formatQuantity(x.litros), money(x.precoLitro), money(x.valorTotal), esc(x.posto),
                     x.tanqueCheio ? badge('Cheio', 'ok') : badge('Parcial', 'muted')]),
                   'Nenhum abastecimento no período selecionado.')}</section>`,
          csv: {
            name: 'relatorio-combustivel',
            headers: ['Data e hora', 'Veículo', 'Km', 'Litros', 'Preço por litro', 'Valor total', 'Posto', 'Responsável', 'Tanque cheio', 'Consumo médio (km/l)'],
            rows: r.rows.map(x => [x.dataHora, x.veiculoPlaca, x.quilometragem, x.litros, x.precoLitro, x.valorTotal, x.posto, x.responsavel,
              x.tanqueCheio ? 'Sim' : 'Não', (r.vehicles.find(v => v.veiculoId === x.veiculoId) || {}).consumoMedio ?? 'Dados insuficientes']),
          },
        };
      });
  }

  function oil(main, params, ctx) {
    reportPage(main, ctx, 'trocas', 'Relatório de trocas de óleo',
      'Última troca por veículo, próximos limites por quilometragem e por tempo e alertas. Não existe intervalo universal: cada troca informa os seus intervalos.',
      `${vehicleSelect(ctx.state)}
       <label class="field">Situação<select name="situacao"><option value="Todas">Todas</option>${Oil.SITUACOES.map(s => option(s, s)).join('')}</select></label>`,
      (f) => {
        const r = Reports.oilReport(ctx.state, f);
        const conf = r.configuracoes;
        return {
          html: `<section class="kpi-grid">
                   ${kpi('Trocas registradas', r.totals.total)}${kpi('Em dia', r.totals.porSituacao['Em dia'] || 0)}
                   ${kpi('Próximas da troca', r.totals.proximas)}${kpi('Vencidas', r.totals.vencidas)}${kpi('Pendentes de dados', r.totals.pendentes)}
                   ${kpi('Custo total', money(r.totals.custoTotal))}
                 </section>
                 <p class="muted small">Alerta configurado: ${conf.alertaTrocaOleoKm} km ou ${conf.alertaTrocaOleoDias} dias de antecedência.</p>
                 <section class="card"><h2>Situação por veículo (última troca)</h2>${table(
                   [{ label: 'Veículo' }, { label: 'Km atual', align: 'right' }, { label: 'Última troca' }, { label: 'Próxima (km)', align: 'right' },
                     { label: 'Próxima (data)' }, { label: 'Km restante', align: 'right' }, { label: 'Dias restantes', align: 'right' }, { label: 'Situação' }],
                   r.porVeiculo.map(v => [esc(v.placa), Utils.formatKm(v.kmAtual),
                     v.ultimaTroca ? `${Utils.formatDate(v.ultimaTroca.data)} · ${Utils.formatKm(v.ultimaTroca.quilometragem)}` : 'Sem troca registrada',
                     v.limiteKm === null ? '—' : Utils.formatKm(v.limiteKm), v.limiteData === null ? '—' : Utils.formatDate(v.limiteData),
                     v.kmRestante === null ? '—' : Utils.formatKm(v.kmRestante), v.diasRestantes === null ? '—' : `${v.diasRestantes} dia(s)`,
                     OilScreens.situacaoBadge(v.situacao)]),
                   'Nenhum veículo para o filtro informado.')}</section>
                 <section class="card"><h2>Trocas registradas</h2>${table(
                   [{ label: 'Data' }, { label: 'Veículo' }, { label: 'Km da troca', align: 'right' }, { label: 'Óleo' }, { label: 'Litros', align: 'right' },
                     { label: 'Intervalo km', align: 'right' }, { label: 'Intervalo meses', align: 'right' }, { label: 'Próxima (km)', align: 'right' },
                     { label: 'Próxima (data)' }, { label: 'Situação' }, { label: 'Custo', align: 'right' }, { label: 'Origem do custo' }],
                   r.rows.map(t => [Utils.formatDate(t.data), esc(t.veiculoPlaca), Utils.formatKm(t.quilometragem), esc(t.especificacao),
                     Utils.formatQuantity(t.quantidade), t.intervaloKm === null ? 'Não configurado' : Utils.formatKm(t.intervaloKm),
                     t.intervaloMeses === null ? 'Não configurado' : `${t.intervaloMeses} mês(es)`, t.limiteKm === null ? '—' : Utils.formatKm(t.limiteKm),
                     t.limiteData === null ? '—' : Utils.formatDate(t.limiteData), OilScreens.situacaoBadge(t.situacao), money(t.custoTotal), esc(t.custoOrigem)]),
                   'Nenhuma troca de óleo para o filtro informado.')}</section>`,
          csv: {
            name: 'relatorio-trocas-oleo',
            headers: ['Data', 'Veículo', 'Km da troca', 'Óleo', 'Litros', 'Intervalo km', 'Intervalo meses', 'Próxima por km', 'Próxima por data', 'Situação', 'Custo', 'Origem do custo'],
            rows: r.rows.map(t => [t.data, t.veiculoPlaca, t.quilometragem, t.especificacao, t.quantidade, t.intervaloKm ?? 'Não configurado',
              t.intervaloMeses ?? 'Não configurado', t.limiteKm ?? '', t.limiteData ?? '', t.situacao, t.custoTotal, t.custoOrigem]),
          },
        };
      });
  }

  function full(main, params, ctx) {
    reportPage(main, ctx, 'completo', 'Relatório completo',
      'Visão consolidada da frota, do almoxarifado, da manutenção e do combustível. Use Imprimir para gerar PDF pelo navegador.',
      periodFields(),
      (f) => {
        const r = Reports.fullReport(ctx.state, f);
        const a = r.almoxarifado;
        const conf = Oil.configuracoes(ctx.state);
        const sections = [
          ['Resumo da frota', [
            ['Total de veículos', r.geral.total], ['Ativos', r.geral.ativos], ['Inativos', r.geral.inativos],
            ['Em manutenção', r.geral.emManutencao]]],
          ['Manutenções', [
            ['Abertas', r.manutencoes.abertas], ['Em andamento', r.manutencoes.emAndamento], ['Concluídas', r.manutencoes.concluidas],
            ['Custo total de manutenção (R$)', r.manutencoes.custoTotal]]],
          ['Almoxarifado', [
            ['Peças cadastradas', a.pecas], ['Saldo total (un.)', a.saldoTotal], ['Valor estimado do estoque (R$, estimativa)', a.valorEstimado],
            ['Estoque baixo', a.baixo], ['Entradas no período (un.)', a.entradasPeriodo], ['Retiradas no período (un.)', a.retiradasPeriodo],
            ['Valor das retiradas no período (R$)', a.retiradasValor]]],
          ['Peças externas', [
            ['Registros', r.externas.registros], ['Unidades', r.externas.quantidade], ['Valor (R$)', r.externas.valor]]],
          ['Trocas de óleo', [
            ['Trocas registradas', r.trocasOleo.total], ['Em dia', r.trocasOleo.porSituacao['Em dia'] || 0],
            ['Próximas da troca', r.trocasOleo.proximas], ['Vencidas', r.trocasOleo.vencidas], ['Pendentes de dados', r.trocasOleo.pendentes],
            ['Alerta (km de antecedência)', conf.alertaTrocaOleoKm], ['Alerta (dias de antecedência)', conf.alertaTrocaOleoDias]]],
          ['Combustível', [
            ['Abastecimentos', r.combustivel.registros], ['Litros', r.combustivel.litros], ['Gasto com combustível (R$)', r.combustivel.valor],
            ['Veículos com consumo calculado', r.combustivel.veiculosComConsumo], ['Veículos sem dados de consumo', r.combustivel.veiculosSemDados]]],
          ['Custos acumulados', [
            ['Peças do almoxarifado (R$)', r.custos.pecasAlmoxarifado], ['Peças externas (R$)', r.custos.pecasExternas],
            ['Outras despesas (R$)', r.custos.outrasDespesas], ['Trocas de óleo com custo próprio (R$)', r.custos.trocasOleoProprias],
            ['Total de manutenção (R$)', r.custos.total], ['Combustível (R$)', r.combustivel.valor], ['Total geral (R$)', r.totalGeral]]],
        ];
        const isMoney = (label) => label.includes('(R$)');
        const fmt = (label, value) => (typeof value === 'number' && isMoney(label) ? money(value) : String(value));
        /*
         * No CSV, valores monetários ficam como número (o exportador aplica 2 casas) e
         * contagens/quantidades viram texto, para não virar "8,00" em uma contagem de veículos.
         */
        const csvValue = (label, value) => (typeof value === 'number' && isMoney(label) ? value : String(value));
        const csvRows = sections.flatMap(([section, items]) => items.map(([label, value]) => [section, label, csvValue(label, value)]));
        const sectionHtml = sections.map(([section, items]) => `
          <section class="card report-section">
            <h2>${esc(section)}</h2>
            ${table([{ label: 'Indicador' }, { label: 'Valor', align: 'right' }], items.map(([label, value]) => [esc(label), fmt(label, value)]))}
          </section>`).join('');
        const ranking = table(
          [{ label: 'Placa' }, { label: 'Situação' }, { label: 'Operacional' }, { label: 'Manutenção', align: 'right' },
            { label: 'Combustível', align: 'right' }, { label: 'Custo total', align: 'right' }],
          r.veiculosPorCusto.map(v => [esc(v.placa), UI.situacaoBadge(v.situacao), UI.operacionalBadge(v.operacional),
            money(v.custoManutencao), money(v.custoCombustivel), money(v.custoTotal)]),
        );
        const rankingCsv = r.veiculosPorCusto.map(v => [v.placa, v.situacao, v.operacional, v.custoManutencao, v.custoCombustivel, v.custoTotal]);
        return {
          html: `${sectionHtml}
                 <section class="card report-section"><h2>Veículos por custo total</h2>${ranking}</section>
                 <p class="muted small">As trocas de óleo com custo próprio já estão incluídas no total de manutenção. O combustível é somado uma única vez no total geral.</p>`,
          csv: {
            name: 'relatorio-completo',
            headers: ['Seção', 'Indicador', 'Valor'],
            rows: csvRows.concat(rankingCsv.map(row => ['Veículos por custo total', row[0], row.slice(1).join(' | ')])),
          },
        };
      });
  }

  return { general, vehicles, warehouse, withdrawals, maintenances, fuel, oil, full };
})();
