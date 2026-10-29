"use strict";

/*
 * Módulos e permissões da aplicação.
 *
 * Os identificadores são os mesmos usados pela interface (js/core/access.js) e pela
 * restrição CHECK da migração 002. Qualquer alteração deve ser feita nos dois lugares.
 *
 * Regra de escrita: cada coleção do estado operacional pertence a um módulo; só
 * quem tem esse módulo pode alterar a coleção. A regra é aplicada no servidor,
 * a partir da sessão, e nunca depende do que a interface mostra.
 */

const MODULOS = Object.freeze([
  "admin",
  "almoxarifado",
  "veiculos",
  "manutencao",
  "combustivel",
  "relatorios",
]);

// Coleções do estado operacional e o módulo responsável por gravá-las.
// "usuarios" não faz parte do estado: credenciais e vínculos ficam em tabelas próprias.
const COLECAO_MODULO = Object.freeze({
  veiculos: "veiculos",
  pecas: "almoxarifado",
  movimentacoes: "almoxarifado",
  pecasExternas: "almoxarifado",
  manutencoes: "manutencao",
  despesas: "manutencao",
  trocasOleo: "manutencao",
  abastecimentos: "combustivel",
  entradasCombustivel: "combustivel",
  configuracoes: "admin",
});

const COLECOES = Object.freeze(Object.keys(COLECAO_MODULO));

function temPermissao(permissoes, modulo) {
  return Array.isArray(permissoes) && permissoes.includes(modulo);
}

function permissoesValidas(lista) {
  return Array.isArray(lista) && lista.every((p) => MODULOS.includes(p));
}

/*
 * Literal de array de texto do PostgreSQL ("{admin,veiculos}"). Os drivers tratam
 * arrays de formas diferentes; o literal é uniforme. Só aceita módulos conhecidos,
 * por isso não há risco de injeção.
 */
function paraArrayPg(lista) {
  if (!permissoesValidas(lista)) throw new Error("Permissão desconhecida ao montar array.");
  return `{${[...new Set(lista)].join(",")}}`;
}

module.exports = { MODULOS, COLECAO_MODULO, COLECOES, temPermissao, permissoesValidas, paraArrayPg };
