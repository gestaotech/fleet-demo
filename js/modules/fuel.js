/*
 * Telas do módulo Combustível: lista de abastecimentos com filtros, resumo e consumo, e formulário.
 * Regras ficam em core/fuel.js; aqui só há apresentação e ligação com a persistência.
 */
const FuelScreens = (function () {
  const { esc, kpi, pageHeader, table, option, readForm } = UI;

  const ORIGEM_CONSUMO = 'Dados insuficientes para calcular o consumo';

  function money(value) {
    return Utils.formatMoney(value);
  }

  function decimalInput(value) {
    return value === undefined || value === null || value === '' ? '' : String(value).replace('.', ',');
  }

  function vehicleOptions(state, selectedId) {
    return state.veiculos
      .filter(v => v.situacao === 'Ativo')
      .map(v => option(v.id, `${v.placa} – ${v.marca}`, v.id === selectedId))
      .join('');
  }

  /* No filtro, todos os veículos aparecem porque existem registros históricos de veículos inativos. */
  function vehicleFilterOptions(state) {
    return state.veiculos
      .map(v => option(v.id, `${v.placa} – ${v.marca}${v.situacao === 'Inativo' ? ' (inativo)' : ''}`))
      .join('');
  }

  function consumptionBadge(media) {
    return media === null
      ? UI.badge(ORIGEM_CONSUMO, 'muted')
      : UI.badge(`${String(media).replace('.', ',')} km/l`, 'ok');
  }

  function list(main, params, ctx) {
    const today = Utils.todayIso();
    const monthStart = `${today.slice(0, 8)}01`;
    main.innerHTML = `
      ${pageHeader('Abastecimentos', 'Registros de combustível, gastos e consumo médio por veículo.',
        `<a class="btn btn-primary" href="#/combustivel/novo">Novo abastecimento</a>`)}
      <section class="kpi-grid" id="fuel-kpis"></section>
      <section class="card">
        <h2>Filtros</h2>
        <div class="filter-bar">
          <label class="field">De<input type="date" id="fuel-from" value="${monthStart}"></label>
          <label class="field">Até<input type="date" id="fuel-to" value="${today}"></label>
          <label class="field">Veículo<select id="fuel-veiculo"><option value="Todos">Todos</option>${vehicleFilterOptions(ctx.state)}</select></label>
          <div class="field field-action">
            <button type="button" class="btn btn-ghost" id="fuel-clear">Limpar filtros</button>
          </div>
        </div>
      </section>
      <section class="card">
        <h2>Abastecimentos registrados</h2>
        <div id="fuel-list"></div>
      </section>
      <section class="card">
        <h2>Consumo médio por veículo</h2>
        <p class="muted small">Método de tanque cheio: entre dois abastecimentos marcados como tanque cheio, a distância percorrida é dividida pelos litros abastecidos no intervalo. Sem dois tanques cheios válidos, não há média.</p>
        <div id="fuel-consumption"></div>
      </section>`;

    const filters = () => ({
      from: main.querySelector('#fuel-from').value,
      to: main.querySelector('#fuel-to').value,
      veiculoId: main.querySelector('#fuel-veiculo').value,
    });

    const render = () => {
      const f = filters();
      const resumo = Fuel.summary(ctx.state, f);
      const rows = Fuel.list(ctx.state, f);
      main.querySelector('#fuel-kpis').innerHTML = [
        kpi('Abastecimentos', resumo.registros),
        kpi('Litros', Utils.formatQuantity(resumo.litros)),
        kpi('Gasto total', money(resumo.valor)),
        kpi('Preço médio por litro', resumo.precoMedio === null ? '—' : money(resumo.precoMedio)),
      ].join('');

      main.querySelector('#fuel-list').innerHTML = table(
        [{ label: 'Data e hora' }, { label: 'Veículo' }, { label: 'Km', align: 'right' }, { label: 'Litros', align: 'right' },
          { label: 'Preço/litro', align: 'right' }, { label: 'Valor total', align: 'right' }, { label: 'Posto' },
          { label: 'Responsável' }, { label: 'Tanque' }, { label: '' }],
        rows.map(r => [
          Utils.formatDateTime(r.dataHora),
          esc(r.veiculoPlaca),
          Utils.formatKm(r.quilometragem),
          Utils.formatQuantity(r.litros),
          money(r.precoLitro),
          money(r.valorTotal),
          esc(r.posto),
          esc(r.responsavel),
          r.tanqueCheio ? UI.badge('Cheio', 'ok') : UI.badge('Parcial', 'muted'),
          `<a class="link" href="#/combustivel/${esc(r.id)}/editar">Editar</a>`,
        ]),
        'Nenhum abastecimento no período selecionado.',
      );

      const veiculos = f.veiculoId === 'Todos' ? ctx.state.veiculos : ctx.state.veiculos.filter(v => v.id === f.veiculoId);
      main.querySelector('#fuel-consumption').innerHTML = table(
        [{ label: 'Veículo' }, { label: 'Km atual', align: 'right' }, { label: 'Abastecimentos', align: 'right' },
          { label: 'Litros', align: 'right' }, { label: 'Gasto', align: 'right' }, { label: 'Consumo médio' }],
        veiculos.map(v => {
          const consumo = Fuel.consumption(ctx.state, v.id);
          const total = Fuel.summary(ctx.state, { veiculoId: v.id, from: f.from, to: f.to });
          return [
            `${esc(v.placa)} – ${esc(v.marca)}`,
            Utils.formatKm(Vehicles.currentKm(ctx.state, v.id)),
            String(total.registros),
            Utils.formatQuantity(total.litros),
            money(total.valor),
            consumptionBadge(consumo.media),
          ];
        }),
        'Nenhum veículo para exibir.',
      );
    };

    main.querySelector('#fuel-from').addEventListener('change', render);
    main.querySelector('#fuel-to').addEventListener('change', render);
    main.querySelector('#fuel-veiculo').addEventListener('change', render);
    main.querySelector('#fuel-clear').addEventListener('click', () => {
      main.querySelector('#fuel-from').value = monthStart;
      main.querySelector('#fuel-to').value = today;
      main.querySelector('#fuel-veiculo').value = 'Todos';
      render();
    });
    render();
  }

  function form(main, params, ctx) {
    const editing = params.id ? Fuel.find(ctx.state, params.id) : null;
    if (params.id && !editing) {
      main.innerHTML = `${pageHeader('Abastecimento não encontrado')}<p><a class="link" href="#/combustivel">Voltar aos abastecimentos</a></p>`;
      return;
    }
    const current = editing || {
      veiculoId: '', dataHora: Utils.nowIso(), quilometragem: '', litros: '',
      valorTotal: '', precoLitro: '', posto: '', responsavel: '', observacao: '', tanqueCheio: true,
    };
    const kmAtual = current.veiculoId ? Vehicles.currentKm(ctx.state, current.veiculoId) : null;

    main.innerHTML = `
      ${pageHeader(editing ? 'Editar abastecimento' : 'Novo abastecimento',
        'Informe o valor total pago ou o preço por litro. Se informar os dois, o sistema confere a consistência.')}
      <form class="card form-grid" id="fuel-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field">Veículo
          <select name="veiculoId" required><option value="">Selecione…</option>${vehicleOptions(ctx.state, current.veiculoId)}</select>
        </label>
        <label class="field">Data e hora<input name="dataHora" type="datetime-local" required value="${esc(current.dataHora)}"></label>
        <label class="field">Quilometragem (km)
          <input name="quilometragem" type="number" min="0" step="1" inputmode="numeric" required value="${esc(current.quilometragem)}">
          <span class="hint" data-km-hint></span>
        </label>
        <label class="field">Litros abastecidos<input name="litros" inputmode="decimal" required value="${esc(decimalInput(current.litros))}" placeholder="Ex.: 180,5"></label>
        <label class="field">Valor total pago (R$)<input name="valorTotal" inputmode="decimal" value="${esc(current.valorTotal === '' ? '' : String(current.valorTotal).replace('.', ','))}" placeholder="0,00"></label>
        <label class="field">Preço por litro (R$)<input name="precoLitro" inputmode="decimal" value="${esc(current.precoLitro === '' ? '' : String(current.precoLitro).replace('.', ','))}" placeholder="0,000"></label>
        <label class="field">Posto ou fornecedor<input name="posto" required value="${esc(current.posto)}"></label>
        <label class="field">Responsável pelo registro<input name="responsavel" required value="${esc(current.responsavel)}"></label>
        <label class="field full">Observação<input name="observacao" value="${esc(current.observacao)}" placeholder="Opcional"></label>
        <label class="field checkbox full"><input type="checkbox" name="tanqueCheio" ${current.tanqueCheio ? 'checked' : ''}> Tanque cheio (necessário para o cálculo do consumo)</label>
        <p class="hint full" data-price-hint></p>
        <div class="form-actions full">
          <a class="btn btn-ghost" href="#/combustivel">Cancelar</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Salvar correção' : 'Registrar abastecimento'}</button>
        </div>
      </form>`;

    const formEl = main.querySelector('#fuel-form');
    const kmHint = formEl.querySelector('[data-km-hint]');
    const priceHint = formEl.querySelector('[data-price-hint]');
    const litros = formEl.querySelector('[name="litros"]');
    const valorTotal = formEl.querySelector('[name="valorTotal"]');
    const precoLitro = formEl.querySelector('[name="precoLitro"]');
    const veiculo = formEl.querySelector('[name="veiculoId"]');

    const updateKmHint = () => {
      const km = Vehicles.currentKm(ctx.state, veiculo.value);
      kmHint.textContent = km === null
        ? 'Sem quilometragem anterior registrada para este veículo.'
        : `Última quilometragem registrada: ${Utils.formatKm(km)}.`;
    };
    const updatePriceHint = () => {
      const l = Utils.parseDecimal(litros.value);
      const v = Utils.parseMoney(valorTotal.value);
      const p = Utils.parseDecimal(precoLitro.value);
      if (l > 0 && v > 0 && p > 0) {
        const esperado = l * p;
        priceHint.textContent = Math.abs(esperado - v) <= Fuel.TOLERANCIA_VALOR
          ? `Valores coerentes: ${Utils.formatQuantity(l)} L × ${money(p)} = ${money(esperado)}.`
          : `Atenção: ${Utils.formatQuantity(l)} L × ${money(p)} = ${money(esperado)}, diferente do valor total informado (${money(v)}).`;
        return;
      }
      if (l > 0 && v > 0) priceHint.textContent = `Preço por litro calculado: ${money(v / l)}.`;
      else if (l > 0 && p > 0) priceHint.textContent = `Valor total calculado: ${money(l * p)}.`;
      else priceHint.textContent = 'Informe os litros e pelo menos um dos valores (total ou preço por litro).';
    };
    veiculo.addEventListener('change', updateKmHint);
    litros.addEventListener('input', updatePriceHint);
    valorTotal.addEventListener('input', updatePriceHint);
    precoLitro.addEventListener('input', updatePriceHint);
    updateKmHint();
    updatePriceHint();

    formEl.addEventListener('submit', event => {
      event.preventDefault();
      const data = readForm(formEl);
      const result = editing ? Fuel.update(ctx.state, editing.id, data) : Fuel.create(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save();
      ctx.toast(editing ? 'Abastecimento corrigido.' : 'Abastecimento registrado.');
      ctx.go('#/combustivel');
    });
  }

  return { list, form };
})();
