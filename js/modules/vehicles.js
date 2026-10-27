/* Telas do módulo Veículos: lista, cadastro/edição e histórico integrado de cada veículo. */
const VehicleScreens = (function () {
  const { esc, kpi, pageHeader, table, option, monthSelect, readForm, situacaoBadge, operacionalBadge, manutencaoBadge } = UI;

  /* Estado do filtro mensal entre navegações (lista -> detalhes -> voltar). */
  let mesSelecionado = '';

  function periodFrom(anoMes) {
    return Period.resolve(anoMes);
  }

  function monthFieldHtml(state, selected) {
    return `<label class="field">Mês e ano
      ${monthSelect('mes', Period.monthOptions(state, selected), 'data-month-filter')}
    </label>`;
  }

  function list(main, params, ctx) {
    const meses = Period.availableMonths(ctx.state);
    main.innerHTML = `
      ${pageHeader('Veículos', 'Cadastro da frota. Situação cadastral e situação operacional são mostradas separadamente.',
        '<a class="btn btn-primary" href="#/veiculos/novo">Novo veículo</a>')}
      <section class="card">
        <div class="filter-bar">
          <label class="field">Pesquisar por placa, marca ou identificação<input type="search" id="v-term" placeholder="Ex.: DEM1A01 ou Volvo"></label>
          <label class="field">Situação cadastral
            <select id="v-situacao"><option value="Todos">Todas</option><option value="Ativo">Ativos</option><option value="Inativo">Inativos</option></select>
          </label>
          <label class="field">Situação operacional
            <select id="v-operacional"><option value="Todos">Todas</option><option value="Disponível">Disponíveis</option><option value="Em manutenção">Em manutenção</option></select>
          </label>
          ${monthFieldHtml(ctx.state, mesSelecionado)}
          <div class="field-action"><button type="button" class="btn btn-ghost" id="v-limpar">Limpar filtro de mês</button></div>
        </div>
        <p class="muted small" id="v-periodo-info"></p>
        <div id="v-kpis"></div>
        <div id="v-table"></div>
      </section>`;

    const mesSelect = main.querySelector('#mes');
    /* Um mês salvo que não existe mais nos dados é descartado (evita filtro silenciosamente vazio). */
    if (mesSelecionado && !meses.includes(mesSelecionado)) mesSelecionado = '';
    if (mesSelecionado) mesSelect.value = mesSelecionado;

    const render = () => {
      const period = periodFrom(mesSelect.value);
      const filtered = Vehicles.filter(ctx.state, {
        termo: main.querySelector('#v-term').value,
        situacao: main.querySelector('#v-situacao').value,
        operacional: main.querySelector('#v-operacional').value,
      });
      const resumos = Reports.vehicleSummaries(ctx.state, period, filtered);

      main.querySelector('#v-periodo-info').textContent = period.anoMes
        ? `Período selecionado: ${Period.monthLabel(period.anoMes)}. Os totais consideram apenas as movimentações do mês.`
        : 'Sem filtro de mês: os totais consideram todas as movimentações registradas.';

      const totalManutencao = Utils.sum(resumos, r => r.custos.total);
      const totalCombustivel = Utils.sum(resumos, r => r.custos.combustivel.total);
      const totalLitros = Math.round(resumos.reduce((acc, r) => acc + r.custos.combustivel.litros, 0) * 1000) / 1000;
      const semRegistros = resumos.filter(r => !r.temRegistros).length;
      main.querySelector('#v-kpis').innerHTML = `<section class="kpi-grid">
        ${kpi('Veículos na lista', String(resumos.length))}
        ${kpi('Manutenção no período', Utils.formatMoney(totalManutencao))}
        ${kpi('Combustível no período', Utils.formatMoney(totalCombustivel), `${Utils.formatQuantity(totalLitros)} litros`)}
        ${kpi('Total no período', Utils.formatMoney(Utils.round2(totalManutencao + totalCombustivel)))}
        ${kpi('Sem movimentação no período', String(semRegistros))}
      </section>`;

      main.querySelector('#v-table').innerHTML = table(
        [{ label: 'Placa' }, { label: 'Marca / modelo' }, { label: 'Identificação' }, { label: 'Cadastro' },
          { label: 'Operacional' }, { label: 'Movimentações' }, { label: 'Custo no período', align: 'right' }, { label: '' }],
        resumos.map(r => {
          const v = r.veiculo;
          const mov = r.temRegistros
            ? `${r.eventos.length} registro(s) · ${r.contagens.manutencoes} manut., ${r.contagens.trocasOleo} óleo, ${r.contagens.abastecimentos} abastec.`
            : '<span class="badge badge-muted">Sem registros no período</span>';
          return [
            `<strong>${esc(v.placa)}</strong>`,
            esc(v.marca),
            esc(v.identificacao),
            situacaoBadge(v.situacao),
            operacionalBadge(Vehicles.operationalStatus(ctx.state, v.id)),
            mov,
            Utils.formatMoney(r.totalGeral),
            `<div class="row-actions"><a class="link" href="#/veiculos/${esc(v.id)}">Detalhes</a><a class="link" href="#/veiculos/${esc(v.id)}/editar">Editar</a></div>`,
          ];
        }),
        'Nenhum veículo corresponde ao filtro.',
      );
    };

    ['#v-term', '#v-situacao', '#v-operacional'].forEach(sel => {
      main.querySelector(sel).addEventListener(sel === '#v-term' ? 'input' : 'change', render);
    });
    mesSelect.addEventListener('change', () => { mesSelecionado = mesSelect.value; render(); });
    main.querySelector('#v-limpar').addEventListener('click', () => {
      mesSelecionado = '';
      mesSelect.value = '';
      render();
      ctx.toast('Filtro de mês removido.');
    });
    render();
  }

  function form(main, params, ctx) {
    const editing = params.id ? Vehicles.find(ctx.state, params.id) : null;
    if (params.id && !editing) {
      main.innerHTML = `${pageHeader('Veículo não encontrado')}<p><a class="link" href="#/veiculos">Voltar à lista</a></p>`;
      return;
    }
    const current = editing || { marca: '', identificacao: '', placa: '', dataEntrada: Utils.todayIso(), situacao: 'Ativo' };
    main.innerHTML = `
      ${pageHeader(editing ? `Editar veículo ${editing.placa}` : 'Novo veículo', 'Veículos inativos não recebem novas retiradas nem manutenções.')}
      <form class="card form-grid" id="vehicle-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field">Marca e modelo<input name="marca" required value="${esc(current.marca)}"></label>
        <label class="field">Número ou identificação interna<input name="identificacao" required value="${esc(current.identificacao)}"></label>
        <label class="field">Placa<input name="placa" required value="${esc(current.placa)}" placeholder="ABC1D23"></label>
        <label class="field">Data de entrada na frota<input name="dataEntrada" type="date" required value="${esc(current.dataEntrada)}"></label>
        <label class="field">Situação cadastral
          <select name="situacao">${Vehicles.SITUACOES.map(s => option(s, s, s === current.situacao)).join('')}</select>
        </label>
        <div class="form-actions full">
          <a class="btn btn-ghost" href="${editing ? `#/veiculos/${esc(editing.id)}` : '#/veiculos'}">Cancelar</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Cadastrar veículo'}</button>
        </div>
      </form>`;

    main.querySelector('#vehicle-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      const result = editing ? Vehicles.update(ctx.state, editing.id, data) : Vehicles.create(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast(editing ? 'Veículo atualizado.' : 'Veículo cadastrado.');
        ctx.go(`#/veiculos/${result.value.id}`);
      });
    });
  }

  function detail(main, params, ctx) {
    const vehicle = Vehicles.find(ctx.state, params.id);
    if (!vehicle) {
      main.innerHTML = `${pageHeader('Veículo não encontrado')}<p><a class="link" href="#/veiculos">Voltar à lista</a></p>`;
      return;
    }
    if (mesSelecionado && !Period.availableMonths(ctx.state).includes(mesSelecionado)) mesSelecionado = '';

    const operacional = Vehicles.operationalStatus(ctx.state, vehicle.id);
    const costs = Costs.vehicleCosts(ctx.state, vehicle.id);
    const maintenances = ctx.state.manutencoes.filter(m => m.veiculoId === vehicle.id).sort((a, b) => b.dataEntrada.localeCompare(a.dataEntrada));
    const openMaintenances = maintenances.filter(Maintenance.isOpen);
    const kmAtual = Vehicles.currentKm(ctx.state, vehicle.id);
    const kmOrigem = Vehicles.currentKmSource(ctx.state, vehicle.id);
    const ultimaTroca = Oil.lastChange(ctx.state, vehicle.id);
    const oleoInfo = ultimaTroca ? Oil.status(ctx.state, ultimaTroca) : null;
    const consumo = Fuel.consumption(ctx.state, vehicle.id);

    main.innerHTML = `
      ${pageHeader(`${vehicle.placa} – ${vehicle.marca}`, `Identificação ${vehicle.identificacao}`,
        `<a class="btn btn-ghost" href="#/veiculos/${esc(vehicle.id)}/editar">Editar cadastro</a>
         <a class="btn btn-ghost" href="#/combustivel/novo">Novo abastecimento</a>
         <a class="btn btn-primary" href="#/manutencao/nova">Nova manutenção</a>`)}
      <section class="grid-2">
        <div class="card">
          <h2>Dados cadastrais</h2>
          <dl class="details">
            <dt>Marca e modelo</dt><dd>${esc(vehicle.marca)}</dd>
            <dt>Identificação</dt><dd>${esc(vehicle.identificacao)}</dd>
            <dt>Placa</dt><dd>${esc(vehicle.placa)}</dd>
            <dt>Entrada na frota</dt><dd>${Utils.formatDate(vehicle.dataEntrada)}</dd>
            <dt>Situação cadastral</dt><dd>${situacaoBadge(vehicle.situacao)}</dd>
            <dt>Quilometragem atual</dt><dd>${Utils.formatKm(kmAtual)}</dd>
            <dt>Origem da quilometragem</dt><dd>${kmOrigem ? `${esc(kmOrigem.origem)} em ${Utils.formatDateTime(kmOrigem.data)}` : 'Sem registros de quilometragem'}</dd>
          </dl>
        </div>
        <div class="card">
          <h2>Situação operacional</h2>
          <p>${operacionalBadge(operacional)}</p>
          ${openMaintenances.length
            ? `<p class="muted">Manutenções em aberto:</p><ul>${openMaintenances.map(m => `<li><a class="link" href="#/manutencao/${esc(m.id)}">${esc(m.id)}</a> – ${manutencaoBadge(m.status)}</li>`).join('')}</ul>`
            : '<p class="muted">Nenhuma manutenção aberta.</p>'}
          <h3>Troca de óleo</h3>
          ${oleoInfo
            ? `<p>${OilScreens.situacaoBadge(oleoInfo.situacao)}</p>
               <dl class="details">
                 <dt>Última troca</dt><dd>${Utils.formatDate(ultimaTroca.data)} · ${Utils.formatKm(ultimaTroca.quilometragem)}</dd>
                 <dt>Próxima por km</dt><dd>${oleoInfo.limiteKm === null ? 'Intervalo não configurado' : Utils.formatKm(oleoInfo.limiteKm)}</dd>
                 <dt>Próxima por data</dt><dd>${oleoInfo.limiteData === null ? 'Intervalo não configurado' : Utils.formatDate(oleoInfo.limiteData)}</dd>
               </dl>`
            : '<p class="muted">Nenhuma troca de óleo registrada. A situação desta informação está pendente de dados.</p>'}
        </div>
      </section>
      <section class="card">
        <div class="filter-bar">
          ${monthFieldHtml(ctx.state, mesSelecionado)}
          <div class="field-action"><button type="button" class="btn btn-ghost" id="v-limpar">Histórico completo (todas as datas)</button></div>
        </div>
        <p class="muted small" id="v-historico-info"></p>
        <div id="v-historico-resumo"></div>
        <div id="v-historico-tabela"></div>
      </section>
      <section class="card">
        <h2>Histórico de manutenções (todas as datas)</h2>
        ${table(
          [{ label: 'Código' }, { label: 'Entrada' }, { label: 'Conclusão' }, { label: 'Situação' }, { label: 'Problema' }, { label: 'Custo total', align: 'right' }],
          maintenances.map(m => [
            `<a class="link" href="#/manutencao/${esc(m.id)}">${esc(m.id)}</a>`,
            Utils.formatDateTime(m.dataEntrada),
            Utils.formatDateTime(m.dataConclusao),
            manutencaoBadge(m.status),
            esc(m.descricaoProblema),
            Utils.formatMoney(Costs.maintenanceCosts(ctx.state, m.id).total),
          ]),
          'Nenhuma manutenção registrada para este veículo.',
        )}
      </section>
      <section class="card">
        <h2>Peças retiradas do almoxarifado (todas as datas)</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Peça' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor unit.', align: 'right' },
            { label: 'Total', align: 'right' }, { label: 'Manutenção' }, { label: 'Responsável' }],
          costs.retiradas.map(m => {
            const part = Warehouse.findPart(ctx.state, m.pecaId);
            return [
              Utils.formatDate(m.data),
              esc(part ? part.descricao : m.pecaId),
              String(m.quantidade),
              Utils.formatMoney(m.valorUnitario),
              Utils.formatMoney(m.quantidade * m.valorUnitario),
              m.manutencaoId ? esc(m.manutencaoId) : 'Retirada direta',
              esc(m.responsavel),
            ];
          }),
          'Nenhuma peça do almoxarifado retirada para este veículo.',
        )}
      </section>
      <section class="card">
        <h2>Peças adquiridas fora do almoxarifado (todas as datas)</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Descrição' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor unit.', align: 'right' },
            { label: 'Total', align: 'right' }, { label: 'Manutenção' }, { label: 'Motivo' }],
          costs.externas.map(e => [
            Utils.formatDate(e.data),
            esc(e.descricao),
            String(e.quantidade),
            Utils.formatMoney(e.valorUnitario),
            Utils.formatMoney(e.quantidade * e.valorUnitario),
            e.manutencaoId ? esc(e.manutencaoId) : '—',
            esc(e.motivo || '—'),
          ]),
          'Nenhuma peça externa registrada para este veículo.',
        )}
      </section>
      <section class="card">
        <h2>Outras despesas de manutenção (todas as datas)</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Descrição' }, { label: 'Manutenção' }, { label: 'Valor', align: 'right' }],
          costs.despesas.map(d => [Utils.formatDate(d.data), esc(d.descricao), esc(d.manutencaoId), Utils.formatMoney(d.valor)]),
          'Nenhuma despesa registrada.',
        )}
        <p class="totals">Total de manutenção: <strong>${Utils.formatMoney(costs.total)}</strong> · Combustível: <strong>${Utils.formatMoney(costs.combustivel.total)}</strong> · Total geral: <strong>${Utils.formatMoney(costs.totalGeral)}</strong>. Cada item é contado uma única vez.</p>
      </section>
      <section class="card">
        <h2>Abastecimentos (todas as datas)</h2>
        ${table(
          [{ label: 'Data e hora' }, { label: 'Km', align: 'right' }, { label: 'Litros', align: 'right' }, { label: 'Preço/litro', align: 'right' },
            { label: 'Valor total', align: 'right' }, { label: 'Posto' }, { label: 'Responsável' }, { label: 'Tanque' }],
          Fuel.list(ctx.state, { veiculoId: vehicle.id }).map(a => [
            Utils.formatDateTime(a.dataHora),
            Utils.formatKm(a.quilometragem),
            Utils.formatQuantity(a.litros),
            Utils.formatMoney(a.precoLitro),
            Utils.formatMoney(a.valorTotal),
            esc(a.posto),
            esc(a.responsavel),
            a.tanqueCheio ? UI.badge('Cheio', 'ok') : UI.badge('Parcial', 'muted'),
          ]),
          'Nenhum abastecimento registrado para este veículo.',
        )}
        <p class="muted small">Consumo médio (método de tanque cheio): ${consumo.suficiente
          ? `<strong>${String(consumo.media).replace('.', ',')} km/l</strong> em ${consumo.segmentos.length} intervalo(s) válido(s).`
          : 'dados insuficientes para calcular o consumo.'}</p>
      </section>
      <section class="card">
        <h2>Trocas de óleo (todas as datas)</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Km', align: 'right' }, { label: 'Óleo' }, { label: 'Litros', align: 'right' },
            { label: 'Intervalo km', align: 'right' }, { label: 'Intervalo meses', align: 'right' }, { label: 'Próxima (km)', align: 'right' },
            { label: 'Próxima (data)' }, { label: 'Situação' }, { label: 'Custo', align: 'right' }],
          Oil.list(ctx.state, { veiculoId: vehicle.id }).map(t => [
            Utils.formatDate(t.data),
            Utils.formatKm(t.quilometragem),
            esc(t.especificacao),
            Utils.formatQuantity(t.quantidade),
            t.intervaloKm === null ? 'Não configurado' : Utils.formatKm(t.intervaloKm),
            t.intervaloMeses === null ? 'Não configurado' : `${t.intervaloMeses} mês(es)`,
            t.limiteKm === null ? '—' : Utils.formatKm(t.limiteKm),
            t.limiteData === null ? '—' : Utils.formatDate(t.limiteData),
            OilScreens.situacaoBadge(t.situacao),
            Utils.formatMoney(t.custoTotal),
          ]),
          'Nenhuma troca de óleo registrada para este veículo.',
        )}
        <p class="muted small">Custos com origem "Retirada do estoque" já estão contados nas peças do almoxarifado e não são somados novamente.</p>
      </section>`;

    const mesSelect = main.querySelector('#mes');
    const resumo = main.querySelector('#v-historico-resumo');
    const tabela = main.querySelector('#v-historico-tabela');
    const info = main.querySelector('#v-historico-info');

    const renderHistorico = () => {
      const period = periodFrom(mesSelect.value);
      const r = Reports.vehiclePeriodSummary(ctx.state, vehicle.id, period);
      const c = r.contagens;
      info.textContent = period.anoMes
        ? `Histórico de ${Period.monthLabel(period.anoMes)}: movimentações cujas datas de evento caem no mês. Os totais consideram apenas esse período.`
        : 'Histórico completo, sem filtro de período.';

      resumo.innerHTML = r.temRegistros
        ? `<section class="kpi-grid">
             ${kpi('Registros no período', String(r.eventos.length))}
             ${kpi('Manutenções', String(c.manutencoes))}
             ${kpi('Trocas de óleo', String(c.trocasOleo))}
             ${kpi('Abastecimentos', String(c.abastecimentos))}
             ${kpi('Peças do almoxarifado', String(c.retiradas))}
             ${kpi('Manutenção (R$)', Utils.formatMoney(r.custos.total))}
             ${kpi('Combustível (R$)', Utils.formatMoney(r.custos.combustivel.total), `${Utils.formatQuantity(r.custos.combustivel.litros)} litros`)}
             ${kpi('Total no período', Utils.formatMoney(r.totalGeral))}
           </section>`
        : '<p class="muted">Nenhuma movimentação registrada para este veículo no período selecionado. O cadastro permanece ativo.</p>';

      tabela.innerHTML = r.temRegistros
        ? table(
          [{ label: 'Data' }, { label: 'Tipo' }, { label: 'Descrição' }, { label: 'Situação' }, { label: 'Km', align: 'right' }, { label: 'Custo', align: 'right' }, { label: '' }],
          r.eventos.map(e => [
            Utils.formatDateTime(e.data),
            esc(e.tipo),
            esc(e.descricao),
            esc(e.situacao),
            e.quilometragem === null ? '—' : Utils.formatKm(e.quilometragem),
            e.custoJaContado ? `${Utils.formatMoney(e.custo)} <span class="muted small">(já contado)</span>` : Utils.formatMoney(e.custo),
            e.rota ? `<a class="link" href="${e.rota}">Abrir</a>` : '—',
          ]),
        )
        : '';
    };

    mesSelect.addEventListener('change', () => { mesSelecionado = mesSelect.value; renderHistorico(); });
    main.querySelector('#v-limpar').addEventListener('click', () => {
      mesSelecionado = '';
      mesSelect.value = '';
      renderHistorico();
      ctx.toast('Histórico completo exibido.');
    });
    renderHistorico();
  }

  return { list, form, detail };
})();
