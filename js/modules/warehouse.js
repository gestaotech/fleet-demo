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

  function stockBadge(row) {
    if (row.saldo === 0) return UI.badge('Zerado', 'danger');
    if (row.baixo) return UI.badge('Estoque baixo', 'warn');
    return UI.badge('Normal', 'ok');
  }

  function vehicleOptions(state, selectedId) {
    return state.veiculos
      .filter(v => v.situacao === 'Ativo')
      .map(v => option(v.id, `${v.placa} – ${v.marca}`, v.id === selectedId))
      .join('');
  }

  function partOptions(state, selectedId) {
    return state.pecas
      .map(p => option(p.id, `${p.codigo} – ${p.descricao} (saldo ${Warehouse.balance(state, p.id)})`, p.id === selectedId))
      .join('');
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

  function bindVehicleMaintenanceFilter(form, state) {
    const vehicleBusca = form.querySelector('[name="veiculoBusca"]');
    const vehicleHidden = form.querySelector('[name="veiculoId"]');
    const maintenance = form.querySelector('[name="manutencaoId"]');
    if (!vehicleBusca || !maintenance) return;
    const apply = () => {
      const id = resolveVehicleId(state, vehicleBusca.value);
      vehicleHidden.value = id || '';
      maintenance.querySelectorAll('option[data-veiculo]').forEach(opt => {
        opt.hidden = id ? opt.dataset.veiculo !== id : false;
      });
      if (maintenance.selectedOptions[0] && maintenance.selectedOptions[0].hidden) maintenance.value = '';
    };
    vehicleBusca.addEventListener('input', apply);
    vehicleBusca.addEventListener('change', apply);
    apply();
  }

  function resolvePartId(state, busca) {
    const termo = Utils.searchKey(busca);
    if (!termo) return null;
    // Exact match by code
    const porCodigo = state.pecas.find(p => Utils.searchKey(p.codigo) === termo);
    if (porCodigo) return porCodigo.id;
    // Match by description
    const porDesc = state.pecas.filter(p => Utils.searchKey(p.descricao).includes(termo));
    if (porDesc.length === 1) return porDesc[0].id;
    // Match by code partial
    const porCodigoParcial = state.pecas.filter(p => Utils.searchKey(p.codigo).includes(termo));
    if (porCodigoParcial.length === 1) return porCodigoParcial[0].id;
    return null;
  }

  function resolveVehicleId(state, busca) {
    const termo = Utils.normalizePlate(busca);
    if (!termo) return null;
    const veiculo = state.veiculos.find(v => Utils.normalizePlate(v.placa) === termo);
    if (veiculo) return veiculo.id;
    // Partial match
    const parcial = state.veiculos.filter(v => Utils.normalizePlate(v.placa).includes(termo) && v.situacao === 'Ativo');
    if (parcial.length === 1) return parcial[0].id;
    return null;
  }

  function bindPartBalance(form, state) {
    const busca = form.querySelector('[name="pecaBusca"]');
    const hidden = form.querySelector('[name="pecaId"]');
    const hint = form.querySelector('[data-balance]');
    const quantity = form.querySelector('[name="quantidade"]');
    const update = () => {
      const termo = Utils.searchKey(busca.value);
      if (!termo) {
        hidden.value = '';
        hint.textContent = 'Digite o código ou descrição da peça para ver o saldo disponível.';
        return;
      }
      const id = resolvePartId(state, busca.value);
      hidden.value = id || '';
      const part = id ? Warehouse.findPart(state, id) : null;
      if (!part) {
        // Check if there are multiple matches
        const matches = state.pecas.filter(p => Utils.searchKey(p.codigo).includes(termo) || Utils.searchKey(p.descricao).includes(termo));
        if (matches.length > 1) {
          hint.textContent = `${matches.length} peças encontradas. Selecione uma na lista de sugestões.`;
        } else {
          hint.textContent = 'Peça não encontrada. Verifique o código ou a descrição.';
        }
        return;
      }
      hint.textContent = `Saldo disponível: ${Warehouse.balance(state, part.id)} un. (${part.codigo} — ${part.descricao})`;
      if (quantity) quantity.max = Warehouse.balance(state, part.id);
    };
    busca.addEventListener('input', update);
    busca.addEventListener('change', update);
    update();
  }

  /* opts.maintenance: quando informado, veículo e manutenção ficam fixos (uso pelo módulo Manutenção). */
  function withdrawalFormHtml(state, opts = {}) {
    const fixed = opts.maintenance || null;
    const vehicleField = fixed
      ? `<input type="hidden" name="veiculoId" value="${esc(fixed.veiculoId)}">
         <input type="hidden" name="manutencaoId" value="${esc(fixed.id)}">
         <div class="field"><span>Veículo</span><strong>${esc((Vehicles.find(state, fixed.veiculoId) || {}).placa || fixed.veiculoId)}</strong></div>
         <div class="field"><span>Manutenção</span><strong>${esc(fixed.id)}</strong></div>`
      : `<label class="field">Veículo de destino (digite a placa)
           <input name="veiculoBusca" type="text" required placeholder="Ex.: DEM1A01" list="vehicle-list" autocomplete="off">
           <datalist id="vehicle-list">${state.veiculos.filter(v => v.situacao === 'Ativo').map(v => `<option value="${esc(v.placa)}">${esc(v.marca)}</option>`).join('')}</datalist>
           <input type="hidden" name="veiculoId">
         </label>
         <label class="field">Manutenção vinculada (opcional)
           <select name="manutencaoId"><option value="">Retirada direta, sem manutenção</option>${openMaintenanceOptions(state)}</select>
         </label>`;
    return `
      <form class="card form-grid" data-form="withdrawal" novalidate>
        <div class="form-errors full"></div>
        <label class="field full">Peça retirada (digite código ou descrição)
          <input name="pecaBusca" type="text" required placeholder="Ex.: FLT-1001 ou filtro" list="part-list" autocomplete="off">
          <datalist id="part-list">${state.pecas.map(p => `<option value="${esc(p.codigo)}">${esc(p.descricao)} (saldo ${Warehouse.balance(state, p.id)})</option>`).join('')}</datalist>
          <input type="hidden" name="pecaId">
        </label>
        <p class="hint full" data-balance></p>
        ${vehicleField}
        <label class="field">Quantidade<input name="quantidade" type="number" min="1" step="1" inputmode="numeric" required></label>
        <label class="field">Data da retirada<input name="data" type="date" required value="${Utils.todayIso()}"></label>
        <label class="field">Responsável pela solicitação<input name="responsavel" required></label>
        <label class="field">Observação<input name="observacao" placeholder="Opcional"></label>
        <div class="form-actions full">
          <button class="btn btn-primary" type="submit">Confirmar retirada</button>
        </div>
      </form>`;
  }

  /* Liga o formulário de retirada. onDone recebe a movimentação registrada. */
  function bindWithdrawalForm(form, state, ctx, opts = {}, onDone) {
    if (!opts.maintenance) bindVehicleMaintenanceFilter(form, state);
    bindPartBalance(form, state);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.dataset.sending === 'true') return;
      form.dataset.sending = 'true';
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      // Resolve typed search values to IDs
      const pecaBusca = form.querySelector('[name="pecaBusca"]');
      const pecaHidden = form.querySelector('[name="pecaId"]');
      const veiculoBusca = form.querySelector('[name="veiculoBusca"]');
      const veiculoHidden = form.querySelector('[name="veiculoId"]');
      if (pecaBusca && pecaHidden && !pecaHidden.value) {
        pecaHidden.value = resolvePartId(state, pecaBusca.value) || '';
      }
      if (veiculoBusca && veiculoHidden && !veiculoHidden.value) {
        veiculoHidden.value = resolveVehicleId(state, veiculoBusca.value) || '';
      }
      const data = readForm(form);
      const result = opts.maintenance
        ? Maintenance.registerWithdrawal(ctx.state, opts.maintenance.id, data)
        : Warehouse.registerWithdrawal(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(form.querySelector('.form-errors'), result.errors);
        form.dataset.sending = '';
        button.disabled = false;
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast('Retirada confirmada e saldo atualizado.');
        onDone(result.value);
      });
    });
  }

  function externalFormHtml(state, opts = {}) {
    const fixed = opts.maintenance || null;
    const vehicleField = fixed
      ? `<input type="hidden" name="veiculoId" value="${esc(fixed.veiculoId)}">
         <input type="hidden" name="manutencaoId" value="${esc(fixed.id)}">
         <div class="field"><span>Veículo</span><strong>${esc((Vehicles.find(state, fixed.veiculoId) || {}).placa || fixed.veiculoId)}</strong></div>`
      : `<label class="field">Veículo<select name="veiculoId" required><option value="">Selecione…</option>${vehicleOptions(state)}</select></label>
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
    if (!opts.maintenance) bindVehicleMaintenanceFilter(form, ctx.state);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (form.dataset.sending === 'true') return;
      form.dataset.sending = 'true';
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
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
          { label: 'Situação' }, { label: 'Uso' }, { label: '' },
        ],
        filtered.map(r => [
          esc(r.codigo),
          esc(r.descricao),
          money(r.valorUnitario),
          `<strong>${r.saldo}</strong>`,
          String(r.estoqueMinimo),
          Utils.formatDate(r.dataEntrada),
          stockBadge(r),
          r.situacaoUso === 'Nova' ? UI.badge('Nova', 'ok') : (r.situacaoUso === 'Usada' ? UI.badge('Usada', 'muted') : UI.badge('Nova e usada', 'info')),
          `<div class="row-actions"><a class="link" href="#/almoxarifado/estoque/${esc(r.id)}">Movimentações</a><a class="link" href="#/almoxarifado/estoque/${esc(r.id)}/editar">Editar</a></div>`,
        ]),
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
        <div class="form-actions full">
          <a class="btn btn-ghost" href="#/almoxarifado/estoque">Cancelar</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Cadastrar peça'}</button>
        </div>
      </form>`;

    main.querySelector('#part-form').addEventListener('submit', event => {
      event.preventDefault();
      const data = readForm(event.currentTarget);
      const result = editing ? Warehouse.updatePart(ctx.state, editing.id, data) : Warehouse.createPart(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast(editing ? 'Peça atualizada.' : 'Peça cadastrada.');
        ctx.go('#/almoxarifado/estoque');
      });
    });
  }

  function entryForm(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Registrar entrada de peça', 'Cada entrada aumenta o saldo e fica registrada no histórico da peça.')}
      <form class="card form-grid" id="entry-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field full">Peça<select name="pecaId" required><option value="">Selecione…</option>${partOptions(ctx.state)}</select></label>
        <p class="hint full" data-balance></p>
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
    bindPartBalance(form, ctx.state);

    form.addEventListener('submit', event => {
      event.preventDefault();
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
            m.tipo === 'Entrada' ? UI.badge('Entrada', 'ok') : UI.badge('Saída', 'warn'),
            `${m.tipo === 'Entrada' ? '+' : '−'}${m.quantidade}`,
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
          <label class="field">Veículo (placa)<input type="text" id="w-veiculo" placeholder="Todos" list="w-vehicle-list" autocomplete="off">
          <datalist id="w-vehicle-list">${ctx.state.veiculos.map(v => `<option value="${esc(v.placa)}">${esc(v.marca)}${v.situacao === 'Inativo' ? ' (inativo)' : ''}</option>`).join('')}</datalist></label>
          <label class="field">Peça (código/descrição)<input type="text" id="w-peca" placeholder="Todas" list="w-part-list" autocomplete="off">
          <datalist id="w-part-list">${ctx.state.pecas.map(p => `<option value="${esc(p.codigo)}">${esc(p.descricao)}</option>`).join('')}</datalist></label>
        </div>
        <div id="withdrawal-list"></div>
      </section>`;

    main.querySelector('#withdrawal-form-slot').innerHTML = withdrawalFormHtml(ctx.state);
    bindWithdrawalForm(main.querySelector('[data-form="withdrawal"]'), ctx.state, ctx, {}, () => ctx.refresh());

    const renderList = () => {
      const wVeiculoBusca = main.querySelector('#w-veiculo').value;
      const wVeiculoId = (function() {
        const t = Utils.normalizePlate(wVeiculoBusca);
        if (!t || t === 'TODAS' || t === 'TODOS') return 'Todos';
        const v = ctx.state.veiculos.find(vv => Utils.normalizePlate(vv.placa) === t);
        return v ? v.id : wVeiculoBusca;
      })();
      const wPecaBusca = main.querySelector('#w-peca').value;
      const wPecaId = (function() {
        const t = Utils.searchKey(wPecaBusca);
        if (!t || t === 'TODAS' || t === 'TODOS') return 'Todas';
        const p = ctx.state.pecas.find(pp => Utils.searchKey(pp.codigo) === t);
        return p ? p.id : wPecaBusca;
      })();
      const report = Reports.withdrawalsReport(ctx.state, {
        from: main.querySelector('#w-from').value,
        to: main.querySelector('#w-to').value,
        veiculoId: wVeiculoId,
        pecaId: wPecaId,
      });
      const rows = report.rows.map(r => {
        const vehicle = Vehicles.find(ctx.state, r.veiculoId);
        return [
          Utils.formatDate(r.data),
          esc(r.pecaDescricao),
          String(r.quantidade),
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
          <label class="field">Veículo (placa)<input type="text" id="u-veiculo" placeholder="Todos" list="u-vehicle-list" autocomplete="off">
          <datalist id="u-vehicle-list">${ctx.state.veiculos.map(v => `<option value="${esc(v.placa)}">${esc(v.marca)}${v.situacao === 'Inativo' ? ' (inativo)' : ''}</option>`).join('')}</datalist></label>
          <label class="field">Tipo<select id="u-tipo"><option value="Todos">Todos</option><option value="Interno">Interno (almoxarifado)</option><option value="Externo">Externo</option></select></label>
        </div>
        <div id="used-parts-list"></div>
      </section>`;

    const renderList = () => {
      const from = main.querySelector('#u-from').value;
      const to = main.querySelector('#u-to').value;
      const uVeiculoBusca = main.querySelector('#u-veiculo').value;
      const veiculoId = (function() {
        const t = Utils.normalizePlate(uVeiculoBusca);
        if (!t || t === 'TODAS' || t === 'TODOS') return 'Todos';
        const v = ctx.state.veiculos.find(vv => Utils.normalizePlate(vv.placa) === t);
        return v ? v.id : uVeiculoBusca;
      })();
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
        String(r.quantidade),
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

  return {
    stock, partForm, entryForm, partHistory, withdrawals, external, usedParts,
    withdrawalFormHtml, bindWithdrawalForm, externalFormHtml, bindExternalForm, openMaintenanceOptions,
  };
})();
