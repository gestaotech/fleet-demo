/*
 * Telas do módulo Almoxarifado: estoque de peças, entradas, retiradas e peças externas.
 * Os formulários de retirada e de peça externa são reutilizados pelo módulo Manutenção.
 */
const WarehouseScreens = (function () {
  const { esc, kpi, pageHeader, table, option, readForm, errorBox } = UI;

  function money(value) {
    return Utils.formatMoney(value);
  }

  function moneyInput(value) {
    return value === undefined || value === null || value === '' ? '' : Number(value).toFixed(2).replace('.', ',');
  }

  function withdrawalPartRowHtml(state, index) {
    return `<div class="withdrawal-item-row form-grid" data-item-index="${index}"><label class="field">Peça (digite código ou descrição)${UI.searchField('part', state, { id: `withdrawal-peca-${index}`, name: `pecaId_${index}`, placeholder: 'Ex.: FLT-1001 ou filtro', required: true })}</label><label class="field">Quantidade<input name="quantidade" inputmode="decimal" required placeholder="Ex.: 1 ou 1/2"></label><button type="button" class="btn btn-ghost" data-remove-item aria-label="Remover peça" ${index === 0 ? 'disabled' : ''}>Remover</button></div>`;
  }

  function stockBadge(row) {
    if (row.saldo === 0) return UI.badge('Zerado', 'danger');
    if (row.baixo) return UI.badge('Estoque baixo', 'warn');
    return UI.badge('Normal', 'ok');
  }

  /* Opções de manutenção aberta; data-veiculo permite filtrar quando o veículo muda. */
  function openMaintenanceOptions(state) {
    return state.manutencoes
      .filter(m => Maintenance.isOpen(m))
      .map(m => {
        const vehicle = Vehicles.find(state, m.veiculoId);
        return `<option value="${esc(m.id)}" data-veiculo="${esc(m.veiculoId)}">${esc(m.id)} – ${esc(vehicle ? vehicle.placa : m.veiculoId)} (${esc(m.status)})</option>`;
      })
      .join('');
  }

  /* Com veículo escolhido, mostra só as manutenções abertas dele; sem veículo, mostra todas. */
  function bindVehicleMaintenanceFilter(form) {
    const vehicle = form.querySelector('[name="veiculoId"]');
    const maintenance = form.querySelector('[name="manutencaoId"]');
    if (!vehicle || !maintenance) return;
    const apply = () => {
      maintenance.querySelectorAll('option[data-veiculo]').forEach(opt => {
        opt.hidden = Boolean(vehicle.value) && opt.dataset.veiculo !== vehicle.value;
      });
      if (maintenance.selectedOptions[0] && maintenance.selectedOptions[0].hidden) maintenance.value = '';
    };
    vehicle.addEventListener('change', apply);
    apply();
  }



  /* Retirada avulsa aceita várias peças na mesma operação; manutenção mantém o fluxo legado. */
  function withdrawalFormHtml(state, opts = {}) {
    const fixed = opts.maintenance || null;
    const vehicleField = fixed
      ? `<input type="hidden" name="veiculoId" value="${esc(fixed.veiculoId)}"><input type="hidden" name="manutencaoId" value="${esc(fixed.id)}"><div class="field"><span>Veículo</span><strong>${esc((Vehicles.find(state, fixed.veiculoId) || {}).placa || fixed.veiculoId)}</strong></div><div class="field"><span>Manutenção</span><strong>${esc(fixed.id)}</strong></div>`
      : `<label class="field">Veículo de destino (digite a placa)${UI.searchField('vehicle', state, { id: 'withdrawal-veiculo', name: 'veiculoId', placeholder: 'Ex.: DEM1A01', required: true, apenasAtivos: true })}</label><label class="field">Manutenção vinculada (opcional)<select name="manutencaoId"><option value="">Retirada direta, sem manutenção</option>${openMaintenanceOptions(state)}</select></label>`;
    const partField = fixed
      ? `<label class="field full">Peça retirada (digite código ou descrição)${UI.searchField('part', state, { id: 'withdrawal-peca', name: 'pecaId', placeholder: 'Ex.: FLT-1001 ou filtro', required: true })}</label><label class="field">Quantidade<input name="quantidade" inputmode="decimal" required placeholder="Ex.: 1 ou 1/2"></label>`
      : `<div class="field full"><span>Peças e quantidades</span><div id="withdrawal-items" class="form-grid">${withdrawalPartRowHtml(state, 0)}</div><button type="button" class="btn btn-ghost" id="add-withdrawal-item">Adicionar outra peça</button></div>`;
    return `<form class="card form-grid" data-form="withdrawal" novalidate><div class="form-errors full"></div>${partField}${vehicleField}<label class="field">Data da retirada<input name="data" type="date" required value="${Utils.todayIso()}"></label><label class="field">Responsável pela solicitação<input name="responsavel" required></label><label class="field full">Observação<input name="observacao" placeholder="Opcional"></label><div class="form-actions full"><button class="btn btn-primary" type="submit">Confirmar retirada</button></div></form>`;
  }

  function bindWithdrawalForm(form, state, ctx, opts = {}, onDone) {
    const syncSearch = UI.bindSearchFields(form, state);
    if (!opts.maintenance) {
      bindVehicleMaintenanceFilter(form);
      const items = form.querySelector('#withdrawal-items');
      const add = form.querySelector('#add-withdrawal-item');
      if (items && add) {
        let nextItemIndex = 1;
        const syncRemove = () => items.querySelectorAll('[data-remove-item]').forEach(button => { button.disabled = items.querySelectorAll('.withdrawal-item-row').length === 1; });
        add.addEventListener('click', () => {
          const wrapper = document.createElement('div');
          wrapper.innerHTML = withdrawalPartRowHtml(state, nextItemIndex++);
          const row = wrapper.firstElementChild;
          row._syncSearch = UI.bindSearchFields(row, state);
          items.appendChild(row);
          syncRemove();
        });
        items.addEventListener('click', event => {
          const button = event.target.closest('[data-remove-item]');
          if (button && !button.disabled) { button.closest('.withdrawal-item-row').remove(); syncRemove(); }
        });
        const firstRow = items.querySelector('.withdrawal-item-row');
        if (firstRow) firstRow._syncSearch = syncSearch;
      }
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.dataset.sending === 'true') return;
      form.dataset.sending = 'true';
      const button = form.querySelector('button[type="submit"]'); button.disabled = true;
      syncSearch();
      const data = readForm(form);
      const result = opts.maintenance
        ? Maintenance.registerWithdrawal(ctx.state, opts.maintenance.id, data)
        : Warehouse.registerWithdrawals(ctx.state, { ...data, itens: [...form.querySelectorAll('.withdrawal-item-row')].map(row => {
          if (row._syncSearch) row._syncSearch();
          const campoPeca = row.querySelector('input[type="hidden"][name^="pecaId_"]');
          return { pecaId: campoPeca ? campoPeca.value : '', quantidade: row.querySelector('[name="quantidade"]').value };
        }) });
      if (!result.ok) {
        UI.showErrors(form.querySelector('.form-errors'), result.errors); form.dataset.sending = ''; button.disabled = false; return;
      }
      ctx.save().then(ok => {
        if (!ok) { form.dataset.sending = ''; button.disabled = false; return; }
        ctx.toast('Retirada confirmada e saldo atualizado.');
        onDone(Array.isArray(result.value) ? result.value : result.value);
      });
    });
  }

  function externalFormHtml(state, opts = {}) {
    const fixed = opts.maintenance || null;
    const vehicleField = fixed
      ? `<input type="hidden" name="veiculoId" value="${esc(fixed.veiculoId)}">
         <input type="hidden" name="manutencaoId" value="${esc(fixed.id)}">
         <div class="field"><span>Veículo</span><strong>${esc((Vehicles.find(state, fixed.veiculoId) || {}).placa || fixed.veiculoId)}</strong></div>`
      : `<label class="field">Veículo (placa)${UI.searchField('vehicle', state, { id: 'external-veiculo', name: 'veiculoId', required: true, apenasAtivos: true })}</label>
         <label class="field">Manutenção vinculada (opcional)<select name="manutencaoId"><option value="">Sem manutenção vinculada</option>${openMaintenanceOptions(state)}</select></label>`;
    return `
      <form class="card form-grid" data-form="external" novalidate>
        <div class="form-errors full"></div>
        ${vehicleField}
        <label class="field full">Descrição da peça<input name="descricao" required placeholder="Ex.: Lâmpada de farol especial"></label>
        <label class="field">Quantidade<input name="quantidade" type="number" min="1" step="1" inputmode="numeric" required></label>
        <label class="field">Valor unitário (R$)<input name="valorUnitario" inputmode="decimal" required placeholder="0,00"></label>
        <label class="field">Data de aquisição ou utilização<input name="data" type="date" required value="${Utils.todayIso()}"></label>
        <label class="field">Responsável pela solicitação<input name="responsavel" required></label>
        <label class="field full">Motivo ou observação<input name="motivo" placeholder="Por que a peça não veio do almoxarifado?"></label>
        <div class="form-actions full"><button class="btn btn-primary" type="submit">Registrar peça externa</button></div>
      </form>`;
  }

  function bindExternalForm(form, ctx, opts = {}, onDone) {
    const syncSearch = UI.bindSearchFields(form, ctx.state);
    if (!opts.maintenance) bindVehicleMaintenanceFilter(form);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.dataset.sending === 'true') return;
      form.dataset.sending = 'true';
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      syncSearch();
      const data = readForm(form);
      const result = opts.maintenance
        ? Maintenance.registerExternalPart(ctx.state, opts.maintenance.id, data)
        : Warehouse.registerExternalPart(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(form.querySelector('.form-errors'), result.errors);
        form.dataset.sending = '';
        button.disabled = false;
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast('Peça externa registrada. O saldo do almoxarifado não foi alterado.');
        onDone(result.value);
      });
    });
  }

  function stock(main, params, ctx) {
    const rows = Warehouse.inventory(ctx.state);
    const s = {
      pecas: rows.length,
      baixo: rows.filter(r => r.baixo).length,
      zerado: rows.filter(r => r.saldo === 0).length,
    };
    main.innerHTML = `
      ${pageHeader('Estoque de peças', 'Saldos calculados a partir das entradas e retiradas registradas.',
        `<a class="btn btn-ghost" href="#/almoxarifado/estoque/entrada">Registrar entrada</a>
         <a class="btn btn-primary" href="#/almoxarifado/estoque/novo">Nova peça</a>`)}
      <section class="kpi-grid">
        ${kpi('Peças cadastradas', s.pecas)}
        ${kpi('Estoque baixo', s.baixo, 'Saldo no mínimo ou abaixo')}
        ${kpi('Zeradas', s.zerado)}
      </section>
      <section class="card">
        <div class="filter-bar">
          <label class="field">Pesquisar por código ou descrição<input type="search" id="stock-term" placeholder="Ex.: FLT-1001 ou filtro"></label>
          <label class="field">Situação
            <select id="stock-situacao">
              <option value="Todas">Todas</option>
              <option value="Baixo">Estoque baixo</option>
              <option value="Zerado">Zeradas</option>
            </select>
          </label>
          <label class="field">Uso
            <select id="stock-uso">
              <option value="Todos">Todos</option>
              <option value="Nova">Nova</option>
              <option value="Usada">Usada</option>
              <option value="Nova e usada">Nova e usada</option>
            </select>
          </label>
          <div class="field field-action">
            <button type="button" class="btn btn-ghost" id="stock-clear">Limpar pesquisa</button>
          </div>
        </div>
        <p class="hint" id="stock-summary"></p>
        <div id="stock-table"></div>
      </section>`;

    const renderTable = () => {
      const termInput = main.querySelector('#stock-term');
      const term = termInput.value;
      const situacao = main.querySelector('#stock-situacao').value;
      const uso = main.querySelector('#stock-uso').value;
      const filtered = Warehouse.filterInventory(rows, { termo: term, situacao, uso });
      const filtrando = Boolean(Utils.normalizeText(term)) || situacao !== 'Todas' || uso !== 'Todos';
      main.querySelector('#stock-summary').textContent = filtrando
        ? `Exibindo ${filtered.length} de ${rows.length} peças para o filtro atual.`
        : `${rows.length} peças cadastradas.`;
      main.querySelector('#stock-table').innerHTML = table(
        [
          { label: 'Código' }, { label: 'Descrição' }, { label: 'Valor unitário', align: 'right' },
          { label: 'Saldo', align: 'right' }, { label: 'Mínimo', align: 'right' }, { label: 'Data de entrada' },
          { label: 'Situação' }, { label: 'Uso' }, { label: 'Observação' },
        ],
        filtered.map(r => ({
          cells: [
            esc(r.codigo),
            esc(r.descricao),
            money(r.valorUnitario),
            `<strong>${Utils.formatQuantity(r.saldo)}</strong>`,
            String(r.estoqueMinimo),
            Utils.formatDate(r.dataEntrada),
            stockBadge(r),
            r.situacaoUso === 'Nova' ? UI.badge('Nova', 'ok') : (r.situacaoUso === 'Usada' ? UI.badge('Usada', 'muted') : UI.badge('Nova e usada', 'info')),
            esc(r.observacao || '—'),
          ],
          footer: `<a class="link" href="#/almoxarifado/estoque/${esc(r.id)}">Movimentações</a><a class="link" href="#/almoxarifado/estoque/${esc(r.id)}/editar">Editar</a>`,
        })),
        filtrando ? 'Nenhuma peça corresponde à pesquisa ou aos filtros informados.' : 'Nenhuma peça cadastrada.',
      );
    };
    main.querySelector('#stock-term').addEventListener('input', renderTable);
    main.querySelector('#stock-situacao').addEventListener('change', renderTable);
    main.querySelector('#stock-uso').addEventListener('change', renderTable);
    main.querySelector('#stock-clear').addEventListener('click', () => {
      main.querySelector('#stock-term').value = '';
      main.querySelector('#stock-situacao').value = 'Todas';
      main.querySelector('#stock-uso').value = 'Todos';
      main.querySelector('#stock-term').focus();
      renderTable();
    });
    renderTable();
  }

  function partForm(main, params, ctx) {
    const editing = params.id ? Warehouse.findPart(ctx.state, params.id) : null;
    if (params.id && !editing) {
      main.innerHTML = `${pageHeader('Peça não encontrada')}<p><a class="link" href="#/almoxarifado/estoque">Voltar ao estoque</a></p>`;
      return;
    }
    const current = editing || { codigo: '', descricao: '', valorUnitario: '', estoqueMinimo: 0, dataEntrada: Utils.todayIso() };
    const podeAjustar = Boolean(editing && ctx.user && ctx.user.permissoes.includes('admin'));
    const saldoAtual = editing ? Warehouse.balance(ctx.state, editing.id) : 0;
    const ajusteHtml = podeAjustar ? `
        <fieldset class="field full ajuste-estoque">
          <legend>Ajuste de quantidade (somente administrador)</legend>
          <p class="hint">Saldo atual: <strong>${Utils.formatQuantity(saldoAtual)}</strong>. O ajuste corrige o saldo sem registrar saída: fica no histórico com o motivo e não entra em custos. Deixe a nova quantidade em branco para não ajustar.</p>
          <label class="field">Nova quantidade em estoque<input name="novaQuantidade" inputmode="decimal" placeholder="Ex.: 3 ou 2 1/2"></label>
          <label class="field">Motivo do ajuste<input name="motivoAjuste" placeholder="Ex.: contagem de inventário"></label>
          <label class="field">Sua senha de administrador<input name="senhaAdmin" type="password" autocomplete="current-password"></label>
        </fieldset>` : '';
    main.innerHTML = `
      ${pageHeader(editing ? `Editar peça ${editing.codigo}` : 'Nova peça', editing
        ? 'Alterar o cadastro não altera o histórico de movimentações nem os valores já registrados.'
        : 'Cadastre a peça e, se houver, a quantidade já existente no estoque.')}
      <form class="card form-grid" id="part-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field">Código da peça<input name="codigo" required value="${esc(current.codigo)}"></label>
        <label class="field">Descrição<input name="descricao" required value="${esc(current.descricao)}"></label>
        <label class="field">Valor unitário (R$)<input name="valorUnitario" inputmode="decimal" required value="${esc(moneyInput(current.valorUnitario))}" placeholder="0,00"></label>
        <label class="field">Estoque mínimo (alerta)<input name="estoqueMinimo" type="number" min="0" step="1" inputmode="numeric" required value="${esc(current.estoqueMinimo)}"></label>
        <label class="field">Data de entrada no cadastro<input name="dataEntrada" type="date" required value="${esc(current.dataEntrada)}"></label>
        ${editing ? '' : `<label class="field">Quantidade inicial em estoque<input name="quantidadeInicial" type="number" min="0" step="1" inputmode="numeric" value="0"></label>`}
        <label class="field full">Observação<textarea name="observacao" rows="2" placeholder="Opcional: fornecedor, aplicação, condições do cadastro">${esc(current.observacao || '')}</textarea></label>
        ${ajusteHtml}
        <div class="form-actions full">
          ${editing ? '<button class="btn btn-danger" type="button" id="part-delete">Excluir peça</button>' : ''}
          <a class="btn btn-ghost" href="#/almoxarifado/estoque">Cancelar</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Cadastrar peça'}</button>
        </div>
      </form>`;

    main.querySelector('#part-form').addEventListener('submit', async event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      const novaQuantidade = Utils.parseQuantidade(data.novaQuantidade);
      const ajustar = podeAjustar && data.novaQuantidade !== '' && novaQuantidade !== Warehouse.balance(ctx.state, editing.id);
      if (ajustar) {
        const erros = [
          ...Warehouse.validatePart(ctx.state, data, editing.id).errors,
          ...Warehouse.validateAdjustment(ctx.state, data).errors,
        ];
        if (!data.senhaAdmin) erros.push('Informe sua senha de administrador para registrar o ajuste.');
        if (erros.length) {
          UI.showErrors(main.querySelector('#form-errors'), erros);
          return;
        }
        const confirmacao = await Api.post('/auth/reautenticar', { senha: data.senhaAdmin });
        if (!confirmacao.ok) {
          UI.showErrors(main.querySelector('#form-errors'), [confirmacao.error.message]);
          return;
        }
      }
      const result = editing ? Warehouse.updatePart(ctx.state, editing.id, data) : Warehouse.createPart(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      if (ajustar) Warehouse.addAdjustment(ctx.state, data, ctx.user.nome);
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast(ajustar ? 'Peça atualizada e ajuste de estoque registrado.' : (editing ? 'Peça atualizada.' : 'Peça cadastrada.'));
        ctx.go('#/almoxarifado/estoque');
      });
    });

    if (editing) {
      main.querySelector('#part-delete').addEventListener('click', () => {
        if (!UI.confirmAction(`Excluir a peça ${editing.codigo} – ${editing.descricao}? Esta ação não pode ser desfeita.`)) return;
        const result = Warehouse.deletePart(ctx.state, editing.id);
        if (!result.ok) {
          UI.showErrors(main.querySelector('#form-errors'), result.errors);
          return;
        }
        ctx.save().then(ok => {
          if (!ok) return;
          ctx.toast('Peça excluída.');
          ctx.go('#/almoxarifado/estoque');
        });
      });
    }
  }

  function entryForm(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Registrar entrada de peça', 'Cada entrada aumenta o saldo e fica registrada no histórico da peça.')}
      <form class="card form-grid" id="entry-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field full">Peça (digite código ou descrição)${UI.searchField('part', ctx.state, { id: 'entry-peca', name: 'pecaId', placeholder: 'Ex.: FLT-1001 ou filtro', required: true })}</label>
        <label class="field">Quantidade recebida<input name="quantidade" type="number" min="1" step="1" inputmode="numeric" required></label>
        <label class="field">Data de entrada<input name="data" type="date" required value="${Utils.todayIso()}"></label>
        <label class="field">Valor unitário desta entrada (R$)<input name="valorUnitario" inputmode="decimal" required placeholder="0,00"></label>
        <label class="field">Responsável pelo recebimento<input name="responsavel" required></label>
        <label class="field full">Observação<input name="observacao" placeholder="Opcional: nota fiscal, fornecedor…"></label>
        <div class="form-actions full">
          <a class="btn btn-ghost" href="#/almoxarifado/estoque">Cancelar</a>
          <button class="btn btn-primary" type="submit">Registrar entrada</button>
        </div>
      </form>`;
    const form = main.querySelector('#entry-form');
    const select = form.querySelector('[name="pecaId"]');
    const price = form.querySelector('[name="valorUnitario"]');
    select.addEventListener('change', () => {
      const part = Warehouse.findPart(ctx.state, select.value);
      if (part && !price.value) price.value = moneyInput(part.valorUnitario);
    });
    const syncSearch = UI.bindSearchFields(form, ctx.state);

    form.addEventListener('submit', event => {
      event.preventDefault();
      syncSearch();
      const result = Warehouse.addEntry(ctx.state, readForm(event.currentTarget));
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast('Entrada registrada e saldo atualizado.');
        ctx.go('#/almoxarifado/estoque');
      });
    });
  }

  function partHistory(main, params, ctx) {
    const part = Warehouse.findPart(ctx.state, params.id);
    if (!part) {
      main.innerHTML = `${pageHeader('Peça não encontrada')}<p><a class="link" href="#/almoxarifado/estoque">Voltar ao estoque</a></p>`;
      return;
    }
    const saldo = Warehouse.balance(ctx.state, part.id);
    const movements = Warehouse.movementsOf(ctx.state, part.id).reverse();
    main.innerHTML = `
      ${pageHeader(`${part.codigo} – ${part.descricao}`, `Valor unitário de referência: ${money(part.valorUnitario)} · Estoque mínimo: ${part.estoqueMinimo}`,
        `<a class="btn btn-ghost" href="#/almoxarifado/estoque/${esc(part.id)}/editar">Editar cadastro</a>`)}
      <section class="kpi-grid">
        ${kpi('Saldo atual', saldo, saldo <= part.estoqueMinimo ? 'Abaixo ou no mínimo' : 'Dentro do esperado')}
        ${kpi('Movimentações', movements.length)}
      </section>
      <section class="card">
        <h2>Histórico de movimentações</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Tipo' }, { label: 'Quantidade', align: 'right' }, { label: 'Valor unitário', align: 'right' },
            { label: 'Destino / origem' }, { label: 'Responsável' }, { label: 'Saldo após', align: 'right' }, { label: 'Observação' }],
          movements.map(m => [
            Utils.formatDate(m.data),
            m.tipo === 'Entrada' ? UI.badge('Entrada', 'ok') : (m.tipo === 'Ajuste' ? UI.badge('Ajuste', 'info') : UI.badge('Saída', 'warn')),
            `${m.quantidade >= 0 && m.tipo !== 'Saida' ? '+' : '−'}${Utils.formatQuantity(Math.abs(m.quantidade))}`,
            money(m.valorUnitario),
            m.veiculoId ? `${esc((Vehicles.find(ctx.state, m.veiculoId) || {}).placa || m.veiculoId)}${m.manutencaoId ? ` · ${esc(m.manutencaoId)}` : ''}` : 'Entrada no estoque',
            esc(m.responsavel),
            `<strong>${m.saldoApos}</strong>`,
            esc(m.observacao || '—'),
          ]),
        )}
        <p class="muted small">Os valores das retiradas são os valores vigentes no dia da retirada. Alterar o cadastro da peça não modifica esse histórico.</p>
      </section>`;
  }

  /* Filtros de período, veículo e peça aplicados sobre a lista de retiradas. */
  function withdrawals(main, params, ctx) {
    const today = Utils.todayIso();
    const monthStart = `${today.slice(0, 8)}01`;
    main.innerHTML = `
      ${pageHeader('Retiradas de peças', 'Saídas do almoxarifado para veículos, com ou sem manutenção vinculada.')}
      <section class="card">
        <h2>Registrar retirada</h2>
        <div id="withdrawal-form-slot"></div>
      </section>
      <section class="card">
        <h2>Retiradas registradas</h2>
        <div class="filter-bar">
          <label class="field">De<input type="date" id="w-from" value="${monthStart}"></label>
          <label class="field">Até<input type="date" id="w-to" value="${today}"></label>
          <label class="field">Veículo (placa)${UI.searchInput('vehicle', ctx.state, { id: 'w-veiculo', placeholder: 'Todos' })}</label>
          <label class="field">Peça (código/descrição)${UI.searchInput('part', ctx.state, { id: 'w-peca', placeholder: 'Todas' })}</label>
        </div>
        <div id="withdrawal-list"></div>
      </section>`;

    main.querySelector('#withdrawal-form-slot').innerHTML = withdrawalFormHtml(ctx.state);
    bindWithdrawalForm(main.querySelector('[data-form="withdrawal"]'), ctx.state, ctx, {}, () => ctx.refresh());

    const renderList = () => {
      const report = Reports.withdrawalsReport(ctx.state, {
        from: main.querySelector('#w-from').value,
        to: main.querySelector('#w-to').value,
        veiculoId: Search.vehicleFilter(ctx.state, main.querySelector('#w-veiculo').value),
        pecaId: Search.partFilter(ctx.state, main.querySelector('#w-peca').value),
      });
      const rows = report.rows.map(r => {
        const vehicle = Vehicles.find(ctx.state, r.veiculoId);
        return [
          Utils.formatDate(r.data),
          esc(r.pecaDescricao),
          Utils.formatQuantity(r.quantidade),
          esc(vehicle ? vehicle.placa : r.veiculoId),
          esc(r.responsavel),
          money(r.valorTotal),
          esc(r.origem),
        ];
      });
      main.querySelector('#withdrawal-list').innerHTML = table(
        [{ label: 'Data' }, { label: 'Peça' }, { label: 'Qtd.', align: 'right' }, { label: 'Veículo' }, { label: 'Responsável' },
          { label: 'Valor', align: 'right' }, { label: 'Origem' }],
        rows,
        'Nenhuma retirada no período selecionado.',
      ) + `<p class="totals">Total de unidades: <strong>${report.totals.quantidade}</strong> · Valor total: <strong>${money(report.totals.valor)}</strong></p>`;
    };
    ['#w-from', '#w-to'].forEach(sel => main.querySelector(sel).addEventListener('change', renderList));
    ['#w-veiculo', '#w-peca'].forEach(sel => { main.querySelector(sel).addEventListener('input', renderList); main.querySelector(sel).addEventListener('change', renderList); });
    renderList();
  }

  function toolsScreen(main, params, ctx) {
    ctx.state.ferramentas = Array.isArray(ctx.state.ferramentas) ? ctx.state.ferramentas : [];
    ctx.state.retiradasFerramentas = Array.isArray(ctx.state.retiradasFerramentas) ? ctx.state.retiradasFerramentas : [];
    const render = () => {
      const rows = Warehouse.listTools(ctx.state);
      const available = rows.filter(tool => tool.situacao === 'Disponível');
      main.querySelector('#tools-list').innerHTML = table(
        [{ label: 'Código' }, { label: 'Ferramenta' }, { label: 'Patrimônio' }, { label: 'Situação' }, { label: 'Responsável atual' }, { label: 'Previsão de devolução' }],
        rows.map(tool => [esc(tool.codigo), esc(tool.descricao), esc(tool.patrimonio || '—'), tool.situacao === 'Disponível' ? UI.badge('Disponível', 'ok') : (tool.situacao === 'Emprestada' ? UI.badge('Emprestada', 'warn') : UI.badge('Inativa', 'muted')), esc(tool.activeLoan ? tool.activeLoan.responsavel : '—'), tool.activeLoan ? Utils.formatDate(tool.activeLoan.previsaoDevolucao) : '—']),
        'Nenhuma ferramenta cadastrada.'
      );
      main.querySelector('#tool-loan-select').innerHTML = '<option value="">Selecione uma ferramenta</option>' + available.map(tool => `<option value="${esc(tool.id)}">${esc(tool.codigo)} — ${esc(tool.descricao)}</option>`).join('');
      main.querySelector('#tool-loans').innerHTML = table(
        [{ label: 'Ferramenta' }, { label: 'Responsável' }, { label: 'Finalidade' }, { label: 'Retirada' }, { label: 'Previsão' }, { label: 'Devolução' }],
        ctx.state.retiradasFerramentas.slice().sort((a,b) => b.dataRetirada.localeCompare(a.dataRetirada)).map(loan => {
          const tool = ctx.state.ferramentas.find(item => item.id === loan.ferramentaId);
          const returned = Boolean(loan.devolvidaEm);
          const action = returned ? `${Utils.formatDate(loan.devolvidaEm)} — ${esc(loan.condicaoDevolucao)}` : `<form data-return-loan="${esc(loan.id)}" class="form-grid"><input name="devolvidaEm" type="date" required value="${Utils.todayIso()}"><select name="condicaoDevolucao" required><option value="">Condição na devolução</option><option>Boa</option><option>Com avaria</option><option>Inutilizada</option></select><input name="observacaoDevolucao" placeholder="Observação (opcional)"><button class="btn btn-small btn-primary" type="submit">Registrar devolução</button><div class="form-errors full"></div></form>`;
          return [esc(tool ? `${tool.codigo} — ${tool.descricao}` : loan.ferramentaId), esc(loan.responsavel), esc(loan.finalidade || '—'), Utils.formatDate(loan.dataRetirada), Utils.formatDate(loan.previsaoDevolucao), action];
        }), 'Nenhuma retirada de ferramenta registrada.'
      );
      main.querySelectorAll('[data-return-loan]').forEach(form => form.addEventListener('submit', event => {
        event.preventDefault();
        const result = Warehouse.returnTool(ctx.state, form.dataset.returnLoan, readForm(form));
        if (!result.ok) { UI.showErrors(form.querySelector('.form-errors'), result.errors); return; }
        ctx.save().then(ok => { if (ok) { ctx.toast('Devolução registrada.'); ctx.refresh(); } });
      }));
    };
    main.innerHTML = `${pageHeader('Ferramentas', 'Cadastro individual, empréstimos, devoluções e histórico de responsabilidade.')}
      <section class="card"><h2>Cadastrar ferramenta</h2><form id="tool-create-form" class="form-grid" novalidate><div class="form-errors full"></div><label class="field">Código<input name="codigo" required></label><label class="field">Descrição<input name="descricao" required></label><label class="field">Patrimônio<input name="patrimonio"></label><label class="field full">Observação<input name="observacao"></label><div class="form-actions full"><button class="btn btn-primary" type="submit">Cadastrar ferramenta</button></div></form></section>
      <section class="card"><h2>Ferramentas cadastradas</h2><div id="tools-list"></div></section>
      <section class="card"><h2>Retirar ferramenta</h2><form id="tool-loan-form" class="form-grid" novalidate><div class="form-errors full"></div><label class="field full">Ferramenta<select id="tool-loan-select" name="ferramentaId" required></select></label><label class="field">Responsável<input name="responsavel" required></label><label class="field">Finalidade<input name="finalidade" placeholder="Ex.: manutenção do veículo"></label><label class="field">Data da retirada<input name="dataRetirada" type="date" required value="${Utils.todayIso()}"></label><label class="field">Previsão de devolução<input name="previsaoDevolucao" type="date" required value="${Utils.todayIso()}"></label><label class="field full">Observação<input name="observacao"></label><div class="form-actions full"><button class="btn btn-primary" type="submit">Confirmar empréstimo</button></div></form></section>
      <section class="card"><h2>Histórico de retiradas e devoluções</h2><div id="tool-loans"></div></section>`;
    main.querySelector('#tool-create-form').addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget;
      const result = Warehouse.createTool(ctx.state, readForm(form));
      if (!result.ok) { UI.showErrors(form.querySelector('.form-errors'), result.errors); return; }
      ctx.save().then(ok => { if (ok) { ctx.toast('Ferramenta cadastrada.'); ctx.refresh(); } });
    });
    main.querySelector('#tool-loan-form').addEventListener('submit', event => {
      event.preventDefault(); const form = event.currentTarget;
      const result = Warehouse.loanTool(ctx.state, readForm(form));
      if (!result.ok) { UI.showErrors(form.querySelector('.form-errors'), result.errors); return; }
      ctx.save().then(ok => { if (ok) { ctx.toast('Empréstimo de ferramenta registrado.'); ctx.refresh(); } });
    });
    render();
  }

  function external(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Peças externas', 'Peças utilizadas em veículos que não estavam disponíveis no almoxarifado. Não alteram o saldo do estoque.')}
      <section class="card">
        <h2>Registrar peça externa</h2>
        <div id="external-form-slot"></div>
      </section>
      <section class="card">
        <h2>Peças externas registradas</h2>
        <div id="external-list"></div>
      </section>`;
    main.querySelector('#external-form-slot').innerHTML = externalFormHtml(ctx.state);
    bindExternalForm(main.querySelector('[data-form="external"]'), ctx, {}, () => ctx.refresh());

    const rows = Warehouse.externalParts(ctx.state).map(e => {
      const vehicle = Vehicles.find(ctx.state, e.veiculoId);
      return [
        Utils.formatDate(e.data),
        esc(e.descricao),
        String(e.quantidade),
        money(e.valorUnitario),
        money(e.valorTotal),
        esc(vehicle ? vehicle.placa : e.veiculoId),
        e.manutencaoId ? esc(e.manutencaoId) : '—',
        esc(e.responsavel),
        esc(e.motivo || '—'),
      ];
    });
    main.querySelector('#external-list').innerHTML = table(
      [{ label: 'Data' }, { label: 'Descrição' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor unit.', align: 'right' },
        { label: 'Total', align: 'right' }, { label: 'Veículo' }, { label: 'Manutenção' }, { label: 'Responsável' }, { label: 'Motivo' }],
      rows,
      'Nenhuma peça externa registrada.',
    );
  }

  function usedParts(main, params, ctx) {
    const today = Utils.todayIso();
    const monthStart = `${today.slice(0, 8)}01`;
    main.innerHTML = `
      ${pageHeader('Peças usadas', 'Peças consumidas em veículos: retiradas do almoxarifado e peças externas.')}
      <section class="card">
        <h2>Peças usadas registradas</h2>
        <div class="filter-bar">
          <label class="field">De<input type="date" id="u-from" value="${monthStart}"></label>
          <label class="field">Até<input type="date" id="u-to" value="${today}"></label>
          <label class="field">Veículo (placa)${UI.searchInput('vehicle', ctx.state, { id: 'u-veiculo', placeholder: 'Todos' })}</label>
          <label class="field">Tipo<select id="u-tipo"><option value="Todos">Todos</option><option value="Interno">Interno (almoxarifado)</option><option value="Externo">Externo</option></select></label>
        </div>
        <div id="used-parts-list"></div>
      </section>`;

    const renderList = () => {
      const from = main.querySelector('#u-from').value;
      const to = main.querySelector('#u-to').value;
      const veiculoId = Search.vehicleFilter(ctx.state, main.querySelector('#u-veiculo').value);
      const tipo = main.querySelector('#u-tipo').value;

      const retiradas = Warehouse.withdrawals(ctx.state, { from, to, veiculoId }).map(r => ({
        data: r.data,
        tipo: 'Interno',
        descricao: r.pecaDescricao,
        quantidade: r.quantidade,
        valorUnitario: r.valorUnitario,
        valorTotal: r.valorTotal,
        veiculoId: r.veiculoId,
        veiculoPlaca: (Vehicles.find(ctx.state, r.veiculoId) || {}).placa || r.veiculoId,
        manutencaoId: r.manutencaoId,
        responsavel: r.responsavel,
      }));

      const externas = Warehouse.externalParts(ctx.state, { from, to, veiculoId }).map(e => ({
        data: e.data,
        tipo: 'Externo',
        descricao: e.descricao,
        quantidade: e.quantidade,
        valorUnitario: e.valorUnitario,
        valorTotal: e.valorTotal,
        veiculoId: e.veiculoId,
        veiculoPlaca: (Vehicles.find(ctx.state, e.veiculoId) || {}).placa || e.veiculoId,
        manutencaoId: e.manutencaoId,
        responsavel: e.responsavel,
      }));

      let rows = [...retiradas, ...externas].sort((a, b) => b.data.localeCompare(a.data));
      if (tipo !== 'Todos') rows = rows.filter(r => r.tipo === tipo);

      const linhas = rows.map(r => [
        Utils.formatDate(r.data),
        esc(r.descricao),
        Utils.formatQuantity(r.quantidade),
        money(r.valorUnitario),
        money(r.valorTotal),
        esc(r.veiculoPlaca),
        r.tipo === 'Interno' ? UI.badge('Interno', 'info') : UI.badge('Externo', 'muted'),
        r.manutencaoId ? esc(r.manutencaoId) : '—',
        esc(r.responsavel),
      ]);

      main.querySelector('#used-parts-list').innerHTML = table(
        [{ label: 'Data' }, { label: 'Peça' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor unit.', align: 'right' },
          { label: 'Total', align: 'right' }, { label: 'Veículo' }, { label: 'Origem' }, { label: 'Manutenção' }, { label: 'Responsável' }],
        linhas,
        'Nenhuma peça usada no período selecionado.',
      ) + `<p class="totals">Total de unidades: <strong>${rows.reduce((a, r) => a + r.quantidade, 0)}</strong>  ·  Valor total: <strong>${money(Utils.sum(rows, r => r.valorTotal))}</strong></p>`;
    };

    ['#u-from', '#u-to', '#u-tipo'].forEach(sel => main.querySelector(sel).addEventListener('change', renderList));
    ['#u-veiculo'].forEach(sel => { main.querySelector(sel).addEventListener('input', renderList); main.querySelector(sel).addEventListener('change', renderList); });
    renderList();
  }

  /* Gastos externos podem ser registrados como compra ou como baixa de item já estocado. */
  function spendingFields(state, current) {
    const v = current || { data: Utils.todayIso(), tipo: 'Insumo', descricao: '', quantidade: '', valorUnitario: '', fornecedor: '', responsavel: '', observacao: '' };
    const quantidade = v.quantidade === '' || v.quantidade === undefined ? '' : String(v.quantidade).replace('.', ',');
    const tipos = ExternalSpending.TIPOS.map(t => option(t, t, t === v.tipo)).join('');
    const retirada = Boolean(v.retiradaEstoque);
    const part = retirada ? Warehouse.findPart(state, v.pecaId) : null;
    return `
      <label class="field">Data da compra/retirada<input name="data" type="date" required value="${esc(v.data)}"></label>
      <label class="field">Tipo<select name="tipo" required>${tipos}</select></label>
      <label class="field full">Descrição do item<input name="descricao" required value="${esc(v.descricao)}" placeholder="Ex.: Lubrificante para correntes" ${retirada ? 'readonly' : ''}></label>
      <label class="field" data-purchase-quantity>Quantidade<input name="quantidade" inputmode="decimal" required value="${esc(quantidade)}" placeholder="Ex.: 2 ou 1/2"></label>
      <label class="field">Valor unitário (R$)<input name="valorUnitario" inputmode="decimal" required value="${esc(moneyInput(v.valorUnitario))}" placeholder="0,00" ${retirada ? 'readonly' : ''}></label>
      <label class="field">Fornecedor<input name="fornecedor" required value="${esc(retirada ? 'Estoque interno' : v.fornecedor)}" ${retirada ? 'readonly' : ''}></label>
      <label class="field">Responsável pelo registro<input name="responsavel" required value="${esc(v.responsavel)}"></label>
      <label class="field full">Observação<input name="observacao" value="${esc(v.observacao)}" placeholder="Opcional: nota fiscal, finalidade"></label>
      <label class="field full"><span><input type="checkbox" name="retiradaEstoque" value="true" ${retirada ? 'checked' : ''} ${current ? 'disabled' : ''}> Retirar do estoque</span></label>
      <div class="field full" data-stock-withdrawal ${retirada ? '' : 'hidden'}>
        <div class="form-grid" style="grid-template-columns:minmax(0, 2fr) minmax(120px, 1fr); gap:12px; align-items:end">
          <label class="field">Peça do estoque (digite código ou descrição)${UI.searchField('part', state, { id: 'spending-peca', name: 'pecaId', placeholder: 'Ex.: FLT-1001 ou filtro', required: !current })}</label>
          <label class="field">Quantidade retirada<input name="quantidadeRetirada" inputmode="decimal" value="${esc(quantidade)}" placeholder="Ex.: 2 ou 1/2" ${retirada ? 'required' : ''}></label>
        </div>
        <p class="hint">Ao selecionar a peça, descrição e valor unitário serão preenchidos pelo cadastro. O saldo será baixado ao registrar o gasto.</p>
      </div>
      <p class="hint full" data-total-hint></p>`;
  }

  function bindSpendingTotal(formEl, state) {
    const hint = formEl.querySelector('[data-total-hint]');
    const checkbox = formEl.querySelector('[name="retiradaEstoque"]');
    const stockArea = formEl.querySelector('[data-stock-withdrawal]');
    const partInput = formEl.querySelector('#spending-peca');
    const partHidden = formEl.querySelector('input[type="hidden"][name="pecaId"]');
    const descricao = formEl.querySelector('[name="descricao"]');
    const valorUnitario = formEl.querySelector('[name="valorUnitario"]');
    const fornecedor = formEl.querySelector('[name="fornecedor"]');
    const quantidadeInput = formEl.querySelector('[name="quantidade"]');
    const quantidadeRetirada = formEl.querySelector('[name="quantidadeRetirada"]');
    const quantidadeCompra = formEl.querySelector('[data-purchase-quantity]');
    const syncSearch = UI.bindSearchFields(formEl, state);
    const toggle = () => {
      const enabled = Boolean(checkbox && checkbox.checked);
      if (stockArea) stockArea.hidden = !enabled;
      if (partInput) partInput.required = enabled;
      if (quantidadeRetirada) quantidadeRetirada.required = enabled;
      if (quantidadeRetirada) quantidadeRetirada.disabled = !enabled;
      if (quantidadeInput) quantidadeInput.disabled = false;
      if (quantidadeCompra) quantidadeCompra.hidden = enabled;
      if (!enabled && partHidden) { partHidden.value = ''; if (partInput) partInput.value = ''; }
      if (descricao) descricao.readOnly = enabled;
      if (valorUnitario) valorUnitario.readOnly = enabled;
      if (fornecedor) {
        if (enabled) { fornecedor.value = 'Estoque interno'; fornecedor.readOnly = true; }
        else { if (fornecedor.value === 'Estoque interno') fornecedor.value = ''; fornecedor.readOnly = false; }
      }
      update();
    };
    const update = () => {
      const quantidade = Utils.parseQuantidade(checkbox && checkbox.checked && quantidadeRetirada ? quantidadeRetirada.value : quantidadeInput.value);
      const valor = Utils.parseMoney(valorUnitario.value);
      hint.textContent = quantidade > 0 && valor > 0
        ? `Total: ${money(Utils.round2(quantidade * valor))}`
        : 'Informe a quantidade e o valor unitário para ver o total.';
    };
    if (checkbox) checkbox.addEventListener('change', toggle);
    if (partHidden) partHidden.addEventListener('change', () => {
      const part = Warehouse.findPart(state, partHidden.value);
      if (part && checkbox && checkbox.checked) {
        descricao.value = part.descricao;
        valorUnitario.value = moneyInput(part.valorUnitario);
        update();
      }
    });
    formEl.addEventListener('input', update);
    if (quantidadeRetirada) quantidadeRetirada.addEventListener('input', update);
    toggle();
    return () => {
      syncSearch();
      if (checkbox && checkbox.checked && quantidadeRetirada && quantidadeInput) {
        quantidadeInput.value = quantidadeRetirada.value;
      }
    };
  }

  function externalSpending(main, params, ctx) {
    const today = Utils.todayIso();
    const monthStart = `${today.slice(0, 8)}01`;
    main.innerHTML = `
      ${pageHeader('Gastos externos', 'Registre compras externas ou marque “Retirar do estoque” para dar baixa em uma peça já cadastrada no almoxarifado.')}
      <section class="card">
        <h2>Registrar gasto</h2>
        <form class="form-grid" id="spending-form" novalidate>
          <div class="form-errors full" id="form-errors"></div>
          ${spendingFields(ctx.state)}
          <div class="form-actions full"><button class="btn btn-primary" type="submit">Registrar gasto</button></div>
        </form>
      </section>
      <section class="card">
        <h2>Gastos registrados</h2>
        <div class="filter-bar">
          <label class="field">De<input type="date" id="g-from" value="${monthStart}"></label>
          <label class="field">Até<input type="date" id="g-to" value="${today}"></label>
          <label class="field">Tipo<select id="g-tipo"><option value="Todos">Todos</option><option value="Peça">Peças</option><option value="Insumo">Insumos</option></select></label>
        </div>
        <div id="g-list"></div>
      </section>`;

    const formEl = main.querySelector('#spending-form');
    const syncSearch = bindSpendingTotal(formEl, ctx.state);
    formEl.addEventListener('submit', event => {
      event.preventDefault();
      syncSearch();
      const result = ExternalSpending.create(ctx.state, readForm(formEl));
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast(result.value.retiradaEstoque ? 'Gasto registrado e saldo do estoque atualizado.' : 'Gasto externo registrado.');
        ctx.refresh();
      });
    });

    const renderList = () => {
      const rows = ExternalSpending.list(ctx.state, {
        from: main.querySelector('#g-from').value,
        to: main.querySelector('#g-to').value,
        tipo: main.querySelector('#g-tipo').value,
      });
      const resumo = ExternalSpending.summary(rows);
      main.querySelector('#g-list').innerHTML = table(
        [{ label: 'Data' }, { label: 'Tipo' }, { label: 'Descrição' }, { label: 'Qtd.', align: 'right' }, { label: 'Valor unit.', align: 'right' },
          { label: 'Total', align: 'right' }, { label: 'Fornecedor' }, { label: 'Responsável' }, { label: 'Observação' }],
        rows.map(g => ({
          cells: [
            Utils.formatDate(g.data),
            g.tipo === 'Peça' ? UI.badge('Peça', 'info') : UI.badge('Insumo', 'muted'),
            esc(g.descricao),
            Utils.formatQuantity(g.quantidade),
            money(g.valorUnitario),
            money(g.valorTotal),
            esc(g.fornecedor),
            esc(g.responsavel),
            esc(g.observacao || '—'),
          ],
          footer: `<a class="link" href="#/almoxarifado/gastos/${esc(g.id)}/editar">Editar</a>`,
        })),
        'Nenhum gasto externo no período selecionado.',
      ) + `<p class="totals">Registros: <strong>${resumo.registros}</strong> · Peças: <strong>${money(resumo.porTipo['Peça'])}</strong> · Insumos: <strong>${money(resumo.porTipo.Insumo)}</strong> · Total: <strong>${money(resumo.valorTotal)}</strong></p>`;
    };
    ['#g-from', '#g-to', '#g-tipo'].forEach(sel => main.querySelector(sel).addEventListener('change', renderList));
    renderList();
  }

  function externalSpendingForm(main, params, ctx) {
    const editing = ExternalSpending.find(ctx.state, params.id);
    if (!editing) {
      main.innerHTML = `${pageHeader('Gasto não encontrado')}<p><a class="link" href="#/almoxarifado/gastos">Voltar aos gastos externos</a></p>`;
      return;
    }
    if (editing.retiradaEstoque) {
      main.innerHTML = `${pageHeader(`Gasto ${editing.id}`, 'Este gasto está vinculado a uma retirada do estoque. Para preservar o histórico e o saldo, ele não pode ser editado ou excluído.')}
        <section class="card"><p><strong>${esc(editing.descricao)}</strong></p><p>Quantidade: ${Utils.formatQuantity(editing.quantidade)} · Valor total: ${money(editing.valorTotal)}</p><p>Peça vinculada: ${esc(editing.pecaId)}</p><a class="btn btn-ghost" href="#/almoxarifado/gastos">Voltar aos gastos externos</a></section>`;
      return;
    }
    main.innerHTML = `
      ${pageHeader(`Editar gasto ${editing.id}`, 'A alteração não toca o estoque nem os custos dos veículos.')}
      <form class="card form-grid" id="spending-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        ${spendingFields(ctx.state, editing)}
        <div class="form-actions full">
          <button class="btn btn-danger" type="button" id="spending-delete">Excluir gasto</button>
          <a class="btn btn-ghost" href="#/almoxarifado/gastos">Cancelar</a>
          <button class="btn btn-primary" type="submit">Salvar alterações</button>
        </div>
      </form>`;

    const formEl = main.querySelector('#spending-form');
    const syncSearch = bindSpendingTotal(formEl, ctx.state);
    formEl.addEventListener('submit', event => {
      event.preventDefault();
      syncSearch();
      const result = ExternalSpending.update(ctx.state, editing.id, readForm(formEl));
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast('Gasto atualizado.');
        ctx.go('#/almoxarifado/gastos');
      });
    });
    main.querySelector('#spending-delete').addEventListener('click', async event => {
      const button = event.currentTarget;
      if (!UI.confirmAction(`Excluir o gasto ${editing.id} (${editing.descricao})? Esta ação não pode ser desfeita.`)) return;
      button.disabled = true;
      const result = ExternalSpending.remove(ctx.state, editing.id);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors || ['Não foi possível excluir o gasto.']);
        button.disabled = false;
        return;
      }
      const ok = await ctx.save();
      if (!ok) {
        button.disabled = false;
        return;
      }
      ctx.toast('Gasto excluído.');
      ctx.go('#/almoxarifado/gastos');
    });
  }

  return {
    externalSpending, externalSpendingForm,
    stock, partForm, entryForm, partHistory, withdrawals, tools: toolsScreen, external, usedParts,
    withdrawalFormHtml, bindWithdrawalForm, externalFormHtml, bindExternalForm, openMaintenanceOptions,
  };
})();
