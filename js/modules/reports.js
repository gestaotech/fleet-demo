/* Telas do módulo Relatórios: menu lateral, filtros, resultados, exportação CSV e impressão. */
const ReportScreens = (function () {
  const { esc, kpi, table, option, badge } = UI;

  const MENU = [
    { id: 'geral', label: 'Relatório geral da frota', route: '#/relatorios/geral' },
    { id: 'veiculos', label: 'Relatório de veículos', route: '#/relatorios/veiculos' },
    { id: 'almoxarifado', label: 'Relatório do almoxarifado', route: '#/relatorios/almoxarifado' },
    { id: 'retiradas', label: 'Relatório de retiradas', route: '#/relatorios/retiradas' },
    { id: 'manutencoes', label: 'Relatório de manutenções', route: '#/relatorios/manutencoes' },
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
          ${active === 'completo' ? '<button type="button" class="btn btn-ghost" data-print>Imprimir</button>' : ''}
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
          ['Peças do almoxarifado (R$)', r.custos.pecasAlmoxarifado], ['Peças externas (R$)', r.custos.pecasExternas],
          ['Outras despesas (R$)', r.custos.outrasDespesas], ['Gastos acumulados com manutenção (R$)', r.gastos],
        ];
        return {
          html: `<section class="kpi-grid">
                   ${kpi('Total de veículos', r.total)}${kpi('Ativos / inativos', `${r.ativos} / ${r.inativos}`)}
                   ${kpi('Em manutenção', r.emManutencao)}${kpi('Manutenções abertas', r.manutencoesAbertas)}
                   ${kpi('Gastos acumulados', money(r.gastos))}
                 </section>
                 <section class="card">${table([{ label: 'Indicador' }, { label: 'Valor', align: 'right' }],
                   items.map(([label, value]) => [esc(label), typeof value === 'number' && label.includes('(R$)') ? money(value) : String(value)]))}</section>`,
          csv: { name: 'relatorio-geral', headers: ['Indicador', 'Valor'], rows: items },
        };
      });
  }

  function vehicles(main, params, ctx) {
    reportPage(main, ctx, 'veiculos', 'Relatório de veículos',
      'Relação da frota com situação e custo total no período. Clique em Detalhes para a ficha completa.',
      `${periodFields()}
       <label class="field">Situação cadastral<select name="situacao"><option value="Todos">Todas</option><option value="Ativo">Ativos</option><option value="Inativo">Inativos</option></select></label>
       <label class="field">Situação operacional<select name="operacional"><option value="Todos">Todas</option><option value="Disponível">Disponíveis</option><option value="Em manutenção">Em manutenção</option></select></label>`,
      (f) => {
        const rows = Reports.vehiclesReport(ctx.state, f);
        return {
          html: `<section class="card">${table(
            [{ label: 'Placa' }, { label: 'Marca / modelo' }, { label: 'Identificação' }, { label: 'Cadastro' },
              { label: 'Operacional' }, { label: 'Custo total', align: 'right' }, { label: '' }],
            rows.map(v => [`<strong>${esc(v.placa)}</strong>`, esc(v.marca), esc(v.identificacao),
              UI.situacaoBadge(v.situacao), UI.operacionalBadge(v.operacional), money(v.custoTotal),
              `<a class="link" href="#/veiculos/${esc(v.id)}">Detalhes</a>`]),
            'Nenhum veículo corresponde ao filtro.')}</section>`,
          csv: {
            name: 'relatorio-veiculos',
            headers: ['Placa', 'Marca', 'Identificação', 'Situação cadastral', 'Situação operacional', 'Custo total'],
            rows: rows.map(v => [v.placa, v.marca, v.identificacao, v.situacao, v.operacional, v.custoTotal]),
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

  function full(main, params, ctx) {
    reportPage(main, ctx, 'completo', 'Relatório completo',
      'Visão consolidada da frota, do almoxarifado e dos custos. Use Imprimir para gerar PDF pelo navegador.',
      periodFields(),
      (f) => {
        const r = Reports.fullReport(ctx.state, f);
        const a = r.almoxarifado;
        const sections = [
          ['Resumo da frota', [
            ['Total de veículos', r.geral.total], ['Ativos', r.geral.ativos], ['Inativos', r.geral.inativos],
            ['Em manutenção', r.geral.emManutencao]]],
          ['Manutenções', [
            ['Abertas', r.manutencoes.abertas], ['Em andamento', r.manutencoes.emAndamento], ['Concluídas', r.manutencoes.concluidas],
            ['Custo total (R$)', r.manutencoes.custoTotal]]],
          ['Almoxarifado', [
            ['Peças cadastradas', a.pecas], ['Saldo total (un.)', a.saldoTotal], ['Valor estimado do estoque (R$, estimativa)', a.valorEstimado],
            ['Estoque baixo', a.baixo], ['Entradas no período (un.)', a.entradasPeriodo], ['Retiradas no período (un.)', a.retiradasPeriodo],
            ['Valor das retiradas no período (R$)', a.retiradasValor]]],
          ['Peças externas', [
            ['Registros', r.externas.registros], ['Unidades', r.externas.quantidade], ['Valor (R$)', r.externas.valor]]],
          ['Custos acumulados', [
            ['Peças do almoxarifado (R$)', r.custos.pecasAlmoxarifado], ['Peças externas (R$)', r.custos.pecasExternas],
            ['Outras despesas (R$)', r.custos.outrasDespesas], ['Total geral (R$)', r.custos.total]]],
        ];
        const isMoney = (label) => label.includes('(R$)');
        const fmt = (label, value) => (typeof value === 'number' && isMoney(label) ? money(value) : String(value));
        const csvRows = sections.flatMap(([section, items]) => items.map(([label, value]) => [section, label, value]));
        const sectionHtml = sections.map(([section, items]) => `
          <section class="card report-section">
            <h2>${esc(section)}</h2>
            ${table([{ label: 'Indicador' }, { label: 'Valor', align: 'right' }], items.map(([label, value]) => [esc(label), fmt(label, value)]))}
          </section>`).join('');
        const ranking = table(
          [{ label: 'Placa' }, { label: 'Situação' }, { label: 'Operacional' }, { label: 'Custo total', align: 'right' }],
          r.veiculosPorCusto.map(v => [esc(v.placa), UI.situacaoBadge(v.situacao), UI.operacionalBadge(v.operacional), money(v.custoTotal)]),
        );
        return {
          html: `${sectionHtml}
                 <section class="card report-section"><h2>Veículos por custo de manutenção</h2>${ranking}</section>`,
          csv: { name: 'relatorio-completo', headers: ['Seção', 'Indicador', 'Valor'], rows: csvRows },
        };
      });
  }

  return { general, vehicles, warehouse, withdrawals, maintenances, full };
})();
