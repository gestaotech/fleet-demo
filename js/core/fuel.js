/*
 * Regras do módulo Combustível.
 * O preço por litro é sempre derivado do valor total e dos litros (ou usado para calcular o total).
 * Se o usuário informar os dois, a consistência é verificada antes de gravar.
 *
 * Consumo: método de tanque cheio. Considera apenas abastecimentos marcados como tanque cheio,
 * com quilometragem válida. A distância entre dois tanques cheios é dividida por todos os litros
 * abastecidos no intervalo (incluindo o abastecimento final). Sem dados suficientes, não há média.
 */
const Fuel = (function () {
  const TOLERANCIA_VALOR = 0.10; /* R$ 0,10 de diferença aceita entre valor total e litros x preço */

  function round3(value) {
    return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
  }

  function find(state, id) {
    return state.abastecimentos.find(a => a.id === id) || null;
  }

  function recordsOf(state, veiculoId) {
    return state.abastecimentos
      .map((registro, index) => ({ registro, index }))
      .filter(item => item.registro.veiculoId === veiculoId)
      .sort((a, b) => a.registro.dataHora.localeCompare(b.registro.dataHora) || a.index - b.index)
      .map(item => item.registro);
  }

  /* Maior quilometragem já registrada para o veículo (abastecimentos, trocas de óleo e manutenções). */
  function currentKm(state, veiculoId) {
    return Vehicles.currentKm(state, veiculoId);
  }

  function validate(state, data, editingId) {
    const errors = [];
    const existing = editingId ? find(state, editingId) : null;
    const veiculo = Vehicles.find(state, data.veiculoId);
    const dataHora = data.dataHora;
    const quilometragem = Utils.parseInteger(data.quilometragem);
    const litros = Utils.parseDecimal(data.litros);
    const valorInformado = Utils.parseMoney(data.valorTotal);
    const precoInformado = Utils.parseDecimal(data.precoLitro);
    const posto = Utils.normalizeText(data.posto);
    const responsavel = Utils.normalizeText(data.responsavel);

    if (!veiculo) errors.push('Selecione o veículo.');
    else if (!Vehicles.isActive(veiculo) && (!existing || existing.veiculoId !== veiculo.id)) {
      errors.push('Veículo inativo não pode receber novos abastecimentos.');
    }
    if (!Utils.isValidDateTime(dataHora)) errors.push('Informe a data e a hora do abastecimento.');
    if (!Number.isInteger(quilometragem) || quilometragem < 0) {
      errors.push('Informe a quilometragem do veículo como número inteiro (zero ou maior).');
    }
    if (!Number.isFinite(litros) || litros <= 0) errors.push('Informe a quantidade de litros maior que zero.');
    if (data.valorTotal === '' || data.valorTotal === undefined || data.valorTotal === null) {
      if (data.precoLitro === '' || data.precoLitro === undefined || data.precoLitro === null) {
        errors.push('Informe o valor total pago ou o preço por litro.');
      }
    } else if (!Number.isFinite(valorInformado) || valorInformado <= 0) {
      errors.push('Informe um valor total pago maior que zero.');
    }
    if (data.precoLitro !== '' && data.precoLitro !== undefined && data.precoLitro !== null) {
      if (!Number.isFinite(precoInformado) || precoInformado <= 0) errors.push('Informe um preço por litro maior que zero.');
    }
    if (!posto) errors.push('Informe o posto ou fornecedor.');
    if (!responsavel) errors.push('Informe o responsável pelo registro.');

    let valorTotal = valorInformado;
    let precoLitro = precoInformado;
    if (Number.isFinite(litros) && litros > 0) {
      const temValor = Number.isFinite(valorInformado) && valorInformado > 0;
      const temPreco = Number.isFinite(precoInformado) && precoInformado > 0;
      if (temValor && temPreco) {
        const calculado = litros * precoInformado;
        if (Math.abs(calculado - valorInformado) > TOLERANCIA_VALOR) {
          errors.push(`Valor total (${Utils.formatMoney(valorInformado)}) e preço por litro (${Utils.formatMoney(precoInformado)}) divergem para ${Utils.formatQuantity(litros)} litros. Corrija um dos dois.`);
        } else {
          precoLitro = round3(valorInformado / litros);
        }
      } else if (temValor) {
        precoLitro = round3(valorInformado / litros);
      } else if (temPreco) {
        valorTotal = Utils.round2(litros * precoInformado);
      }
    }

    if (Number.isInteger(quilometragem) && quilometragem >= 0 && Utils.isValidDateTime(dataHora)) {
      const anteriores = state.abastecimentos
        .filter(a => a.id !== editingId && a.veiculoId === data.veiculoId && a.dataHora <= dataHora);
      if (anteriores.length) {
        const ultimo = anteriores.reduce((maior, a) => (a.quilometragem > maior.quilometragem ? a : maior));
        if (quilometragem < ultimo.quilometragem) {
          errors.push(`A quilometragem não pode ser menor que a do abastecimento anterior (${Utils.formatKm(ultimo.quilometragem)} em ${Utils.formatDateTime(ultimo.dataHora)}). Se o registro anterior estiver errado, corrija-o primeiro.`);
        }
      }
    }

    return {
      errors,
      value: {
        veiculoId: data.veiculoId,
        dataHora,
        quilometragem,
        litros,
        valorTotal,
        precoLitro,
        posto,
        responsavel,
        observacao: Utils.normalizeText(data.observacao),
        tanqueCheio: Boolean(data.tanqueCheio),
      },
    };
  }

  function normalizeDecimalInput(value) {
    if (typeof value === 'number') return Utils.round2(value);
    return Utils.parseDecimal(value);
  }

  function create(state, data) {
    const checked = validate(state, data, null);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const record = { id: Utils.nextId('ABS', state.abastecimentos, 4), ...checked.value };
    state.abastecimentos.push(record);
    return { ok: true, value: record };
  }

  function update(state, id, data) {
    const record = find(state, id);
    if (!record) return { ok: false, errors: ['Abastecimento não encontrado.'] };
    const checked = validate(state, data, id);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    Object.assign(record, checked.value);
    return { ok: true, value: record };
  }

  /* filtros: { veiculoId, from, to } — período sobre a data e hora do abastecimento */
  function list(state, filters = {}) {
    return state.abastecimentos
      .filter(a => !filters.veiculoId || filters.veiculoId === 'Todos' || a.veiculoId === filters.veiculoId)
      .filter(a => Utils.inPeriod(a.dataHora, filters.from, filters.to))
      .map(a => {
        const vehicle = Vehicles.find(state, a.veiculoId);
        return { ...a, veiculoPlaca: vehicle ? vehicle.placa : a.veiculoId };
      })
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
  }

  function summary(state, filters = {}) {
    const rows = list(state, filters);
    const valor = Utils.sum(rows, r => r.valorTotal);
    const litros = Math.round(rows.reduce((acc, r) => acc + r.litros, 0) * 1000) / 1000;
    return {
      registros: rows.length,
      valor,
      litros,
      precoMedio: litros > 0 ? round3(valor / litros) : null,
    };
  }

  /*
   * Consumo médio pelo método de tanque cheio.
   * Retorna media (km/l) apenas quando existe ao menos um intervalo válido entre tanques cheios.
   */
  function consumption(state, veiculoId) {
    const registros = recordsOf(state, veiculoId);
    const tanques = registros.filter(r => r.tanqueCheio === true && Number.isInteger(r.quilometragem));
    const segmentos = [];
    let ignorados = 0;
    let distanciaTotal = 0;
    let litrosTotal = 0;

    for (let i = 1; i < tanques.length; i += 1) {
      const anterior = tanques[i - 1];
      const atual = tanques[i];
      const distancia = atual.quilometragem - anterior.quilometragem;
      const posAnterior = registros.indexOf(anterior);
      const posAtual = registros.indexOf(atual);
      const litros = registros.slice(posAnterior + 1, posAtual + 1).reduce((acc, r) => acc + r.litros, 0);
      if (distancia <= 0 || litros <= 0) {
        ignorados += 1;
        continue;
      }
      distanciaTotal += distancia;
      litrosTotal += litros;
      segmentos.push({
        deId: anterior.id,
        ateId: atual.id,
        distancia,
        litros: Math.round(litros * 1000) / 1000,
        media: Utils.round2(distancia / litros),
      });
    }

    return {
      suficiente: segmentos.length > 0,
      media: segmentos.length ? Utils.round2(distanciaTotal / litrosTotal) : null,
      distancia: distanciaTotal,
      litros: Math.round(litrosTotal * 1000) / 1000,
      segmentos,
      ignorados,
      tanquesCheios: tanques.length,
    };
  }

  return {
    TOLERANCIA_VALOR, find, recordsOf, currentKm, validate,
    create, update, list, summary, consumption, normalizeDecimalInput,
  };
})();
