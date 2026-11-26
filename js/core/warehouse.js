/*
 * Regras do almoxarifado.
 * O saldo nunca é digitado: é sempre a soma das movimentações (Entrada - Saida).
 * Cada retirada guarda o valor unitário vigente no momento, para preservar os custos históricos.
 * Validações são feitas antes de qualquer alteração; em caso de erro, nada é gravado.
 */
const Warehouse = (function () {
  function findPart(state, id) {
    return state.pecas.find(p => p.id === id) || null;
  }

  /* Entrada soma; Saida subtrai; Ajuste já traz o sinal (positivo ou negativo) da correção. */
  function variacao(m) {
    if (m.tipo === 'Entrada') return m.quantidade;
    if (m.tipo === 'Saida') return -m.quantidade;
    return m.quantidade;
  }

  function balance(state, pecaId) {
    return Utils.round3(state.movimentacoes.reduce((acc, m) => {
      if (m.pecaId !== pecaId) return acc;
      return acc + variacao(m);
    }, 0));
  }

  function isLowStock(part, saldo) {
    return saldo <= part.estoqueMinimo;
  }

  /* Uma linha por peça com saldo, valor estimado e situação. */
  function situacaoUso(entradas, retiradas) {
    if (retiradas > 0 && entradas > retiradas) return 'Nova e usada';
    if (retiradas > 0) return 'Usada';
    return 'Nova';
  }

  function inventory(state) {
    return state.pecas.map(p => {
      const saldo = balance(state, p.id);
      const entradas = state.movimentacoes.filter(m => m.pecaId === p.id && m.tipo === 'Entrada').reduce((a, m) => a + m.quantidade, 0);
      const retiradas = state.movimentacoes.filter(m => m.pecaId === p.id && m.tipo === 'Saida').reduce((a, m) => a + m.quantidade, 0);
      return {
        ...p,
        saldo,
        entradas,
        retiradas,
        valorEstimado: Utils.round2(saldo * p.valorUnitario),
        baixo: isLowStock(p, saldo),
        situacaoUso: situacaoUso(entradas, retiradas),
      };
    });
  }

  /* filtros: { termo, situacao: 'Todas'|'Baixo'|'Zerado', uso: 'Todos'|'Nova'|'Usada'|'Nova e usada' } */
  function filterInventory(rows, filters = {}) {
    const termo = Utils.searchKey(filters.termo);
    return rows.filter(r => {
      if (termo && !Utils.searchKey(`${r.codigo} ${r.descricao}`).includes(termo)) return false;
      if (filters.situacao === 'Baixo' && !r.baixo) return false;
      if (filters.situacao === 'Zerado' && r.saldo > 0) return false;
      if (filters.uso && filters.uso !== 'Todos' && r.situacaoUso !== filters.uso) return false;
      return true;
    });
  }

  function validatePart(state, data, editingId) {
    const errors = [];
    const codigo = Utils.normalizeText(data.codigo);
    const descricao = Utils.normalizeText(data.descricao);
    const valorUnitario = Utils.parseMoney(data.valorUnitario);
    const estoqueMinimo = Utils.parseInteger(data.estoqueMinimo);
    const dataEntrada = data.dataEntrada;

    if (!codigo) errors.push('Informe o código da peça.');
    else if (state.pecas.some(p => p.id !== editingId && Utils.sameText(p.codigo, codigo))) errors.push('Já existe uma peça com este código.');
    if (!descricao) errors.push('Informe a descrição da peça.');
    if (!Number.isFinite(valorUnitario)) errors.push('Informe um valor unitário válido (zero ou maior).');
    if (!Number.isFinite(estoqueMinimo)) errors.push('Informe o estoque mínimo como número inteiro (zero ou maior).');
    if (!Utils.isValidDate(dataEntrada)) errors.push('Informe uma data de entrada válida.');

    return { errors, value: { codigo, descricao, valorUnitario, estoqueMinimo, dataEntrada, observacao: Utils.normalizeText(data.observacao) } };
  }

  function createPart(state, data) {
    const checked = validatePart(state, data, null);
    const quantidadeInicial = Utils.parseInteger(data.quantidadeInicial ?? 0);
    if (!Number.isFinite(quantidadeInicial)) checked.errors.push('Informe a quantidade inicial como número inteiro (zero ou maior).');
    if (checked.errors.length) return { ok: false, errors: checked.errors };

    const part = { id: Utils.nextId('PEC', state.pecas, 3), ...checked.value };
    state.pecas.push(part);
    if (quantidadeInicial > 0) {
      state.movimentacoes.push({
        id: Utils.nextId('MOV', state.movimentacoes, 3),
        tipo: 'Entrada',
        pecaId: part.id,
        quantidade: quantidadeInicial,
        valorUnitario: part.valorUnitario,
        data: part.dataEntrada,
        veiculoId: null,
        manutencaoId: null,
        responsavel: 'Almoxarifado',
        observacao: 'Estoque inicial no cadastro',
      });
    }
    return { ok: true, value: part };
  }

  /* Alterar cadastro não altera movimentações nem valores já registrados. */
  function updatePart(state, id, data) {
    const part = findPart(state, id);
    if (!part) return { ok: false, errors: ['Peça não encontrada.'] };
    const checked = validatePart(state, data, id);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    Object.assign(part, checked.value);
    return { ok: true, value: part };
  }

  /* Peça com movimentações não é excluída: o saldo e o histórico de custos dependem dela. */
  function deletePart(state, id) {
    const part = findPart(state, id);
    if (!part) return { ok: false, errors: ['Peça não encontrada.'] };
    if (state.movimentacoes.some(m => m.pecaId === id)) {
      return { ok: false, errors: ['Esta peça tem movimentações registradas e não pode ser excluída. Mantenha o cadastro para preservar o histórico.'] };
    }
    state.pecas.splice(state.pecas.indexOf(part), 1);
    return { ok: true, value: part };
  }

  /*
   * Ajuste de saldo (somente administrador; a senha é confirmada no servidor antes de gravar).
   * Não é retirada nem entrada: não tem veículo, não entra em custos e fica no histórico com o motivo.
   */
  function validateAdjustment(state, data) {
    const errors = [];
    const part = findPart(state, data.pecaId);
    const novaQuantidade = Utils.parseQuantidade(data.novaQuantidade);
    const motivo = Utils.normalizeText(data.motivoAjuste);
    let delta = 0;

    if (!part) errors.push('Peça não encontrada para o ajuste.');
    if (!Number.isFinite(novaQuantidade) || novaQuantidade < 0) errors.push('Informe a nova quantidade em estoque (zero ou maior).');
    if (!motivo) errors.push('Informe o motivo do ajuste.');
    if (part && Number.isFinite(novaQuantidade)) {
      delta = Utils.round3(novaQuantidade - balance(state, part.id));
      if (delta === 0) errors.push('A nova quantidade é igual à atual: não há ajuste a registrar.');
    }
    return { errors, value: { part, delta, motivo } };
  }

  function addAdjustment(state, data, responsavel) {
    const checked = validateAdjustment(state, data);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const { part, delta, motivo } = checked.value;
    const movement = {
      id: Utils.nextId('MOV', state.movimentacoes, 3),
      tipo: 'Ajuste',
      pecaId: part.id,
      quantidade: delta,
      valorUnitario: part.valorUnitario,
      data: Utils.todayIso(),
      veiculoId: null,
      manutencaoId: null,
      responsavel: Utils.normalizeText(responsavel),
      observacao: motivo,
    };
    state.movimentacoes.push(movement);
    return { ok: true, value: movement };
  }

  function validateEntry(state, data) {
    const errors = [];
    const part = findPart(state, data.pecaId);
    const quantidade = Utils.parseInteger(data.quantidade);
    const valorUnitario = Utils.parseMoney(data.valorUnitario);
    const responsavel = Utils.normalizeText(data.responsavel);

    if (!part) errors.push('Selecione a peça.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) errors.push('Informe uma quantidade recebida maior que zero.');
    if (!Number.isFinite(valorUnitario)) errors.push('Informe o valor unitário da entrada (zero ou maior).');
    if (!Utils.isValidDate(data.data)) errors.push('Informe a data de entrada.');
    if (!responsavel) errors.push('Informe o responsável pelo recebimento.');
    return { errors, value: { part, quantidade, valorUnitario, responsavel, observacao: Utils.normalizeText(data.observacao) } };
  }

  function addEntry(state, data) {
    const checked = validateEntry(state, data);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const { part, quantidade, valorUnitario, responsavel, observacao } = checked.value;
    const movement = {
      id: Utils.nextId('MOV', state.movimentacoes, 3),
      tipo: 'Entrada',
      pecaId: part.id,
      quantidade,
      valorUnitario,
      data: data.data,
      veiculoId: null,
      manutencaoId: null,
      responsavel,
      observacao,
    };
    state.movimentacoes.push(movement);
    return { ok: true, value: movement };
  }

  function validateWithdrawal(state, data) {
    const errors = [];
    const part = findPart(state, data.pecaId);
    const veiculo = Vehicles.find(state, data.veiculoId);
    const quantidade = Utils.parseQuantidade(data.quantidade);
    const responsavel = Utils.normalizeText(data.responsavel);
    const manutencao = data.manutencaoId ? Maintenance.find(state, data.manutencaoId) : null;

    if (!part) errors.push('Informe o código ou a descrição da peça retirada.');
    if (!veiculo) errors.push('Informe a placa do veículo de destino.');
    else if (!Vehicles.isActive(veiculo)) errors.push('Veículo inativo não pode receber peças do almoxarifado.');
    if (data.manutencaoId && !manutencao) errors.push('A manutenção informada não foi encontrada.');
    else if (manutencao && !Maintenance.isOpen(manutencao)) errors.push('A manutenção informada não está aberta.');
    else if (manutencao && veiculo && manutencao.veiculoId !== veiculo.id) errors.push('A manutenção informada pertence a outro veículo.');
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      errors.push('Informe uma quantidade maior que zero (use fração, como 1/2, se necessário).');
    } else if (part) {
      const saldo = balance(state, part.id);
      if (quantidade > saldo) {
        errors.push(`Saldo insuficiente para ${part.descricao}: disponível ${saldo}, solicitado ${quantidade}.`);
      }
    }
    if (!responsavel) errors.push('Informe o responsável pela solicitação.');
    if (!Utils.isValidDate(data.data)) errors.push('Informe a data da retirada.');

    return { errors, value: { part, veiculo, quantidade, responsavel, observacao: Utils.normalizeText(data.observacao) } };
  }

  function registerWithdrawal(state, data) {
    const checked = validateWithdrawal(state, data);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const { part, quantidade, responsavel, observacao } = checked.value;
    const movement = {
      id: Utils.nextId('MOV', state.movimentacoes, 3),
      tipo: 'Saida',
      pecaId: part.id,
      quantidade,
      valorUnitario: part.valorUnitario,
      data: data.data,
      veiculoId: data.veiculoId,
      manutencaoId: data.manutencaoId || null,
      responsavel,
      observacao,
    };
    state.movimentacoes.push(movement);
    return { ok: true, value: movement };
  }

  function registerWithdrawals(state, data) {
    const items = Array.isArray(data.itens) ? data.itens : [];
    const errors = [];
    const vehicle = Vehicles.find(state, data.veiculoId);
    const maintenance = data.manutencaoId ? Maintenance.find(state, data.manutencaoId) : null;
    const responsible = Utils.normalizeText(data.responsavel);
    const prepared = [];
    const totals = new Map();
    if (!vehicle) errors.push('Informe o veículo de destino.');
    else if (!Vehicles.isActive(vehicle)) errors.push('Veículo inativo não pode receber peças do almoxarifado.');
    if (data.manutencaoId && !maintenance) errors.push('A manutenção informada não foi encontrada.');
    else if (maintenance && !Maintenance.isOpen(maintenance)) errors.push('A manutenção informada não está aberta.');
    else if (maintenance && vehicle && maintenance.veiculoId !== vehicle.id) errors.push('A manutenção informada pertence a outro veículo.');
    if (!responsible) errors.push('Informe o responsável pela solicitação.');
    if (!Utils.isValidDate(data.data)) errors.push('Informe a data da retirada.');
    if (!items.length) errors.push('Adicione ao menos uma peça à retirada.');
    items.forEach((item, index) => {
      const part = findPart(state, item.pecaId);
      const quantity = Utils.parseQuantidade(item.quantidade);
      if (!part) errors.push(`Selecione uma peça na linha ${index + 1}.`);
      if (!Number.isFinite(quantity) || quantity <= 0) errors.push(`Informe uma quantidade válida na linha ${index + 1}.`);
      if (part && Number.isFinite(quantity) && quantity > 0) {
        totals.set(part.id, (totals.get(part.id) || 0) + quantity);
        prepared.push({ part, quantity });
      }
    });
    for (const [partId, quantity] of totals) {
      const part = findPart(state, partId);
      const available = balance(state, partId);
      if (quantity > available) errors.push(`Saldo insuficiente para ${part.descricao}: disponível ${available}, solicitado ${quantity}.`);
    }
    if (errors.length) return { ok: false, errors };
    const movements = [];
    for (const { part, quantity } of prepared) {
      movements.push({
        id: Utils.nextId('MOV', state.movimentacoes.concat(movements), 3),
        tipo: 'Saida', pecaId: part.id, quantidade: quantity, valorUnitario: part.valorUnitario,
        data: data.data, veiculoId: vehicle.id, manutencaoId: maintenance ? maintenance.id : null,
        responsavel: responsible, observacao: Utils.normalizeText(data.observacao),
      });
    }
    state.movimentacoes.push(...movements);
    return { ok: true, value: movements };
  }

  function listTools(state) {
    const toolsList = Array.isArray(state.ferramentas) ? state.ferramentas : [];
    const loans = Array.isArray(state.retiradasFerramentas) ? state.retiradasFerramentas : [];
    return toolsList.map(tool => {
      const activeLoan = loans.find(loan => loan.ferramentaId === tool.id && !loan.devolvidaEm) || null;
      return { ...tool, activeLoan, situacao: activeLoan ? 'Emprestada' : (tool.ativa === false ? 'Inativa' : 'Disponível') };
    });
  }

  function createTool(state, data) {
    state.ferramentas = Array.isArray(state.ferramentas) ? state.ferramentas : [];
    const codigo = Utils.normalizeText(data.codigo);
    const descricao = Utils.normalizeText(data.descricao);
    const patrimonio = Utils.normalizeText(data.patrimonio);
    const errors = [];
    if (!codigo) errors.push('Informe o código da ferramenta.');
    if (!descricao) errors.push('Informe a descrição da ferramenta.');
    if (state.ferramentas.some(tool => Utils.sameText(tool.codigo, codigo))) errors.push('Já existe uma ferramenta com este código.');
    if (patrimonio && state.ferramentas.some(tool => tool.patrimonio && Utils.sameText(tool.patrimonio, patrimonio))) errors.push('Já existe uma ferramenta com este patrimônio.');
    if (errors.length) return { ok: false, errors };
    const tool = { id: Utils.nextId('FER', state.ferramentas, 3), codigo, descricao, patrimonio, observacao: Utils.normalizeText(data.observacao), ativa: true, criadaEm: Utils.todayIso() };
    state.ferramentas.push(tool);
    return { ok: true, value: tool };
  }

  function loanTool(state, data) {
    state.ferramentas = Array.isArray(state.ferramentas) ? state.ferramentas : [];
    state.retiradasFerramentas = Array.isArray(state.retiradasFerramentas) ? state.retiradasFerramentas : [];
    const tool = state.ferramentas.find(item => item.id === data.ferramentaId);
    const responsible = Utils.normalizeText(data.responsavel);
    const errors = [];
    if (!tool || tool.ativa === false) errors.push('Selecione uma ferramenta ativa.');
    if (tool && state.retiradasFerramentas.some(loan => loan.ferramentaId === tool.id && !loan.devolvidaEm)) errors.push('Esta ferramenta já está emprestada.');
    if (!responsible) errors.push('Informe o responsável pela retirada.');
    if (!Utils.isValidDate(data.dataRetirada)) errors.push('Informe a data da retirada.');
    if (!Utils.isValidDate(data.previsaoDevolucao)) errors.push('Informe a previsão de devolução.');
    if (Utils.isValidDate(data.dataRetirada) && Utils.isValidDate(data.previsaoDevolucao) && data.previsaoDevolucao < data.dataRetirada) errors.push('A previsão de devolução não pode ser anterior à retirada.');
    if (errors.length) return { ok: false, errors };
    const loan = { id: Utils.nextId('RET-FER', state.retiradasFerramentas, 3), ferramentaId: tool.id, responsavel: responsible, finalidade: Utils.normalizeText(data.finalidade), dataRetirada: data.dataRetirada, previsaoDevolucao: data.previsaoDevolucao, devolvidaEm: null, condicaoDevolucao: '', observacao: Utils.normalizeText(data.observacao) };
    state.retiradasFerramentas.push(loan);
    return { ok: true, value: loan };
  }

  function returnTool(state, loanId, data) {
    const loan = (state.retiradasFerramentas || []).find(item => item.id === loanId);
    if (!loan) return { ok: false, errors: ['Retirada de ferramenta não encontrada.'] };
    if (loan.devolvidaEm) return { ok: false, errors: ['Esta ferramenta já foi devolvida.'] };
    if (!Utils.isValidDate(data.devolvidaEm)) return { ok: false, errors: ['Informe a data da devolução.'] };
    const condition = Utils.normalizeText(data.condicaoDevolucao);
    if (!condition) return { ok: false, errors: ['Informe a condição da ferramenta na devolução.'] };
    if (data.devolvidaEm < loan.dataRetirada) return { ok: false, errors: ['A devolução não pode ser anterior à retirada.'] };
    loan.devolvidaEm = data.devolvidaEm;
    loan.condicaoDevolucao = condition;
    loan.observacaoDevolucao = Utils.normalizeText(data.observacaoDevolucao);
    return { ok: true, value: loan };
  }

  /* Baixa vinculada a gasto externo: não exige veículo e não entra em custos de manutenção. */
  function registerSpendingWithdrawal(state, data) {
    const part = findPart(state, data.pecaId);
    const quantidade = Utils.parseQuantidade(data.quantidade);
    const responsavel = Utils.normalizeText(data.responsavel);
    const errors = [];
    if (!part) errors.push('Selecione uma peça cadastrada no estoque.');
    if (!Number.isFinite(quantidade) || quantidade <= 0) errors.push('Informe uma quantidade maior que zero.');
    if (part && Number.isFinite(quantidade) && quantidade > 0) {
      const saldo = balance(state, part.id);
      if (quantidade > saldo) errors.push(`Saldo insuficiente para ${part.descricao}: disponível ${saldo}, solicitado ${quantidade}.`);
    }
    if (!Utils.isValidDate(data.data)) errors.push('Informe a data da retirada.');
    if (!responsavel) errors.push('Informe o responsável pela retirada.');
    if (errors.length) return { ok: false, errors };
    const movement = {
      id: Utils.nextId('MOV', state.movimentacoes, 3),
      tipo: 'Saida',
      pecaId: part.id,
      quantidade,
      valorUnitario: part.valorUnitario,
      data: data.data,
      veiculoId: null,
      manutencaoId: null,
      responsavel,
      observacao: [Utils.normalizeText(data.observacao), `Baixa vinculada ao gasto externo ${data.gastoId || ''}`].filter(Boolean).join(' · '),
      gastoExternoId: data.gastoId || null,
    };
    state.movimentacoes.push(movement);
    return { ok: true, value: movement };
  }

  /* Peça de fora do almoxarifado: não altera saldo; entra apenas nos custos do veículo. */
  function registerExternalPart(state, data) {
    const errors = [];
    const veiculo = Vehicles.find(state, data.veiculoId);
    const manutencao = data.manutencaoId ? Maintenance.find(state, data.manutencaoId) : null;
    const descricao = Utils.normalizeText(data.descricao);
    const quantidade = Utils.parseInteger(data.quantidade);
    const valorUnitario = Utils.parseMoney(data.valorUnitario);
    const responsavel = Utils.normalizeText(data.responsavel);

    if (!veiculo) errors.push('Selecione o veículo.');
    else if (!Vehicles.isActive(veiculo)) errors.push('Veículo inativo não pode receber peças externas.');
    if (data.manutencaoId && !manutencao) errors.push('A manutenção informada não foi encontrada.');
    else if (manutencao && !Maintenance.isOpen(manutencao)) errors.push('A manutenção informada não está aberta.');
    else if (manutencao && veiculo && manutencao.veiculoId !== veiculo.id) errors.push('A manutenção informada pertence a outro veículo.');
    if (!descricao) errors.push('Descreva a peça adquirida fora do almoxarifado.');
    if (!Number.isInteger(quantidade) || quantidade <= 0) errors.push('Informe uma quantidade maior que zero.');
    if (!Number.isFinite(valorUnitario)) errors.push('Informe o valor unitário (zero ou maior).');
    if (!Utils.isValidDate(data.data)) errors.push('Informe a data de aquisição ou utilização.');
    if (!responsavel) errors.push('Informe o responsável pela solicitação.');
    if (errors.length) return { ok: false, errors };

    const external = {
      id: Utils.nextId('EXT', state.pecasExternas, 3),
      veiculoId: veiculo.id,
      manutencaoId: manutencao ? manutencao.id : null,
      descricao,
      quantidade,
      valorUnitario,
      data: data.data,
      responsavel,
      motivo: Utils.normalizeText(data.motivo),
    };
    state.pecasExternas.push(external);
    return { ok: true, value: external };
  }

  /* Histórico da peça em ordem cronológica estável, com saldo acumulado após cada movimento. */
  function movementsOf(state, pecaId) {
    const ordered = state.movimentacoes
      .map((m, index) => ({ m, index }))
      .filter(item => item.m.pecaId === pecaId)
      .sort((a, b) => a.m.data.localeCompare(b.m.data) || a.index - b.index)
      .map(item => item.m);
    let saldo = 0;
    return ordered.map(m => {
      saldo = Utils.round3(saldo + variacao(m));
      return { ...m, saldoApos: saldo };
    });
  }

  /* Não permite apagar uma saída que sustenta um gasto ou uma troca de óleo. */
  function deleteWithdrawal(state, movementId) {
    const index = state.movimentacoes.findIndex(m => m.id === movementId && m.tipo === 'Saida');
    if (index < 0) return { ok: false, errors: ['Retirada não encontrada.'] };
    const movement = state.movimentacoes[index];
    const gastoVinculado = (state.gastosExternos || []).some(g =>
      g.retiradaEstoque && (g.id === movement.gastoExternoId || g.movimentacaoId === movementId)
    );
    if (gastoVinculado) {
      return { ok: false, errors: ['Esta retirada está vinculada a um gasto externo e não pode ser excluída.'] };
    }
    const trocaVinculada = (state.trocasOleo || []).some(t => t.movimentacaoId === movementId);
    if (trocaVinculada) {
      return { ok: false, errors: ['Esta retirada está vinculada a uma troca de óleo e não pode ser excluída.'] };
    }
    const [removed] = state.movimentacoes.splice(index, 1);
    return { ok: true, value: removed };
  }

  /* filtros: { from, to, veiculoId, pecaId } */
  function withdrawals(state, filters = {}) {
    return state.movimentacoes
      .filter(m => m.tipo === 'Saida')
      .filter(m => Utils.inPeriod(m.data, filters.from, filters.to))
      .filter(m => !filters.veiculoId || filters.veiculoId === 'Todos' || m.veiculoId === filters.veiculoId)
      .filter(m => !filters.pecaId || filters.pecaId === 'Todas' || m.pecaId === filters.pecaId)
      .map(m => {
        const part = findPart(state, m.pecaId);
        return {
          ...m,
          pecaDescricao: part ? part.descricao : m.pecaId,
          valorTotal: Utils.round2(m.quantidade * m.valorUnitario),
          origem: m.manutencaoId ? `Manutenção ${m.manutencaoId}` : 'Retirada direta',
        };
      })
      .sort((a, b) => b.data.localeCompare(a.data));
  }

  function externalParts(state, filters = {}) {
    return state.pecasExternas
      .filter(e => Utils.inPeriod(e.data, filters.from, filters.to))
      .filter(e => !filters.veiculoId || filters.veiculoId === 'Todos' || e.veiculoId === filters.veiculoId)
      .map(e => ({ ...e, valorTotal: Utils.round2(e.quantidade * e.valorUnitario) }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }

  return {
    findPart, balance, isLowStock, inventory, filterInventory,
    validatePart, createPart, updatePart, deletePart, addEntry, validateAdjustment, addAdjustment,
    validateWithdrawal, registerWithdrawal, registerWithdrawals, registerSpendingWithdrawal, listTools, createTool, loanTool, returnTool, registerExternalPart,
    movementsOf, withdrawals, deleteWithdrawal, externalParts,
  };
})();
