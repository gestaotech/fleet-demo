const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const O = () => app.api('Oil');
const W = () => app.api('Warehouse');
const C = () => app.api('Costs');
const R = () => app.api('Reports');

/* Data de referência fixa (dados fictícios foram montados para outubro de 2026). */
const HOJE = { hoje: '2026-10-21' };

const troca = (overrides = {}) => ({
  veiculoId: 'VEI-001',
  data: '2026-10-20',
  quilometragem: '50200',
  especificacao: '15W40 mineral',
  quantidade: '28',
  valorUnitario: '32,40',
  responsavel: 'Márcia Lopes',
  observacao: '',
  intervaloKm: '10000',
  intervaloMeses: '6',
  manutencaoId: '',
  pecaId: '',
  ...overrides,
});

test('situação: próxima da troca quando o km restante é menor que a antecedência', () => {
  const s = app.fresh();
  const info = O().status(s, O().find(s, 'OLE-0001'), HOJE);
  assert.equal(info.situacao, 'Próxima da troca');
  assert.equal(info.limiteKm, 51000);
  assert.equal(info.kmAtual, 50180);
  assert.equal(info.kmRestante, 820);
});

test('situação: vencida por quilometragem', () => {
  const s = app.fresh();
  const info = O().status(s, O().find(s, 'OLE-0002'), HOJE);
  assert.equal(info.situacao, 'Vencida por quilometragem');
  assert.equal(info.limiteKm, 63000);
  assert.ok(info.kmRestante <= 0);
});

test('situação: vencida por tempo', () => {
  const s = app.fresh();
  const info = O().status(s, O().find(s, 'OLE-0003'), HOJE);
  assert.equal(info.situacao, 'Vencida por tempo');
  assert.equal(info.limiteData, '2026-08-20');
  assert.ok(info.diasRestantes <= 0);
});

test('situação: em dia quando os dois limites estão distantes', () => {
  const s = app.fresh();
  const info = O().status(s, O().find(s, 'OLE-0004'), HOJE);
  assert.equal(info.situacao, 'Em dia');
});

test('situação: vencida por ambos quando km e tempo passaram do limite', () => {
  const s = app.fresh();
  const info = O().status(s, O().find(s, 'OLE-0002'), { hoje: '2027-06-01' });
  assert.equal(info.situacao, 'Vencida por ambos');
  assert.ok(info.kmRestante <= 0);
  assert.ok(info.diasRestantes <= 0);
});

test('situação: pendente de dados quando não há intervalo configurado', () => {
  const s = app.fresh();
  const info = O().status(s, O().find(s, 'OLE-0005'), HOJE);
  assert.equal(info.situacao, 'Pendente de dados');
});

test('sem intervalo nem km não presume "em dia" e pede configuração', () => {
  const s = app.fresh();
  const info = O().status(s, {
    id: 'X', veiculoId: 'VEI-001', data: '2026-10-20', quilometragem: 50200,
    intervaloKm: null, intervaloMeses: null,
  }, HOJE);
  assert.equal(info.situacao, 'Pendente de dados');
  assert.equal(info.avaliavel, false);
});

test('antecedência dos alertas é configurável', () => {
  const s = app.fresh();
  s.configuracoes = { alertaTrocaOleoKm: 0, alertaTrocaOleoDias: 0 };
  const info = O().status(s, O().find(s, 'OLE-0001'), HOJE);
  assert.equal(info.situacao, 'Em dia', 'com antecedência zero, 820 km restantes ainda não alerta');
});

test('próxima data considera meses com ajuste de fim de mês', () => {
  const s = app.fresh();
  s.trocasOleo.push({
    id: 'OLE-9000', veiculoId: 'VEI-001', data: '2026-01-31', quilometragem: 40000,
    especificacao: 'Teste', quantidade: 10, valorUnitario: 10, responsavel: 'Teste',
    observacao: '', intervaloKm: null, intervaloMeses: 1, manutencaoId: null, pecaId: null, movimentacaoId: null,
  });
  const info = O().status(s, O().find(s, 'OLE-9000'), HOJE);
  assert.equal(info.limiteData, '2026-02-28');
});

test('registro de troca cria identificador e custo próprio', () => {
  const s = app.fresh();
  const result = O().create(s, troca());
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.equal(result.value.id, 'OLE-0007');
  assert.equal(result.value.movimentacaoId, null);
  assert.equal(O().ownCost(result.value), 907.2);
});

