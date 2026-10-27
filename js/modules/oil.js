/*
 * Telas de troca de óleo (dentro do módulo Manutenção).
 * A lista mostra próximos limites e situação; o formulário permite informar os intervalos
 * (sem intervalo universal) e, opcionalmente, usar óleo do almoxarifado.
 */
const OilScreens = (function () {
  const { esc, kpi, pageHeader, table, option, readForm } = UI;

  const TONE = {
    'Em dia': 'ok',
    'Próxima da troca': 'warn',
    'Vencida por quilometragem': 'danger',
    'Vencida por tempo': 'danger',
    'Vencida por ambos': 'danger',
    'Pendente de dados': 'muted',
  };

  function money(value) {
    return Utils.formatMoney(value);
  }

  function situacaoBadge(situacao) {
    return UI.badge(situacao, TONE[situacao] || 'muted');
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

  function maintenanceOptions(state, selectedId) {
    return state.manutencoes
      .filter(m => Maintenance.isOpen(m) || m.id === selectedId)
      .map(m => {
        const vehicle = Vehicles.find(state, m.veiculoId);
        return `<option value="${esc(m.id)}" data-veiculo="${esc(m.veiculoId)}"${m.id === selectedId ? ' selected' : ''}>${esc(m.id)} – ${esc(vehicle ? vehicle.placa : m.veiculoId)} (${esc(m.status)})</option>`;
      })
      .join('');
  }

  function list(main, params, ctx) {
    main.innerHTML = `
      ${pageHeader('Trocas de óleo', 'Controle por quilometragem e por tempo. Os intervalos são informados em cada troca — não existe intervalo universal.',
        `<a class="btn btn-primary" href="#/manutencao/oleo/nova">Nova troca</a>`)}
      <section class="kpi-grid" id="oil-kpis"></section>
      <section class="card">
        <div class="filter-bar">
          <label class="field">Veículo<select id="oil-veiculo"><option value="Todos">Todos</option>${ctx.state.veiculos.map(v => option(v.id, v.placa)).join('')}</select></label>
          <label class="field">Situação<select id="oil-situacao"><option value="Todas">Todas</option>${Oil.SITUACOES.map(s => option(s, s)).join('')}</select></label>
        </div>
        <div id="oil-list"></div>
      </section>
      <section class="card">
        <h2>Situação por veículo (última troca)</h2>
        <div id="oil-status"></div>
      </section>`;

    const render = () => {
      const veiculoId = main.querySelector('#oil-veiculo').value;
      const situacao = main.querySelector('#oil-situacao').value;
      const resumo = Oil.summary(ctx.state);
      main.querySelector('#oil-kpis').innerHTML = [
        kpi('Trocas registradas', resumo.total),
        kpi('Em dia', resumo.porSituacao['Em dia'] || 0),
        kpi('Próximas da troca', resumo.proximas, `Alerta com ${Oil.configuracoes(ctx.state).alertaTrocaOleoKm} km ou ${Oil.configuracoes(ctx.state).alertaTrocaOleoDias} dias de antecedência`),
        kpi('Vencidas', resumo.vencidas),
        kpi('Custo total', money(resumo.custoTotal)),
      ].join('');

      const rows = Oil.list(ctx.state, { veiculoId, situacao });
      main.querySelector('#oil-list').innerHTML = table(
        [{ label: 'Data' }, { label: 'Veículo' }, { label: 'Km da troca', align: 'right' }, { label: 'Óleo' },
          { label: 'Litros', align: 'right' }, { label: 'Próxima (km)', align: 'right' }, { label: 'Próxima (data)' },
          { label: 'Situação' }, { label: 'Custo', align: 'right' }, { label: '' }],
        rows.map(r => [
          Utils.formatDate(r.data),
          esc(r.veiculoPlaca),
          Utils.formatKm(r.quilometragem),
          esc(r.especificacao),
          Utils.formatQuantity(r.quantidade),
          r.limiteKm === null ? '—' : Utils.formatKm(r.limiteKm),
          r.limiteData === null ? '—' : Utils.formatDate(r.limiteData),
          situacaoBadge(r.situacao),
          money(r.custoTotal),
          r.movimentacaoId ? UI.badge('Retirada do estoque', 'info') : `<a class="link" href="#/manutencao/oleo/${esc(r.id)}/editar">Editar</a>`,
        ]),
        'Nenhuma troca de óleo para o filtro informado.',
      );

      main.querySelector('#oil-status').innerHTML = table(
        [{ label: 'Veículo' }, { label: 'Km atual', align: 'right' }, { label: 'Última troca' }, { label: 'Próxima (km)', align: 'right' },
          { label: 'Próxima (data)' }, { label: 'Km restante', align: 'right' }, { label: 'Dias restantes', align: 'right' }, { label: 'Situação' }],
        Oil.statusByVehicle(ctx.state)
          .filter(v => veiculoId === 'Todos' || v.veiculoId === veiculoId)
          .map(v => [
            esc(v.placa),
            Utils.formatKm(v.kmAtual),
            v.ultimaTroca ? `${Utils.formatDate(v.ultimaTroca.data)} · ${Utils.formatKm(v.ultimaTroca.quilometragem)}` : 'Sem troca registrada',
            v.limiteKm === null ? '—' : Utils.formatKm(v.limiteKm),
            v.limiteData === null ? '—' : Utils.formatDate(v.limiteData),
            v.kmRestante === null ? '—' : Utils.formatKm(v.kmRestante),
            v.diasRestantes === null ? '—' : `${v.diasRestantes} dia(s)`,
            situacaoBadge(v.situacao),
          ]),
        'Nenhum veículo para exibir.',
      );
    };

    main.querySelector('#oil-veiculo').addEventListener('change', render);
    main.querySelector('#oil-situacao').addEventListener('change', render);
    render();
  }

  function form(main, params, ctx) {
    const editing = params.id ? Oil.find(ctx.state, params.id) : null;
    if (params.id && !editing) {
      main.innerHTML = `${pageHeader('Troca de óleo não encontrada')}<p><a class="link" href="#/manutencao/oleo">Voltar às trocas de óleo</a></p>`;
      return;
    }
    if (editing && editing.movimentacaoId) {
      main.innerHTML = `${pageHeader('Troca registrada com óleo do estoque')}
        <section class="card">
          <p>Esta troca usou óleo do almoxarifado e está ligada à retirada <strong>${esc(editing.movimentacaoId)}</strong>.</p>
          <p class="muted">Para manter a consistência dos custos, o valor é o da retirada. Corrija a retirada de estoque em Almoxarifado → Retiradas.</p>
          <a class="btn btn-ghost" href="#/manutencao/oleo">Voltar</a>
        </section>`;
      return;
    }

    const current = editing || {
      veiculoId: '', data: Utils.todayIso(), quilometragem: '', especificacao: '', quantidade: '',
      valorUnitario: '', responsavel: '', observacao: '', intervaloKm: '', intervaloMeses: '',
      manutencaoId: '', pecaId: '',
    };
    const conf = Oil.configuracoes(ctx.state);

    main.innerHTML = `
      ${pageHeader(editing ? 'Editar troca de óleo' : 'Nova troca de óleo',
        `Alerta configurado: ${conf.alertaTrocaOleoKm} km ou ${conf.alertaTrocaOleoDias} dias de antecedência (Administrador → Parâmetros).`)}
      <form class="card form-grid" id="oil-form" novalidate>
        <div class="form-errors full" id="form-errors"></div>
        <label class="field">Veículo
          <select name="veiculoId" required><option value="">Selecione…</option>${vehicleOptions(ctx.state, current.veiculoId)}</select>
          <span class="hint" data-km-hint></span>
        </label>
        <label class="field">Data da troca<input name="data" type="date" required value="${esc(current.data)}"></label>
        <label class="field">Quilometragem da troca (km)<input name="quilometragem" type="number" min="0" step="1" inputmode="numeric" required value="${esc(current.quilometragem)}"></label>
        <label class="field">Especificação do óleo<input name="especificacao" required value="${esc(current.especificacao)}" placeholder="Ex.: 15W40 mineral"></label>
        <label class="field">Quantidade (litros)<input name="quantidade" inputmode="decimal" required value="${esc(current.quantidade)}" placeholder="Ex.: 28"></label>
        <label class="field">Valor unitário (R$/litro)<input name="valorUnitario" inputmode="decimal" value="${esc(current.valorUnitario)}" placeholder="0,00"></label>
        <label class="field">Intervalo em quilômetros<input name="intervaloKm" type="number" min="0" step="1" inputmode="numeric" value="${esc(current.intervaloKm)}" placeholder="Ex.: 10000"></label>
        <label class="field">Intervalo em meses<input name="intervaloMeses" type="number" min="0" step="1" inputmode="numeric" value="${esc(current.intervaloMeses)}" placeholder="Ex.: 6"></label>
        <label class="field">Manutenção vinculada (opcional)
          <select name="manutencaoId"><option value="">Sem vínculo</option>${maintenanceOptions(ctx.state, current.manutencaoId)}</select>
        </label>
        <label class="field">Óleo do almoxarifado (opcional)
          <select name="pecaId"><option value="">Não usar estoque</option>${partOptions(ctx.state, current.pecaId)}</select>
          <span class="hint" data-part-hint></span>
        </label>
        <label class="field">Responsável pela troca<input name="responsavel" required value="${esc(current.responsavel)}"></label>
        <label class="field full">Observação<input name="observacao" value="${esc(current.observacao)}" placeholder="Opcional"></label>
        <p class="hint full">Se o óleo vier do almoxarifado, o custo é o da retirada de estoque (não é somado duas vezes) e a quantidade deve ser um número inteiro de litros.</p>
        <div class="form-actions full">
          <a class="btn btn-ghost" href="#/manutencao/oleo">Cancelar</a>
          <button class="btn btn-primary" type="submit">${editing ? 'Salvar alterações' : 'Registrar troca'}</button>
        </div>
      </form>`;

    const formEl = main.querySelector('#oil-form');
    const veiculo = formEl.querySelector('[name="veiculoId"]');
    const manutencao = formEl.querySelector('[name="manutencaoId"]');
    const peca = formEl.querySelector('[name="pecaId"]');
    const valorUnitario = formEl.querySelector('[name="valorUnitario"]');
    const kmHint = formEl.querySelector('[data-km-hint]');
    const partHint = formEl.querySelector('[data-part-hint]');

    const updateKmHint = () => {
      const km = Vehicles.currentKm(ctx.state, veiculo.value);
      kmHint.textContent = km === null
        ? 'Sem quilometragem anterior registrada para este veículo.'
        : `Última quilometragem registrada: ${Utils.formatKm(km)}.`;
    };
    const updateMaintenanceFilter = () => {
      manutencao.querySelectorAll('option[data-veiculo]').forEach(opt => {
        opt.hidden = opt.dataset.veiculo !== veiculo.value;
      });
      if (manutencao.selectedOptions[0] && manutencao.selectedOptions[0].hidden) manutencao.value = '';
    };
    const updatePartHint = () => {
      const part = Warehouse.findPart(ctx.state, peca.value);
      if (!part) {
        partHint.textContent = 'Sem retirada de estoque: o custo será quantidade × valor unitário.';
        valorUnitario.readOnly = false;
        return;
      }
      partHint.textContent = `Saldo ${Warehouse.balance(ctx.state, part.id)} L · valor unitário ${money(part.valorUnitario)} (o custo passa a ser o da retirada).`;
      valorUnitario.value = String(part.valorUnitario).replace('.', ',');
      valorUnitario.readOnly = true;
    };

    veiculo.addEventListener('change', () => { updateKmHint(); updateMaintenanceFilter(); });
    peca.addEventListener('change', updatePartHint);
    updateKmHint();
    updateMaintenanceFilter();
    updatePartHint();

    formEl.addEventListener('submit', event => {
      event.preventDefault();
      const data = readForm(formEl);
      const result = editing ? Oil.update(ctx.state, editing.id, data) : Oil.create(ctx.state, data);
      if (!result.ok) {
        UI.showErrors(main.querySelector('#form-errors'), result.errors);
        return;
      }
      ctx.save().then(ok => {
        if (!ok) return;
        ctx.toast(editing ? 'Troca de óleo atualizada.' : 'Troca de óleo registrada.');
        ctx.go('#/manutencao/oleo');
      });
    });
  }

  return { list, form, situacaoBadge };
})();
