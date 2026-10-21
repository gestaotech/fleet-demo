/*
 * Regras de veículos.
 * Situação cadastral (Ativo/Inativo) é informada pelo usuário.
 * Situação operacional (Disponível/Em manutenção) é calculada a partir das manutenções abertas.
 */
const Vehicles = (function () {
  const SITUACOES = ['Ativo', 'Inativo'];
  const PLACA_PATTERN = /^(?:[A-Z]{3}\d{4}|[A-Z]{3}\d[A-Z]\d{2})$/;

  function find(state, id) {
    return state.veiculos.find(v => v.id === id) || null;
  }

  function isActive(vehicle) {
    return Boolean(vehicle) && vehicle.situacao === 'Ativo';
  }

  function operationalStatus(state, veiculoId) {
    return Maintenance.hasOpen(state, veiculoId) ? 'Em manutenção' : 'Disponível';
  }

  /*
   * Quilometragem atual conhecida do veículo: a maior quilometragem registrada em
   * abastecimentos, trocas de óleo e manutenções. Não existe hodômetro próprio do veículo,
   * por isso o valor é derivado dos registros e pode ficar desatualizado.
   */
  function currentKm(state, veiculoId) {
    const valores = [];
    const abastecimentos = state.abastecimentos || [];
    const trocas = state.trocasOleo || [];
    const manutencoes = state.manutencoes || [];
    abastecimentos.forEach(a => { if (a.veiculoId === veiculoId && Number.isInteger(a.quilometragem)) valores.push(a.quilometragem); });
    trocas.forEach(t => { if (t.veiculoId === veiculoId && Number.isInteger(t.quilometragem)) valores.push(t.quilometragem); });
    manutencoes.forEach(m => { if (m.veiculoId === veiculoId && Number.isInteger(m.quilometragem)) valores.push(m.quilometragem); });
    return valores.length ? Math.max(...valores) : null;
  }

  /* Data do registro mais recente que informou quilometragem (para exibir a origem do dado). */
  function currentKmSource(state, veiculoId) {
    const candidatos = [];
    (state.abastecimentos || []).forEach(a => {
      if (a.veiculoId === veiculoId && Number.isInteger(a.quilometragem)) candidatos.push({ km: a.quilometragem, data: a.dataHora, origem: 'Abastecimento' });
    });
    (state.trocasOleo || []).forEach(t => {
      if (t.veiculoId === veiculoId && Number.isInteger(t.quilometragem)) candidatos.push({ km: t.quilometragem, data: `${t.data}T00:00`, origem: 'Troca de óleo' });
    });
    (state.manutencoes || []).forEach(m => {
      if (m.veiculoId === veiculoId && Number.isInteger(m.quilometragem)) candidatos.push({ km: m.quilometragem, data: m.dataEntrada, origem: 'Manutenção' });
    });
    if (!candidatos.length) return null;
    return candidatos.reduce((maior, atual) => (atual.km > maior.km ? atual : maior));
  }

  function validate(state, data, editingId) {
    const errors = [];
    const marca = Utils.normalizeText(data.marca);
    const identificacao = Utils.normalizeText(data.identificacao);
    const placa = Utils.normalizePlate(data.placa);
    const dataEntrada = data.dataEntrada;
    const situacao = data.situacao;

    if (!marca) errors.push('Informe a marca do veículo.');
    if (!identificacao) errors.push('Informe o número ou identificação interna.');
    if (!PLACA_PATTERN.test(placa)) errors.push('Placa inválida. Use o padrão antigo (ABC1234) ou Mercosul (ABC1D23).');
    if (!Utils.isValidDate(dataEntrada)) errors.push('Informe uma data de entrada na frota válida.');
    if (!SITUACOES.includes(situacao)) errors.push('Selecione a situação: Ativo ou Inativo.');
    if (identificacao && state.veiculos.some(v => v.id !== editingId && Utils.sameText(v.identificacao, identificacao))) {
      errors.push('Já existe um veículo com este número de identificação.');
    }
    if (PLACA_PATTERN.test(placa) && state.veiculos.some(v => v.id !== editingId && v.placa === placa)) {
      errors.push('Já existe um veículo com esta placa.');
    }

    return { errors, value: { marca, identificacao, placa, dataEntrada, situacao } };
  }

  function create(state, data) {
    const checked = validate(state, data, null);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    const vehicle = { id: Utils.nextId('VEI', state.veiculos, 3), ...checked.value };
    state.veiculos.push(vehicle);
    return { ok: true, value: vehicle };
  }

  function update(state, id, data) {
    const vehicle = find(state, id);
    if (!vehicle) return { ok: false, errors: ['Veículo não encontrado.'] };
    const checked = validate(state, data, id);
    if (checked.errors.length) return { ok: false, errors: checked.errors };
    Object.assign(vehicle, checked.value);
    return { ok: true, value: vehicle };
  }

  function summary(state) {
    const total = state.veiculos.length;
    const ativos = state.veiculos.filter(v => v.situacao === 'Ativo').length;
    const inativos = total - ativos;
    const emManutencao = state.veiculos.filter(v => operationalStatus(state, v.id) === 'Em manutenção').length;
    return { total, ativos, inativos, emManutencao };
  }

  /* filtros: { termo, situacao: 'Todos'|'Ativo'|'Inativo', operacional: 'Todos'|'Disponível'|'Em manutenção' } */
  function filter(state, filters = {}) {
    const termo = Utils.searchKey(filters.termo);
    return state.veiculos.filter(v => {
      if (termo) {
        const haystack = Utils.searchKey(`${v.placa} ${v.marca} ${v.identificacao}`);
        if (!haystack.includes(termo)) return false;
      }
      if (filters.situacao && filters.situacao !== 'Todos' && v.situacao !== filters.situacao) return false;
      if (filters.operacional && filters.operacional !== 'Todos' && operationalStatus(state, v.id) !== filters.operacional) return false;
      return true;
    });
  }

  return { SITUACOES, find, isActive, operationalStatus, currentKm, currentKmSource, validate, create, update, summary, filter };
})();
