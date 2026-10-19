/*
 * Regras de manutenção.
 * Fluxo: Aberta -> Em andamento -> Concluída (ou Aberta -> Concluída).
 * Peças e despesas só podem ser registradas enquanto a manutenção estiver aberta.
 * Peças do almoxarifado e externas são registradas uma única vez e apenas referenciadas aqui.
 */
const Maintenance = (function () {
  const STATUS = ['Aberta', 'Em andamento', 'Concluída'];

  function find(state, id) {
    return state.manutencoes.find(m => m.id === id) || null;
  }

  function isOpen(maintenance) {
    return maintenance.status === 'Aberta' || maintenance.status === 'Em andamento';
  }

  function hasOpen(state, veiculoId) {
    return state.manutencoes.some(m => m.veiculoId === veiculoId && isOpen(m));
  }

  function event(texto, data = Utils.nowIso()) {
    return { data, texto };
  }

  function open(state, data) {
    const errors = [];
    const veiculo = Vehicles.find(state, data.veiculoId);
    const descricaoProblema = Utils.normalizeText(data.descricaoProblema);
    const responsavel = Utils.normalizeText(data.responsavel);
    const dataEntrada = data.dataEntrada;

    if (!veiculo) errors.push('Selecione o veículo.');
    else if (!Vehicles.isActive(veiculo)) errors.push('Veículo inativo não pode receber nova manutenção.');
    if (!Utils.isValidDateTime(dataEntrada)) errors.push('Informe a data e a hora de entrada.');
    if (!descricaoProblema) errors.push('Descreva o problema informado.');
    if (!responsavel) errors.push('Informe o responsável pelo registro.');
    if (errors.length) return { ok: false, errors };

    const maintenance = {
      id: Utils.nextId('MNT', state.manutencoes, 4),
      veiculoId: veiculo.id,
      dataEntrada,
      dataConclusao: null,
      status: 'Aberta',
      descricaoProblema,
      observacoes: Utils.normalizeText(data.observacoes),
      responsavel,
      historico: [event(`Manutenção aberta por ${responsavel}.`, dataEntrada)],
    };
    state.manutencoes.push(maintenance);
    return { ok: true, value: maintenance };
  }

  function start(state, id) {
    const maintenance = find(state, id);
    if (!maintenance) return { ok: false, errors: ['Manutenção não encontrada.'] };
    if (maintenance.status !== 'Aberta') return { ok: false, errors: ['Somente manutenções abertas podem ser iniciadas.'] };
    maintenance.status = 'Em andamento';
    maintenance.historico.push(event('Manutenção iniciada.'));
    return { ok: true, value: maintenance };
  }

  function conclude(state, id, data) {
    const maintenance = find(state, id);
    if (!maintenance) return { ok: false, errors: ['Manutenção não encontrada.'] };
    if (!isOpen(maintenance)) return { ok: false, errors: ['Esta manutenção já foi concluída.'] };
    if (!Utils.isValidDateTime(data.dataConclusao)) return { ok: false, errors: ['Informe a data e a hora de conclusão.'] };
    if (data.dataConclusao < maintenance.dataEntrada) {
      return { ok: false, errors: ['A conclusão não pode ser anterior à data de entrada.'] };
    }
    maintenance.status = 'Concluída';
    maintenance.dataConclusao = data.dataConclusao;
    maintenance.historico.push(event('Manutenção concluída.'));
    return { ok: true, value: maintenance };
  }

  function requireOpen(state, manutencaoId) {
    const maintenance = find(state, manutencaoId);
    if (!maintenance) return { ok: false, errors: ['Manutenção não encontrada.'] };
    if (!isOpen(maintenance)) return { ok: false, errors: ['Esta manutenção não está aberta; não é possível registrar novos itens.'] };
    return { ok: true, value: maintenance };
  }

  function registerWithdrawal(state, manutencaoId, data) {
    const check = requireOpen(state, manutencaoId);
    if (!check.ok) return check;
    const result = Warehouse.registerWithdrawal(state, {
      ...data,
      veiculoId: check.value.veiculoId,
      manutencaoId,
    });
    if (!result.ok) return result;
    const part = Warehouse.findPart(state, result.value.pecaId);
    check.value.historico.push(event(`Peça retirada do almoxarifado: ${part.descricao} (${result.value.quantidade} un.).`));
    return result;
  }

  function registerExternalPart(state, manutencaoId, data) {
    const check = requireOpen(state, manutencaoId);
    if (!check.ok) return check;
    const result = Warehouse.registerExternalPart(state, {
      ...data,
      veiculoId: check.value.veiculoId,
      manutencaoId,
    });
    if (!result.ok) return result;
    check.value.historico.push(event(`Peça externa registrada: ${result.value.descricao} (${result.value.quantidade} un.).`));
    return result;
  }

  function registerExpense(state, manutencaoId, data) {
    const check = requireOpen(state, manutencaoId);
    if (!check.ok) return check;
    const errors = [];
    const descricao = Utils.normalizeText(data.descricao);
    const valor = Utils.parseMoney(data.valor);
    if (!descricao) errors.push('Informe a descrição da despesa.');
    if (!Number.isFinite(valor)) errors.push('Informe um valor válido (zero ou maior).');
    if (!Utils.isValidDate(data.data)) errors.push('Informe uma data válida.');
    if (errors.length) return { ok: false, errors };

    const expense = {
      id: Utils.nextId('DES', state.despesas, 3),
      manutencaoId,
      descricao,
      valor,
      data: data.data,
    };
    state.despesas.push(expense);
    check.value.historico.push(event(`Despesa registrada: ${descricao} (${Utils.formatMoney(valor)}).`));
    return { ok: true, value: expense };
  }

  /* filtros: { veiculoId, status, from, to } — período aplicado sobre a data de entrada */
  function list(state, filters = {}) {
    return state.manutencoes
      .filter(m => !filters.veiculoId || filters.veiculoId === 'Todos' || m.veiculoId === filters.veiculoId)
      .filter(m => !filters.status || filters.status === 'Todos' || m.status === filters.status)
      .filter(m => Utils.inPeriod(m.dataEntrada, filters.from, filters.to))
      .sort((a, b) => b.dataEntrada.localeCompare(a.dataEntrada));
  }

  return {
    STATUS, find, isOpen, hasOpen, open, start, conclude,
    registerWithdrawal, registerExternalPart, registerExpense, list,
  };
})();
