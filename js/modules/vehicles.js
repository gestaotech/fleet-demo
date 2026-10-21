/* Telas do módulo Veículos: lista, cadastro/edição e relatório individual de cada veículo. */
const VehicleScreens = (function () {
  const { esc, kpi, pageHeader, table, option, readForm, situacaoBadge, operacionalBadge, manutencaoBadge } = UI;

  function list(main, params, ctx) {
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
        </div>
        <div id="v-table"></div>
      </section>`;

    const render = () => {
      const filtered = Vehicles.filter(ctx.state, {
        termo: main.querySelector('#v-term').value,
        situacao: main.querySelector('#v-situacao').value,
        operacional: main.querySelector('#v-operacional').value,
      });
      main.querySelector('#v-table').innerHTML = table(
        [{ label: 'Placa' }, { label: 'Marca / modelo' }, { label: 'Identificação' }, { label: 'Entrada na frota' },
          { label: 'Cadastro' }, { label: 'Operacional' }, { label: '' }],
        filtered.map(v => [
          `<strong>${esc(v.placa)}</strong>`,
          esc(v.marca),
          esc(v.identificacao),
          Utils.formatDate(v.dataEntrada),
          situacaoBadge(v.situacao),
          operacionalBadge(Vehicles.operationalStatus(ctx.state, v.id)),
          `<div class="row-actions"><a class="link" href="#/veiculos/${esc(v.id)}">Detalhes</a><a class="link" href="#/veiculos/${esc(v.id)}/editar">Editar</a></div>`,
        ]),
        'Nenhum veículo corresponde ao filtro.',
      );
    };
    ['#v-term', '#v-situacao', '#v-operacional'].forEach(sel => {
      main.querySelector(sel).addEventListener(sel === '#v-term' ? 'input' : 'change', render);
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
      ctx.save();
      ctx.toast(editing ? 'Veículo atualizado.' : 'Veículo cadastrado.');
      ctx.go(`#/veiculos/${result.value.id}`);
    });
  }

  function detail(main, params, ctx) {
    const vehicle = Vehicles.find(ctx.state, params.id);
    if (!vehicle) {
      main.innerHTML = `${pageHeader('Veículo não encontrado')}<p><a class="link" href="#/veiculos">Voltar à lista</a></p>`;
      return;
    }
    const operacional = Vehicles.operationalStatus(ctx.state, vehicle.id);
    const costs = Costs.vehicleCosts(ctx.state, vehicle.id);
    const maintenances = ctx.state.manutencoes.filter(m => m.veiculoId === vehicle.id).sort((a, b) => b.dataEntrada.localeCompare(a.dataEntrada));
    const openMaintenances = maintenances.filter(Maintenance.isOpen);
    const kmAtual = Vehicles.currentKm(ctx.state, vehicle.id);
    const kmOrigem = Vehicles.currentKmSource(ctx.state, vehicle.id);
    const ultimaTroca = Oil.lastChange(ctx.state, vehicle.id);
    const oleoInfo = ultimaTroca ? Oil.status(ctx.state, ultimaTroca) : null;
    const abastecimentos = Fuel.list(ctx.state, { veiculoId: vehicle.id });
    const consumo = Fuel.consumption(ctx.state, vehicle.id);
    const trocas = Oil.list(ctx.state, { veiculoId: vehicle.id });

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
      <section class="kpi-grid">
        ${kpi('Peças do almoxarifado', Utils.formatMoney(costs.pecasAlmoxarifado))}
        ${kpi('Peças externas', Utils.formatMoney(costs.pecasExternas))}
        ${kpi('Outras despesas', Utils.formatMoney(costs.outrasDespesas))}
        ${kpi('Trocas de óleo', Utils.formatMoney(costs.trocasOleoProprias))}
        ${kpi('Total de manutenção', Utils.formatMoney(costs.total))}
        ${kpi('Combustível', Utils.formatMoney(costs.combustivel.total), `${Utils.formatQuantity(costs.combustivel.litros)} litros`)}
        ${kpi('Consumo médio', consumo.media === null ? 'Sem dados' : `${String(consumo.media).replace('.', ',')} km/l`, consumo.suficiente ? 'Método de tanque cheio' : 'Dados insuficientes para calcular')}
        ${kpi('Total geral', Utils.formatMoney(costs.totalGeral), 'Manutenção + combustível')}
      </section>
      <section class="card">
        <h2>Histórico de manutenções</h2>
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
        <h2>Peças retiradas do almoxarifado</h2>
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
        <h2>Peças adquiridas fora do almoxarifado</h2>
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
        <h2>Outras despesas de manutenção</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Descrição' }, { label: 'Manutenção' }, { label: 'Valor', align: 'right' }],
          costs.despesas.map(d => [Utils.formatDate(d.data), esc(d.descricao), esc(d.manutencaoId), Utils.formatMoney(d.valor)]),
          'Nenhuma despesa registrada.',
        )}
        <p class="totals">Total de manutenção: <strong>${Utils.formatMoney(costs.total)}</strong> · Combustível: <strong>${Utils.formatMoney(costs.combustivel.total)}</strong> · Total geral: <strong>${Utils.formatMoney(costs.totalGeral)}</strong>. Cada item é contado uma única vez.</p>
      </section>
      <section class="card">
        <h2>Abastecimentos</h2>
        ${table(
          [{ label: 'Data e hora' }, { label: 'Km', align: 'right' }, { label: 'Litros', align: 'right' }, { label: 'Preço/litro', align: 'right' },
            { label: 'Valor total', align: 'right' }, { label: 'Posto' }, { label: 'Responsável' }, { label: 'Tanque' }],
          abastecimentos.map(a => [
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
        <h2>Trocas de óleo</h2>
        ${table(
          [{ label: 'Data' }, { label: 'Km', align: 'right' }, { label: 'Óleo' }, { label: 'Litros', align: 'right' },
            { label: 'Intervalo km', align: 'right' }, { label: 'Intervalo meses', align: 'right' }, { label: 'Próxima (km)', align: 'right' },
            { label: 'Próxima (data)' }, { label: 'Situação' }, { label: 'Custo', align: 'right' }],
          trocas.map(t => [
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
  }

  return { list, form, detail };
})();
