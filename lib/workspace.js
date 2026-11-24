"use strict";

/*
 * Estado operacional da empresa (veículos, almoxarifado, manutenção, óleo,
 * combustível e configurações), guardado em fleet_workspace_state.
 *
 * Este módulo valida o que é gravado no servidor. A interface pode mostrar regras
 * de negócio, mas quem decide se o dado entra no banco é o servidor:
 *  - formato do estado e ausência de credenciais dentro dele;
 *  - permissão por módulo para cada coleção alterada;
 *  - invariantes: referências entre registros, valores positivos e estoque não negativo.
 *
 * Controle de concorrência: a gravação informa a revisão que o cliente leu. O banco
 * só aceita se a revisão ainda for a atual (ver api/v1/workspace.js).
 */

const { COLECAO_MODULO, COLECOES } = require("./permissions");

// "configuracoes" é um objeto; todas as demais coleções são listas de registros.
const COLECOES_LISTA = COLECOES.filter((c) => c !== "configuracoes");
const CHAVES_PERMITIDAS = new Set(["schemaVersion", "configuracoes", ...COLECOES]);
const CHAVES_SENSIVEIS = /senha|password|token|secret|hash|credencial/i;
const LIMITE_ITENS_POR_COLECAO = 5000;
const LIMITE_MENSAGENS = 20;

