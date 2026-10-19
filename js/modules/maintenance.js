/* Telas do módulo Manutenção: lista com filtros, abertura, acompanhamento e conclusão. */
const MaintenanceScreens = (function () {
  const { esc, kpi, pageHeader, table, option, readForm, manutencaoBadge } = UI;

  function list(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Manutenções', 'Acompanhe as manutenções por veículo, situação e período de entrada.',
        '<a class="btn btn-primary" href="#/manutencao/nova">Nova manutenção</a>')}
      <section class="card">
        <div class="filter-bar">
          <label class="field">Veículo<select id="m-veiculo"><option value="Todos">Todos</option>${ctx.state.veiculos.map(v => option(v.id, v.placa)).join('')}</select></label>
          <label class="field">Situação<select id="m-status"><option value="Todos">Todas</option>${Maintenance.STATUS.map(s => option(s, s)).join('')}</select></label>
          <label class="field">Entrada de<input type="date" id="m-from"></label>
          <label class="field">Entrada até<input type="date" id="m-to"></label>
        </div>
        <div id="m-table"></div>
      </section>`;

    const render = () => {
      const rows = Maintenance.list(ctx.state, {
        veiculoId: main.querySelector('#m-veiculo').value,
        status: main.querySelector('#m-status').value,
        from: main.querySelector('#m-from').value,
        to: main.querySelector('#m-to').value,
      });
      main.querySelector('#m-table').innerHTML = table(
        [{ label: 'Código' }, { label: 'Veículo' }, { label: 'Entrada' }, { label: 'Situação' }, { label: 'Problema' },
          { label: 'Custo total', align: 'right' }, { label: '' }],
        rows.map(m => {
          const vehicle = Vehicles.find(ctx.state, m.veiculoId);
          return [
            `<strong>${esc(m.id)}</strong>`,
            esc(vehicle ? vehicle.placa : m.veiculoId),
            Utils.formatDateTime(m.dataEntrada),
            manutencaoBadge(m.status),
            esc(m.descricaoProblema),
            Utils.formatMoney(Costs.maintenanceCosts(ctx.state, m.id).total),
            `<a class="link" href="#/manutencao/${esc(m.id)}">Abrir</a>`,
          ];
        }),
        'Nenhuma manutenção corresponde ao filtro.',
      );
    };
    main.querySelectorAll('select, input[type="date"]').forEach(el => el.addEventListener('change', render));
    render();
  }

  function form(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Nova manutenção', 'A manutenção recebe um código próprio e começa com a situação Aberta.')}
      <form class="card form-grid" id="maintenance-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field">Veículo
          <select name="veiculoId" required><option value="">Selecione…</option>${ctx.state.veiculos.filter(Vehicles.isActive).map(v => option(v.id, `${v.placa} – ${v.marca}`)).join('')}</select>
        </label>
        <label class="field">Data e hora de entrada<input name="dataEntrada" type="datetime-local" required value="${Utils.nowIso()}"></label>
        <label class="field full">Descrição do problema<textarea name="descricaoProblema" rows="3" required></textarea></label>
        <label class="field full">Observações<textarea name="observacoes" rows="2"></textarea></label>
        <label class="field">Responsável pelo registro<input name="responsavel" required></label>
        <div class="form-actions full">
          <a class="btn btn-ghost" href="#/manutencao">Cancelar</a>
          <button class="btn btn-primary" type="submit">Abrir manutenção</button>
        </div>
      </form>`;

    main.querySelector('#maintenance-form').addEventListener('submit', event => {
      event.preventDefault();
      const result = Maintenance.open(ctx.state, readForm(event.currentTarget));
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save();
      ctx.toast(`Manutenção ${result.value.id} aberta.`);
      ctx.go(`#/manutencao/${result.value.id}`);
    });
  }

  function detail(main, params, ctx) {
    const m = Maintenance.find(ctx.state, params.id);
    if (!m) {
      main.innerHTML = `${pageHeader('Manutenção não encontrada')}<p><a class="link" href="#/manutencao">Voltar à lista</a></p>`;
      return;
    }
    const vehicle = Vehicles.find(ctx.state, m.veiculoId);
    const open = Maintenance.isOpen(m);
    const costs = Costs.maintenanceCosts(ctx.state, m.id);
    const parts = [
      ...costs.retiradas.map(r => {
        const part = Warehouse.findPart(ctx.state, r.pecaId);
        return { data: r.data, origem: 'Almoxarifado', descricao: part ? part.descricao : r.pecaId, quantidade: r.quantidade, valorUnitario: r.valorUnitario, responsavel: r.responsavel };
      }),
      ...costs.externas.map(e => ({ data: e.data, origem: 'Externa', descricao: e.descricao, quantidade: e.quantidade, valorUnitario: e.valorUnitario, responsavel: e.responsavel })),
    ].sort((a, b) => a.data.localeCompare(b.data));

    const actions = open
      ? `<button type="button" class="btn btn-ghost" id="start-btn" ${m.status === 'Em andamento' ? 'disabled' : ''}>Iniciar manutenção</button>`
      : '';

    main.innerHTML = `
      ${pageHeader(`${m.id} – ${vehicle ? vehicle.placa : m.veiculoId}`, vehicle ? vehicle.marca : '', actions)}
      <section class="grid-2">
        <div class="card">
          <h2>Dados da manutenção</h2>
          <dl class="details">
            <dt>Situação</dt><dd>${manutencaoBadge(m.status)}</dd>
            <dt>Entrada</dt><dd>${Utils.formatDateTime(m.dataEntrada)}</dd>
            <dt>Conclusão</dt><dd>${Utils.formatDateTime(m.dataConclusao)}</dd>
            <dt>Responsável</dt><dd>${esc(m.responsavel)}</dd>
            <dt>Problema</dt><dd>${esc(m.descricaoProblema)}</dd>
            <dt>Observações</dt><dd>${esc(m.observacoes || '—')}</dd>
          </dl>
          <p class="muted small">Veículo: <a class="link" href="#/veiculos/${esc(m.veiculoId)}">ver ficha do veículo</a></p>
        </div>
        <div class="card">
          <h2>Histórico</h2>
          <ol class="timeline">${m.historico.map(h => `<li><time>${Utils.formatDateTime(h.data)}</time> ${esc(h.texto)}</li>`).join('')}</ol>
        </div>
      </section>
      <section class="kpi-grid">
        ${kpi('Peças do almoxarifado', Utils.formatMoney(costs.pecasAlmoxarifado))}
        ${kpi('Peças externas', Utils.formatMoney(costs.pecasExternas))}
        ${kpi('Despesas', Utils.formatMoney(costs.outrasDespesas))}
        ${kpi('Custo total', Utils.formatMoney(costs.total))}
      </section>
      <section class="card">
        <h2>Peças utilizadas</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Origem' }, { label: 'Descrição' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor unit.', align: 'right' },
            { label: 'Total', align: 'right' }, { label: 'Responsável' }],
          parts.map(p => [Utils.formatDate(p.data), p.origem, esc(p.descricao), String(p.quantidade),
            Utils.formatMoney(p.valorUnitario), Utils.formatMoney(p.quantidade * p.valorUnitario), esc(p.responsavel)]),
          'Nenhuma peça utilizada nesta manutenção.',
        )}
      </section>
      <section class="card">
        <h2>Despesas registradas</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Descrição' }, { label: 'Valor', align: 'right' }],
          costs.despesas.map(d => [Utils.formatDate(d.data), esc(d.descricao), Utils.formatMoney(d.valor)]),
          'Nenhuma despesa registrada.',
        )}
      </section>
      ${open ? `
      <section class="card">
        <h2>Registrar itens</h2>
        <details class="disclosure" open><summary>Retirar peça do almoxarifado</summary>${WarehouseScreens.withdrawalFormHtml(ctx.state, { maintenance: m })}</details>
        <details class="disclosure"><summary>Registrar peça adquirida fora do almoxarifado</summary>${WarehouseScreens.externalFormHtml(ctx.state, { maintenance: m })}</details>
        <details class="disclosure"><summary>Registrar despesa (mão de obra ou serviço)</summary>
          <form class="form-grid" id="expense-form" novalidate>
            <div class="form-errors full" id="expense-errors"></div>
            <label class="field full">Descrição<input name="descricao" required></label>
            <label class="field">Valor (R$)<input name="valor" inputmode="decimal" required placeholder="0,00"></label>
            <label class="field">Data<input name="data" type="date" required value="${Utils.todayIso()}"></label>
            <div class="form-actions full"><button class="btn btn-primary" type="submit">Registrar despesa</button></div>
          </form>
        </details>
      </section>
      <section class="card">
        <h2>Concluir manutenção</h2>
        <form class="form-grid" id="conclude-form" novalidate>
          <div class="form-errors full" id="conclude-errors"></div>
          <label class="field">Data e hora de conclusão<input name="dataConclusao" type="datetime-local" required value="${Utils.nowIso()}"></label>
          <div class="form-actions"><button class="btn btn-primary" type="submit">Concluir manutenção</button></div>
        </form>
        <p class="muted small">Concluir não altera o cadastro do veículo: ele permanece Ativo ou Inativo como estava.</p>
      </section>` : `<p class="notice">Manutenção concluída. Não é possível registrar novos itens.</p>`}`;

    const startBtn = main.querySelector('#start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        const result = Maintenance.start(ctx.state, m.id);
        if (!result.ok) {
          ctx.toast(result.errors[0], 'error');
          return;
        }
        ctx.save();
        ctx.toast('Manutenção iniciada.');
        ctx.refresh();
      });
    }

    if (open) {
      WarehouseScreens.bindWithdrawalForm(main.querySelector('[data-form="withdrawal"]'), ctx.state, ctx, { maintenance: m }, () => ctx.refresh());
      WarehouseScreens.bindExternalForm(main.querySelector('[data-form="external"]'), ctx, { maintenance: m }, () => ctx.refresh());

      main.querySelector('#expense-form').addEventListener('submit', event => {
        event.preventDefault();
        const result = Maintenance.registerExpense(ctx.state, m.id, readForm(event.currentTarget));
        if (!result.ok) {
          UI.showErrors(main.querySelector('#expense-errors'), result.errors);
          return;
        }
        ctx.save();
        ctx.toast('Despesa registrada.');
        ctx.refresh();
      });

      main.querySelector('#conclude-form').addEventListener('submit', event => {
        event.preventDefault();
        const data = readForm(event.currentTarget);
        if (!UI.confirmAction('Concluir esta manutenção? Itens não poderão mais ser registrados nela.')) return;
        const result = Maintenance.conclude(ctx.state, m.id, data);
        if (!result.ok) {
          UI.showErrors(main.querySelector('#conclude-errors'), result.errors);
          return;
        }
        ctx.save();
        ctx.toast('Manutenção concluída.');
        ctx.refresh();
      });
    }
  }

  return { list, form, detail };
})();
