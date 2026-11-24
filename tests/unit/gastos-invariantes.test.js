const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarInvariantes } = require('../../lib/workspace');
const { COLECAO_MODULO } = require('../../lib/permissions');

function estado(gastosExternos) {
  return {
    veiculos: [],
    pecas: [],
    movimentacoes: [],
    pecasExternas: [],
    manutencoes: [],
    despesas: [],
    abastecimentos: [],
    entradasCombustivel: [],
    trocasOleo: [],
    gastosExternos,
  };
}

function gasto(overrides = {}) {
  return { id: 'GEX-0001', data: '2026-10-05', tipo: 'Insumo', descricao: 'Lubrificante', quantidade: 2.5, valorUnitario: 35.9, valorTotal: 89.75, fornecedor: 'Casa', responsavel: 'Rogério', observacao: '', ...overrides };
}

test('gasto externo válido é aceito', () => {
  assert.deepEqual(validarInvariantes(estado([gasto()])), []);
});

test('gasto externo com tipo, quantidade ou valor inválidos é recusado', () => {
  assert.ok(validarInvariantes(estado([gasto({ tipo: 'Outro' })])).some(e => e.includes('GEX-0001')));
  assert.ok(validarInvariantes(estado([gasto({ quantidade: 0 })])).some(e => e.includes('Quantidade')));
  assert.ok(validarInvariantes(estado([gasto({ quantidade: 0.0005 })])).some(e => e.includes('Quantidade')));
  assert.ok(validarInvariantes(estado([gasto({ valorTotal: -1 })])).some(e => e.includes('Valor')));
});

test('identificadores de gastos externos não podem se repetir', () => {
  const erros = validarInvariantes(estado([gasto(), gasto()]));
  assert.ok(erros.some(e => e.includes('duplicado') && e.includes('gastosExternos')));
});

test('gastos externos pertencem ao módulo do almoxarifado', () => {
  assert.equal(COLECAO_MODULO.gastosExternos, 'almoxarifado');
});
