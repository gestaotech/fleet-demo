/*
 * Regras das barras de pesquisa digitada (placa de veículo, código ou descrição de peça).
 * Usadas por filtros e formulários, para que todas as telas resolvam a busca do mesmo modo:
 * correspondência exata tem prioridade; senão, só uma correspondência parcial é aceita.
 * Com duas ou mais, nenhum registro é escolhido e o usuário precisa completar a busca.
 */
const Search = (function () {
  function resolveIn(registros, termo, codigoDe, textoDe) {
    if (!termo) return { id: null, count: 0 };
    const exato = registros.find(r => codigoDe(r) === termo);
    if (exato) return { id: exato.id, count: 1 };
    const parciais = registros.filter(r => codigoDe(r).includes(termo) || textoDe(r).includes(termo));
    return { id: parciais.length === 1 ? parciais[0].id : null, count: parciais.length };
  }

  /* options.apenasAtivos: formulários de operação só aceitam veículos ativos. */
  function vehicle(state, busca, options = {}) {
    const registros = state.veiculos.filter(v => !options.apenasAtivos || v.situacao === 'Ativo');
    return resolveIn(registros, Utils.normalizePlate(busca), v => Utils.normalizePlate(v.placa), () => '');
  }

  function part(state, busca) {
    return resolveIn(state.pecas, Utils.searchKey(busca), p => Utils.searchKey(p.codigo), p => Utils.searchKey(p.descricao));
  }

  /* Filtros: campo vazio ou "Todos" não filtra; texto sem correspondência não encontra registros. */
  function vehicleFilter(state, busca) {
    const texto = Utils.searchKey(busca);
    if (!texto || texto === 'todos' || texto === 'todas') return 'Todos';
    return vehicle(state, busca).id || busca;
  }

  function partFilter(state, busca) {
    const texto = Utils.searchKey(busca);
    if (!texto || texto === 'todas' || texto === 'todos') return 'Todas';
    return part(state, busca).id || busca;
  }

  return { vehicle, part, vehicleFilter, partFilter };
})();