function ehObjeto(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/* Quantidades de estoque aceitam até 3 casas decimais (ex.: 1/2 = 0,5). */
function quantidadeComTresCasas(valor) {
  return typeof valor === "number" && Number.isFinite(valor) && Math.round(valor * 1000) / 1000 === valor;
}

/*
 * Ajustes de estoque: os já gravados não podem ser alterados nem excluídos; os novos
 * precisam de administrador com senha confirmada (a regra de quem pode fazer fica em api/v1/workspace.js).
 */
function ajustesDaAlteracao(atual, novo) {
  const idsAtuais = new Map((atual.movimentacoes || []).filter((m) => m && m.tipo === "Ajuste").map((m) => [m.id, JSON.stringify(m)]));
  const movimentosNovos = (novo.movimentacoes || []).filter((m) => m && m.tipo === "Ajuste");
  const alterados = [...idsAtuais.keys()].filter((id) => {
    const registro = (novo.movimentacoes || []).find((m) => m && m.id === id);
    return !registro || JSON.stringify(registro) !== idsAtuais.get(id);
  });
  const novos = movimentosNovos.filter((m) => !idsAtuais.has(m.id));
  return { alterados, novos };
}

/* Procura chaves sensíveis em qualquer nível. Credenciais nunca vão para o estado. */
function chavesSensiveis(valor, caminho = "", profundidade = 0) {
  if (profundidade > 12) return [];
  const achados = [];
  if (Array.isArray(valor)) {
    valor.forEach((item, indice) => achados.push(...chavesSensiveis(item, `${caminho}[${indice}]`, profundidade + 1)));
  } else if (ehObjeto(valor)) {
    for (const [chave, conteudo] of Object.entries(valor)) {
      if (CHAVES_SENSIVEIS.test(chave)) achados.push(`${caminho}.${chave}`.replace(/^\./, ""));
      achados.push(...chavesSensiveis(conteudo, `${caminho}.${chave}`.replace(/^\./, ""), profundidade + 1));
    }
  }
  return achados;
}

function validarFormato(estado) {
  const erros = [];
  if (!ehObjeto(estado)) return ["O estado enviado deve ser um objeto."];

  if ("usuarios" in estado) {
    erros.push("Usuários não são armazenados no estado. Use o cadastro de usuários.");
  }
  for (const chave of Object.keys(estado)) {
    if (!CHAVES_PERMITIDAS.has(chave)) erros.push(`Campo não reconhecido no estado: ${chave}.`);
  }
  const sensiveis = chavesSensiveis(estado);
  if (sensiveis.length) erros.push("O estado não pode conter credenciais ou segredos.");

  for (const colecao of COLECOES_LISTA) {
    const itens = estado[colecao];
    if (itens === undefined) continue; // coleção ausente = vazia (compatibilidade com estados antigos)
    if (!Array.isArray(itens)) {
      erros.push(`A coleção ${colecao} deve ser uma lista.`);
      continue;
    }
    if (itens.length > LIMITE_ITENS_POR_COLECAO) {
      erros.push(`A coleção ${colecao} excede o limite de ${LIMITE_ITENS_POR_COLECAO} registros.`);
    }
    if (itens.some((item) => !ehObjeto(item))) {
      erros.push(`Todos os registros de ${colecao} devem ser objetos.`);
    }
  }

  const config = estado.configuracoes;
  if (config !== undefined) {
    if (!ehObjeto(config)) {
      erros.push("configuracoes deve ser um objeto.");
    } else {
      for (const chave of ["alertaTrocaOleoKm", "alertaTrocaOleoDias"]) {
        if (config[chave] !== undefined && (!Number.isFinite(config[chave]) || config[chave] < 0)) {
          erros.push(`${chave} deve ser um número zero ou maior.`);
        }
      }
    }
  }
  return erros;
}

function idsUnicos(colecao, itens, erros) {
  const vistos = new Set();
  for (const item of itens) {
    if (typeof item.id !== "string" || !item.id) {
      erros.push(`Registro sem identificador em ${colecao}.`);
      continue;
    }
    if (vistos.has(item.id)) erros.push(`Identificador duplicado em ${colecao}: ${item.id}.`);
    vistos.add(item.id);
  }
  return vistos;
}

/*
 * Invariantes entre registros. Espelham as regras já aprovadas na demonstração
 * (js/core) em nível de integridade: referências existentes, quantidades positivas
 * e saldo de estoque nunca negativo.
 */
function validarInvariantes(estado) {
  const erros = [];
  const veiculos = idsUnicos("veiculos", estado.veiculos || [], erros);
  const pecas = idsUnicos("pecas", estado.pecas || [], erros);
  const manutencoes = new Map();
  for (const m of estado.manutencoes || []) {
    if (m && typeof m.id === "string") manutencoes.set(m.id, m);
  }
  idsUnicos("movimentacoes", estado.movimentacoes || [], erros);
  idsUnicos("pecasExternas", estado.pecasExternas || [], erros);
  idsUnicos("manutencoes", estado.manutencoes || [], erros);
  idsUnicos("despesas", estado.despesas || [], erros);
  idsUnicos("abastecimentos", estado.abastecimentos || [], erros);
  idsUnicos("entradasCombustivel", estado.entradasCombustivel || [], erros);
  idsUnicos("trocasOleo", estado.trocasOleo || [], erros);
  const movimentacoesPorId = new Map((estado.movimentacoes || []).map((m) => [m.id, m]));
  const codigosFerramentas = new Set();
  for (const ferramenta of estado.ferramentas || []) {
    const codigo = String(ferramenta.codigo || "").trim().toLowerCase();
    if (!codigo) erros.push(`Ferramenta ${ferramenta.id} sem código.`);
    if (codigo && codigosFerramentas.has(codigo)) erros.push(`Código de ferramenta duplicado: ${ferramenta.codigo}.`);
    codigosFerramentas.add(codigo);
  }
  const emprestimosAtivos = new Set();
  for (const retirada of estado.retiradasFerramentas || []) {
    if (!ferramentas.has(retirada.ferramentaId)) erros.push(`Retirada de ferramenta ${retirada.id} referencia ferramenta inexistente.`);
    if (!String(retirada.responsavel || "").trim()) erros.push(`Retirada de ferramenta ${retirada.id} sem responsável.`);
    if (typeof retirada.dataRetirada !== "string" || !/^\\d{4}-\\d{2}-\\d{2}$/.test(retirada.dataRetirada)) erros.push(`Data inválida na retirada de ferramenta ${retirada.id}.`);
    if (retirada.previsaoDevolucao && retirada.previsaoDevolucao < retirada.dataRetirada) erros.push(`Previsão inválida na retirada de ferramenta ${retirada.id}.`);
    if (!retirada.devolvidaEm) {
      if (emprestimosAtivos.has(retirada.ferramentaId)) erros.push(`Ferramenta ${retirada.ferramentaId} possui mais de um empréstimo ativo.`);
      emprestimosAtivos.add(retirada.ferramentaId);
    } else if (retirada.devolvidaEm < retirada.dataRetirada || !String(retirada.condicaoDevolucao || "").trim()) {
      erros.push(`Devolução inválida na retirada de ferramenta ${retirada.id}.`);
    }
  }

  const codigos = new Set();
  for (const p of estado.pecas || []) {
    const codigo = String(p.codigo || "").trim().toLowerCase();
    if (codigo && codigos.has(codigo)) erros.push(`Código de peça duplicado: ${p.codigo}.`);
    codigos.add(codigo);
  }

  const saldo = new Map();
  for (const m of estado.movimentacoes || []) {
    if (!["Entrada", "Saida", "Ajuste"].includes(m.tipo)) erros.push(`Tipo de movimentação inválido: ${m.id}.`);
    if (!pecas.has(m.pecaId)) erros.push(`Movimentação ${m.id} referencia peça inexistente.`);
    const quantidadeOk = m.tipo === "Ajuste"
      ? quantidadeComTresCasas(m.quantidade) && m.quantidade !== 0
      : quantidadeComTresCasas(m.quantidade) && m.quantidade > 0;
    if (!quantidadeOk) erros.push(`Quantidade inválida na movimentação ${m.id}.`);
    if (m.veiculoId && !veiculos.has(m.veiculoId)) erros.push(`Movimentação ${m.id} referencia veículo inexistente.`);
    if (m.manutencaoId && !manutencoes.has(m.manutencaoId)) erros.push(`Movimentação ${m.id} referencia manutenção inexistente.`);
    if (!quantidadeOk) continue;
    // Milésimos inteiros: a soma não sofre erro de ponto flutuante (0,1 + 0,2).
    const milesimos = Math.round(m.quantidade * 1000);
    const variacao = m.tipo === "Saida" ? -milesimos : milesimos;
    saldo.set(m.pecaId, (saldo.get(m.pecaId) || 0) + variacao);
  }
  for (const [pecaId, valor] of saldo) {
    if (valor < 0) erros.push(`Saldo negativo no estoque da peça ${pecaId}.`);
  }

  for (const m of estado.manutencoes || []) {
    if (!veiculos.has(m.veiculoId)) erros.push(`Manutenção ${m.id} referencia veículo inexistente.`);
  }
  for (const d of estado.despesas || []) {
    if (!manutencoes.has(d.manutencaoId)) erros.push(`Despesa ${d.id} referencia manutenção inexistente.`);
    if (!Number.isFinite(d.valor) || d.valor < 0) erros.push(`Valor inválido na despesa ${d.id}.`);
  }
  idsUnicos("gastosExternos", estado.gastosExternos || [], erros);
  for (const g of estado.gastosExternos || []) {
    if (!["Peça", "Insumo"].includes(g.tipo)) erros.push(`Tipo inválido no gasto externo ${g.id}.`);
    if (!quantidadeComTresCasas(g.quantidade) || !(g.quantidade > 0)) erros.push(`Quantidade inválida no gasto externo ${g.id}.`);
    if (!Number.isFinite(g.valorTotal) || g.valorTotal < 0) erros.push(`Valor inválido no gasto externo ${g.id}.`);
  }
  for (const e of estado.pecasExternas || []) {
    if (!veiculos.has(e.veiculoId)) erros.push(`Peça externa ${e.id} referencia veículo inexistente.`);
    if (e.manutencaoId) {
      const manutencao = manutencoes.get(e.manutencaoId);
      if (!manutencao) erros.push(`Peça externa ${e.id} referencia manutenção inexistente.`);
      else if (manutencao.veiculoId !== e.veiculoId) erros.push(`Peça externa ${e.id} pertence a manutenção de outro veículo.`);
    }
  }
  for (const a of estado.abastecimentos || []) {
    if (!veiculos.has(a.veiculoId)) erros.push(`Abastecimento ${a.id} referencia veículo inexistente.`);
    if (!(a.litros > 0)) erros.push(`Litros inválidos no abastecimento ${a.id}.`);
  }
  for (const e of estado.entradasCombustivel || []) {
    if (!(e.quantidade > 0)) erros.push(`Quantidade inválida na entrada de combustível ${e.id}.`);
    if (e.valorTotal !== undefined && e.valorTotal !== null && (!Number.isFinite(e.valorTotal) || e.valorTotal < 0)) {
      erros.push(`Valor inválido na entrada de combustível ${e.id}.`);
    }
  }
  for (const t of estado.trocasOleo || []) {
    if (!veiculos.has(t.veiculoId)) erros.push(`Troca de óleo ${t.id} referencia veículo inexistente.`);
    if (t.manutencaoId && !manutencoes.has(t.manutencaoId)) erros.push(`Troca de óleo ${t.id} referencia manutenção inexistente.`);
    if (t.movimentacaoId && !movimentacoesPorId.has(t.movimentacaoId)) erros.push(`Troca de óleo ${t.id} referencia retirada inexistente.`);
  }
  return erros;
}

/* Lista de mensagens de validação (formato + invariantes), limitada para resposta. */
function validarEstado(estado) {
  const formato = validarFormato(estado);
  if (formato.length) return formato.slice(0, LIMITE_MENSAGENS);
  return validarInvariantes(estado).slice(0, LIMITE_MENSAGENS);
}

/* JSON canônico (chaves ordenadas) para comparar coleções sem depender da ordem. */
function serializarCanonico(valor) {
  if (Array.isArray(valor)) return `[${valor.map(serializarCanonico).join(",")}]`;
  if (ehObjeto(valor)) {
    return `{${Object.keys(valor).sort().map((k) => `${JSON.stringify(k)}:${serializarCanonico(valor[k])}`).join(",")}}`;
  }
  return JSON.stringify(valor === undefined ? null : valor);
}

/* Coleções cujo conteúdo muda entre o estado guardado e o enviado. */
function colecoesAlteradas(anterior, novo) {
  const alteradas = [];
  for (const colecao of Object.keys(COLECAO_MODULO)) {
    const valorPadrao = colecao === "configuracoes" ? null : [];
    const antes = serializarCanonico(anterior ? anterior[colecao] ?? valorPadrao : valorPadrao);
    const depois = serializarCanonico(novo[colecao] ?? valorPadrao);
    if (antes !== depois) alteradas.push(colecao);
  }
  return alteradas;
}

/* Módulos necessários para gravar as coleções alteradas (sem repetição). */
function modulosNecessarios(colecoes) {
  return [...new Set(colecoes.map((c) => COLECAO_MODULO[c]))];
}

module.exports = {
  validarEstado,
  validarFormato,
  validarInvariantes,
  colecoesAlteradas,
  modulosNecessarios,
  ajustesDaAlteracao,
  quantidadeComTresCasas,
  serializarCanonico,
  chavesSensiveis,
  LIMITE_ITENS_POR_COLECAO,
};