test('troca exige data, km, especificação, quantidade e responsável', () => {
  const s = app.fresh();
  const result = O().create(s, troca({ data: '', quilometragem: '', especificacao: '', quantidade: '0', responsavel: '' }));
  assert.equal(result.ok, false);
  const texto = result.errors.join(' ');
  assert.match(texto, /data da troca/i);
  assert.match(texto, /quilometragem da troca/i);
  assert.match(texto, /especificação/i);
  assert.match(texto, /quantidade de óleo/i);
  assert.match(texto, /responsável/i);
});

test('troca com quantidade fracionada é aceita quando não usa estoque', () => {
  const s = app.fresh();
  const result = O().create(s, troca({ quantidade: '28,5' }));
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.equal(result.value.quantidade, 28.5);
});

test('troca que usa óleo do almoxarifado baixa o estoque e não duplica o custo', () => {
  const s = app.fresh();
  const saldoAntes = W().balance(s, 'PEC-006');
  const result = O().create(s, troca({ veiculoId: 'VEI-004', quilometragem: '31100', quantidade: '8', pecaId: 'PEC-006', valorUnitario: '' }));
  assert.equal(result.ok, true, result.errors && result.errors.join(' '));
  assert.ok(result.value.movimentacaoId, 'deve criar a retirada vinculada');
  assert.equal(W().balance(s, 'PEC-006'), saldoAntes - 8);
  assert.equal(O().ownCost(result.value), 0, 'custo próprio zerado para não duplicar');
  /* O custo aparece uma única vez: na retirada do estoque. */
  const costs = C().vehicleCosts(s, 'VEI-004');
  const somaTrocas = costs.trocasOleo.reduce((acc, t) => acc + O().ownCost(t), 0);
  assert.equal(costs.total, Math.round((costs.pecasAlmoxarifado + costs.pecasExternas + costs.outrasDespesas + somaTrocas) * 100) / 100);
});

test('troca sem saldo suficiente é recusada sem gravar nada', () => {
  const s = app.fresh();
  const antes = s.trocasOleo.length;
  const result = O().create(s, troca({ veiculoId: 'VEI-004', quilometragem: '31100', quantidade: '9999', pecaId: 'PEC-006', valorUnitario: '' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /saldo insuficiente/i);
  assert.equal(s.trocasOleo.length, antes);
});

test('troca vinculada a manutenção de outro veículo é recusada', () => {
  const s = app.fresh();
  const result = O().create(s, troca({ veiculoId: 'VEI-004', quilometragem: '31100', manutencaoId: 'MNT-0005' }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /outro veículo/i);
});

test('nova troca preserva o histórico anterior', () => {
  const s = app.fresh();
  const antes = s.trocasOleo.filter(t => t.veiculoId === 'VEI-001').length;
  O().create(s, troca());
  assert.equal(s.trocasOleo.filter(t => t.veiculoId === 'VEI-001').length, antes + 1);
  assert.equal(O().find(s, 'OLE-0001').quilometragem, 46000, 'registro anterior permanece intacto');
  assert.equal(O().lastChange(s, 'VEI-001').id, 'OLE-0007');
});

test('relatório de trocas de óleo classifica as situações por veículo', () => {
  const s = app.fresh();
  const report = R().oilReport(s, {}, HOJE);
  assert.equal(report.totals.total, 6);
  assert.equal(report.totals.porSituacao['Próxima da troca'], 1);
  assert.equal(report.totals.porSituacao['Vencida por quilometragem'], 1);
  assert.equal(report.totals.porSituacao['Vencida por tempo'], 1);
  assert.equal(report.totals.porSituacao['Em dia'], 2);
  /* VEI-005 tem troca sem intervalo e VEI-007/VEI-008 não têm troca registrada. */
  assert.equal(report.totals.porSituacao['Pendente de dados'], 3);
  assert.equal(report.porVeiculo.length, 8);
  assert.equal(report.totals.vencidas, 2);
  assert.equal(report.totals.proximas, 1);
});

test('custo das trocas de óleo entra no consolidado uma única vez', () => {
  const s = app.fresh();
  const full = R().fullReport(s, {});
  const somaTroca = s.trocasOleo.reduce((acc, t) => acc + O().ownCost(t), 0);
  assert.equal(full.trocasOleo.custoTotal, Math.round(somaTroca * 100) / 100);
  /* O total de manutenção inclui as trocas próprias; o total geral soma o combustível uma vez. */
  assert.equal(full.totalGeral, Math.round((full.custos.total + full.combustivel.valor) * 100) / 100);
});
