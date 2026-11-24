const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validarInvariantes, ajustesDaAlteracao, quantidadeComTresCasas } = require('../../lib/workspace');

function estado(movimentacoes) {
  return {
    veiculos: [{ id: 'VEI-1', placa: 'ABC1D23', situacao: 'Ativo' }],
    pecas: [{ id: 'PEC-1', codigo: 'A-1', descricao: 'Peça', valorUnitario: 10 }],
    movimentacoes,
    pecasExternas: [],
    manutencoes: [],
    despesas: [],
    abastecimentos: [],
    entradasCombustivel: [],
    trocasOleo: [],
  };
}

function mov(id, tipo, quantidade) {
  return { id, tipo, pecaId: 'PEC-1', quantidade, valorUnitario: 10, data: '2026-01-01', veiculoId: null, manutencaoId: null, responsavel: 'x', observacao: '' };
}

test('quantidade fracionada com até 3 casas é aceita na retirada', () => {
  const erros = validarInvariantes(estado([mov('M1', 'Entrada', 2), mov('M2', 'Saida', 0.5)]));
  assert.deepEqual(erros, []);
});

test('quantidade com mais de 3 casas decimais é recusada', () => {
  assert.equal(quantidadeComTresCasas(0.5), true);
  assert.equal(quantidadeComTresCasas(0.0005), false);
  const erros = validarInvariantes(estado([mov('M1', 'Entrada', 2), mov('M2', 'Saida', 0.0005)]));
  assert.ok(erros.some(e => e.includes('M2')));
});

test('somas decimais não criam falso saldo negativo (0,1 + 0,2 - 0,3)', () => {
  const erros = validarInvariantes(estado([mov('M1', 'Entrada', 0.1), mov('M2', 'Entrada', 0.2), mov('M3', 'Saida', 0.3)]));
  assert.deepEqual(erros, []);
});

test('saída acima do saldo continua sendo recusada', () => {
  const erros = validarInvariantes(estado([mov('M1', 'Entrada', 1), mov('M2', 'Saida', 1.5)]));
  assert.ok(erros.some(e => e.includes('Saldo negativo')));
});

test('ajuste pode ser positivo ou negativo, mas não zero', () => {
  assert.deepEqual(validarInvariantes(estado([mov('M1', 'Entrada', 5), mov('M2', 'Ajuste', -2)])), []);
  assert.deepEqual(validarInvariantes(estado([mov('M1', 'Entrada', 5), mov('M2', 'Ajuste', 3)])), []);
  const zero = validarInvariantes(estado([mov('M1', 'Entrada', 5), mov('M2', 'Ajuste', 0)]));
  assert.ok(zero.some(e => e.includes('M2')));
});

test('ajuste que leva o saldo abaixo de zero é recusado', () => {
  const erros = validarInvariantes(estado([mov('M1', 'Entrada', 1), mov('M2', 'Ajuste', -3)]));
  assert.ok(erros.some(e => e.includes('Saldo negativo')));
});

test('tipo de movimentação desconhecido é recusado', () => {
  const erros = validarInvariantes(estado([mov('M1', 'Entrada', 1), mov('M2', 'Outro', 1)]));
  assert.ok(erros.some(e => e.includes('Tipo de movimentação')));
});

test('ajustes já gravados não podem ser alterados nem excluídos', () => {
  const ajuste = mov('AJ1', 'Ajuste', 4);
  const atual = { movimentacoes: [mov('M1', 'Entrada', 1), ajuste] };
  const alterado = { movimentacoes: [mov('M1', 'Entrada', 1), { ...ajuste, quantidade: 9 }] };
  const excluido = { movimentacoes: [mov('M1', 'Entrada', 1)] };
  assert.deepEqual(ajustesDaAlteracao(atual, alterado).alterados, ['AJ1']);
  assert.deepEqual(ajustesDaAlteracao(atual, excluido).alterados, ['AJ1']);
});

test('ajuste novo é identificado para exigir administrador e senha confirmada', () => {
  const atual = { movimentacoes: [mov('M1', 'Entrada', 1)] };
  const novo = { movimentacoes: [mov('M1', 'Entrada', 1), mov('AJ2', 'Ajuste', 2)] };
  const r = ajustesDaAlteracao(atual, novo);
  assert.deepEqual(r.alterados, []);
  assert.deepEqual(r.novos.map(m => m.id), ['AJ2']);
});
