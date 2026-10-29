/*
 * Regras de troca de óleo.
 *
 * Intervalos: NÃO existe intervalo universal. O intervalo em quilômetros e em meses é
 * informado em cada troca (ou fica pendente de configuração). O sistema apenas projeta os
 * próximos limites e classifica a situação.
 *
 * Situações possíveis:
 *   - 'Em dia'
 *   - 'Próxima da troca' (dentro da antecedência configurada, em km ou em dias)
 *   - 'Vencida por quilometragem'
 *   - 'Vencida por tempo'
 *   - 'Vencida por ambos'
 *   - 'Pendente de dados' (sem quilometragem da troca, sem intervalos ou sem km atual)
 *
 * Custo: quando a troca usa óleo do almoxarifado, o custo vem da movimentação de retirada
 * (movimentacaoId) e a troca não soma custo próprio — assim não há contagem duplicada.
 */
const Oil = (function () {
  const SITUACOES = [
    'Em dia',
    'Próxima da troca',
    'Vencida por quilometragem',
    'Vencida por tempo',
    'Vencida por ambos',
    'Pendente de dados',
  ];

  function find(state, id) {
    return state.trocasOleo.find(t => t.id === id) || null;
  }

  function recordsOf(state, veiculoId) {
    return state.trocasOleo
      .filter(t => t.veiculoId === veiculoId)
      .slice()
      .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  }

  /* Última troca registrada para o veículo (a mais recente por data). */
  function lastChange(state, veiculoId) {
    return recordsOf(state, veiculoId)[0] || null;
  }

  function defaultConfiguracoes() {
    return { alertaTrocaOleoKm: 1000, alertaTrocaOleoDias: 30 };
  }

  function configuracoes(state) {
    const defaults = defaultConfiguracoes();
    const atual = state.configuracoes || {};
    const km = Number(atual.alertaTrocaOleoKm);
    const dias = Number(atual.alertaTrocaOleoDias);
    return {
      alertaTrocaOleoKm: Number.isFinite(km) && km >= 0 ? km : defaults.alertaTrocaOleoKm,
      alertaTrocaOleoDias: Number.isFinite(dias) && dias >= 0 ? dias : defaults.alertaTrocaOleoDias,
    };
  }

  /* Custo próprio da troca (zero quando o óleo veio do almoxarifado). */
  function ownCost(troca) {
    if (troca.movimentacaoId) return 0;
    const quantidade = Number(troca.quantidade);
    const valorUnitario = Number(troca.valorUnitario);
    if (!Number.isFinite(quantidade) || !Number.isFinite(valorUnitario)) return 0;
    return Utils.round2(quantidade * valorUnitario);
  }

  function withdrawalCost(state, troca) {
    if (!troca.movimentacaoId) return 0;
    const movimento = state.movimentacoes.find(m => m.id === troca.movimentacaoId);
    if (!movimento) return 0;
    return Utils.round2(Number(movimento.quantidade) * Number(movimento.valorUnitario));
  }

  /* Custo total da troca, considerando a origem (própria ou retirada do estoque). */
  function totalCost(state, troca) {
    return troca.movimentacaoId ? withdrawalCost(state, troca) : ownCost(troca);
  }

  /*
   * Situação da troca. `options.hoje` permite congelar a data de referência (usado nos testes).
   */
  function status(state, troca, options = {}) {
    const hoje = options.hoje || Utils.todayIso();
    const conf = configuracoes(state);
    const kmTroca = Number.isInteger(troca.quilometragem) ? troca.quilometragem : null;
    const intervaloKm = Number.isInteger(troca.intervaloKm) && troca.intervaloKm > 0 ? troca.intervaloKm : null;
    const intervaloMeses = Number.isInteger(troca.intervaloMeses) && troca.intervaloMeses > 0 ? troca.intervaloMeses : null;

    const limiteKm = kmTroca !== null && intervaloKm !== null ? kmTroca + intervaloKm : null;
    const limiteData = intervaloMeses !== null && Utils.isValidDate(troca.data) ? Utils.addMonths(troca.data, intervaloMeses) : null;

    const kmAtual = Vehicles.currentKm(state, troca.veiculoId);
    const kmRestante = limiteKm !== null && kmAtual !== null ? limiteKm - kmAtual : null;
    const diasRestantes = limiteData !== null ? Utils.daysBetween(hoje, limiteData) : null;

    const vencidaKm = kmRestante !== null && kmRestante <= 0;
    const vencidaTempo = diasRestantes !== null && diasRestantes <= 0;

    let situacao;
    if (vencidaKm && vencidaTempo) situacao = 'Vencida por ambos';
    else if (vencidaKm) situacao = 'Vencida por quilometragem';
    else if (vencidaTempo) situacao = 'Vencida por tempo';
    else if (kmRestante !== null && kmRestante <= conf.alertaTrocaOleoKm) situacao = 'Próxima da troca';
    else if (diasRestantes !== null && diasRestantes <= conf.alertaTrocaOleoDias) situacao = 'Próxima da troca';
    else if (limiteKm === null && limiteData === null) situacao = 'Pendente de dados';
    else if (limiteKm !== null && kmAtual === null) situacao = 'Pendente de dados';
    else situacao = 'Em dia';

    return {
      situacao,
      limiteKm,
      limiteData,
      kmTroca,
      kmAtual,
      kmRestante,
      diasRestantes,
      intervaloKm,
      intervaloMeses,
      avaliavel: limiteKm !== null || limiteData !== null,
    };
  }

  function withdrawalAllowed(state, veiculoId) {
    const veiculo = Vehicles.find(state, veiculoId);
    return Vehicles.isActive(veiculo);
  }

  function validate(state, data, editingId) {
    const errors = [];
    const existing = editingId ? find(state, editingId) : null;
    const veiculo = Vehicles.find(state, data.veiculoId);
    const dataTroca = data.data;
    const quilometragem = Utils.parseInteger(data.quilometragem);
    const especificacao = Utils.normalizeText(data.especificacao);
    const quantidade = Utils.parseDecimal(data.quantidade);
    const valorUnitario = Utils.parseMoney(data.valorUnitario);
    const responsavel = Utils.normalizeText(data.responsavel);
    const intervaloKm = data.intervaloKm === '' || data.intervaloKm === undefined || data.intervaloKm === null
      ? null : Utils.parseInteger(data.intervaloKm);
    const intervaloMeses = data.intervaloMeses === '' || data.intervaloMeses === undefined || data.intervaloMeses === null
      ? null : Utils.parseInteger(data.intervaloMeses);
    const manutencaoId = data.manutencaoId && data.manutencaoId !== 'Nenhuma' ? data.manutencaoId : null;
    const pecaId = data.pecaId && data.pecaId !== 'Nenhuma' ? data.pecaId : null;

    if (!veiculo) errors.push('Selecione o veículo.');
    else if (!Vehicles.isActive(veiculo) && (!existing || existing.veiculoId !== veiculo.id)) {
      errors.push('Veículo inativo não pode receber novas trocas de óleo.');
    }
    if (!Utils.isValidDate(dataTroca)) errors.push('Informe a data da troca de óleo.');
    if (data.quilometragem !== '' && data.quilometragem !== undefined && data.quilometragem !== null) {
      if (!Number.isInteger(quilometragem) || quilometragem < 0) errors.push('A quilometragem da troca deve ser um número inteiro maior ou igual a zero.');
    } else {
      errors.push('Informe a quilometragem da troca de óleo.');
    }
    if (!especificacao) errors.push('Informe a especificação do óleo utilizado.');
    if (!Number.isFinite(quantidade) || quantidade <= 0) errors.push('Informe a quantidade de óleo em litros maior que zero.');
    if (!responsavel) errors.push('Informe o responsável pela troca.');
    if (intervaloKm !== null && (!Number.isInteger(intervaloKm) || intervaloKm <= 0)) errors.push('O intervalo em quilômetros deve ser um número inteiro maior que zero.');
    if (intervaloMeses !== null && (!Number.isInteger(intervaloMeses) || intervaloMeses <= 0)) errors.push('O intervalo em meses deve ser um número inteiro maior que zero.');

    if (pecaId) {
      const peca = state.pecas.find(p => p.id === pecaId);
      if (!peca) errors.push('Peça de óleo não encontrada no almoxarifado.');
      else if (!Number.isInteger(quantidade) || quantidade <= 0) {
        errors.push('Para retirar óleo do almoxarifado, a quantidade deve ser um número inteiro de litros.');
      }
    } else if (data.valorUnitario !== '' && data.valorUnitario !== undefined && data.valorUnitario !== null) {
      if (!Number.isFinite(valorUnitario) || valorUnitario < 0) errors.push('Informe um valor unitário válido (zero ou maior).');
    }

    if (manutencaoId) {
      const manutencao = Maintenance.find(state, manutencaoId);
      if (!manutencao) errors.push('Manutenção vinculada não encontrada.');
      else if (manutencao.veiculoId !== data.veiculoId) errors.push('A manutenção vinculada pertence a outro veículo.');
      else if (pecaId && manutencao.status === 'Concluída') errors.push('Não é possível retirar peça do almoxarifado para uma manutenção concluída.');
    }

    return {
      errors,
      value: {
        veiculoId: data.veiculoId,
        data: dataTroca,
        quilometragem,
        especificacao,
        quantidade,
        valorUnitario: Number.isFinite(valorUnitario) ? valorUnitario : 0,
        responsavel,
        observacao: Utils.normalizeText(data.observacao),
        intervaloKm,
        intervaloMeses,
        manutencaoId,
        pecaId,
      },
    };
  }

  /*
   * Registra uma troca. Quando a peça vem do almoxarifado, cria a retirada vinculada
   * (o custo passa a ser o da movimentação) para não duplicar valores.
   */
  function create(state, data) {
    const checked = validate(state, data, null);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const veiculo = Vehicles.find(state, checked.value.veiculoId);
    let movimentacaoId = null;
    let valorUnitario = checked.value.valorUnitario;

    if (checked.value.pecaId) {
      const peca = state.pecas.find(p => p.id === checked.value.pecaId);
      const retirada = Warehouse.registerWithdrawal(state, {
        pecaId: checked.value.pecaId,
        quantidade: checked.value.quantidade,
        veiculoId: checked.value.veiculoId,
        manutencaoId: checked.value.manutencaoId || null,
        responsavel: checked.value.responsavel,
        data: checked.value.data,
        observacao: `Óleo para troca em ${veiculo ? veiculo.placa : checked.value.veiculoId}`,
      });
      if (!retirada.ok) return { ok: false, errors: retirada.errors };
      movimentacaoId = retirada.value.id;
      valorUnitario = peca.valorUnitario;
    }

    const record = {
      id: Utils.nextId('OLE', state.trocasOleo, 4),
      ...checked.value,
      valorUnitario,
      movimentacaoId,
    };
    state.trocasOleo.push(record);
    return { ok: true, value: record };
  }

  function update(state, id, data) {
    const record = find(state, id);
    if (!record) return { ok: false, errors: ['Troca de óleo não encontrada.'] };
    if (record.movimentacaoId) {
      return { ok: false, errors: ['Esta troca usa óleo do almoxarifado. Altere a retirada de estoque correspondente ou registre uma nova troca.'] };
    }
    const checked = validate(state, data, id);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    Object.assign(record, checked.value, { movimentacaoId: null });
    return { ok: true, value: record };
  }

  /* filtros: { veiculoId, situacao } */
  function list(state, filters = {}, options = {}) {
    return state.trocasOleo
      .filter(t => !filters.veiculoId || filters.veiculoId === 'Todos' || t.veiculoId === filters.veiculoId)
      .map(t => {
        const vehicle = Vehicles.find(state, t.veiculoId);
        const info = status(state, t, options);
        return {
          ...t,
          veiculoPlaca: vehicle ? vehicle.placa : t.veiculoId,
          situacao: info.situacao,
          limiteKm: info.limiteKm,
          limiteData: info.limiteData,
          kmRestante: info.kmRestante,
          custoTotal: totalCost(state, t),
          custoOrigem: t.movimentacaoId ? 'Retirada do estoque' : 'Própria',
        };
      })
      .filter(t => !filters.situacao || filters.situacao === 'Todas' || t.situacao === filters.situacao)
      .sort((a, b) => b.data.localeCompare(a.data) || b.id.localeCompare(a.id));
  }

  /* Situação mais recente por veículo (usada nos cartões e relatórios). */
  function statusByVehicle(state, options = {}) {
    return state.veiculos
      .map(veiculo => {
        const ultima = lastChange(state, veiculo.id);
        const info = ultima ? status(state, ultima, options) : null;
        return {
          veiculoId: veiculo.id,
          placa: veiculo.placa,
          kmAtual: Vehicles.currentKm(state, veiculo.id),
          ultimaTroca: ultima,
          situacao: info ? info.situacao : 'Pendente de dados',
          limiteKm: info ? info.limiteKm : null,
          limiteData: info ? info.limiteData : null,
          kmRestante: info ? info.kmRestante : null,
          diasRestantes: info ? info.diasRestantes : null,
          custoTotal: ultima ? totalCost(state, ultima) : 0,
        };
      });
  }

  function summary(state, options = {}) {
    const rows = list(state, {}, options);
    const porSituacao = {};
    SITUACOES.forEach(s => { porSituacao[s] = 0; });
    rows.forEach(r => { porSituacao[r.situacao] = (porSituacao[r.situacao] || 0) + 1; });
    return {
      total: rows.length,
      custoTotal: Utils.sum(rows, r => r.custoTotal),
      porSituacao,
      pendentes: porSituacao['Pendente de dados'] || 0,
      vencidas: (porSituacao['Vencida por quilometragem'] || 0) + (porSituacao['Vencida por tempo'] || 0) + (porSituacao['Vencida por ambos'] || 0),
      proximas: porSituacao['Próxima da troca'] || 0,
    };
  }

  return {
    SITUACOES, find, recordsOf, lastChange, configuracoes, ownCost, withdrawalCost, totalCost,
    status, validate, create, update, list, statusByVehicle, summary,
  };
})();
