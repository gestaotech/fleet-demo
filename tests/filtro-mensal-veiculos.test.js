/*
 * Filtro mensal da aba Veículos.
 * Valida: seleção de mês/ano, filtragem por tipo de evento, totais do período,
 * veículos sem movimentação, combinação com a pesquisa e consistência com os Relatórios.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./helpers/load-app');

const app = loadApp();
const P = () => app.api('Period');
const V = () => app.api('Vehicles');
const R = () => app.api('Reports');
const F = () => app.api('Fuel');
const O = () => app.api('Oil');
const W = () => app.api('Warehouse');
const M = () => app.api('Maintenance');

test('periodo: meses disponíveis vêm das datas de evento, do mais recente ao mais antigo', () => {
  const s = app.fresh();
  assert.equal(P().availableMonths(s).join(','), '2026-10,2026-09,2026-08,2026-07,2026-05,2026-02');
});

test('periodo: converte mês em intervalo de datas com o último dia correto', () => {
  const j = (v) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(j(P().monthRange('2026-10')), { anoMes: '2026-10', ano: 2026, mes: 10, from: '2026-10-01', to: '2026-10-31' });
  assert.equal(P().monthRange('2026-02').to, '2026-02-28', 'fevereiro de 2026 não é bissexto');
  assert.equal(P().monthRange('2024-02').to, '2024-02-29', 'fevereiro de 2024 é bissexto');
  assert.equal(P().monthRange('2026-13'), null);
  assert.equal(P().monthRange('2026-00'), null);
  assert.equal(P().monthRange('outubro'), null);
  assert.equal(P().monthLabel('2026-10'), 'Outubro de 2026');
  assert.equal(P().monthLabel('2026-03'), 'Março de 2026');
});

test('periodo: resolve devolve período aberto quando não há mês selecionado', () => {
  const j = (v) => JSON.parse(JSON.stringify(v));
  assert.deepEqual(j(P().resolve('')), { from: '', to: '', anoMes: '' });
  assert.deepEqual(j(P().resolve('2026-09')), { from: '2026-09-01', to: '2026-09-30', anoMes: '2026-09' });
});

test('periodo: opções de mês incluem "Todos os meses" e marcam o mês selecionado', () => {
  const s = app.fresh();
  const opcoes = P().monthOptions(s, '2026-09');
  assert.equal(opcoes[0].value, '');
  assert.equal(opcoes[0].label, 'Todos os meses');
  assert.equal(opcoes[1].label, 'Outubro de 2026');
  assert.equal(opcoes.find(o => o.value === '2026-09').selected, true);
});

test('filtro mensal: filtra cada tipo de evento pela data do evento', () => {
  const s = app.fresh();
  const setembro = P().resolve('2026-09');
  assert.equal(M().list(s, { from: setembro.from, to: setembro.to }).length, 2, 'MNT-0003 e MNT-0004');
  assert.equal(R().vehicleHistory(s, 'VEI-001', setembro).filter(e => e.tipo === 'Troca de óleo').length, 0, 'troca de óleo de VEI-001 é de julho');
  const resumoVei006 = R().vehiclePeriodSummary(s, 'VEI-006', setembro);
  assert.equal(resumoVei006.contagens.trocasOleo, 1, 'OLE-0006 em 15/09');
  assert.equal(resumoVei006.contagens.abastecimentos, 0, 'abastecimentos de VEI-006 são de agosto');
  assert.equal(resumoVei006.contagens.retiradas, 2, 'MOV-019 e MOV-020');
  assert.equal(resumoVei006.contagens.pecasExternas, 1, 'EXT-001');
});

test('filtro mensal: abastecimentos e retiradas respeitam o período', () => {
  const s = app.fresh();
  const setembro = P().resolve('2026-09');
  const outubro = P().resolve('2026-10');
  assert.equal(F().list(s, setembro).length, 6);
  assert.equal(F().list(s, outubro).length, 4);
  assert.equal(W().withdrawals(s, outubro).length, 4, 'MOV-021 a MOV-024');
  assert.equal(W().withdrawals(s, setembro).length, 3, 'MOV-018 a MOV-020');
});

test('filtro mensal: totais financeiros somam somente o período, sem duplicar despesas', () => {
  const s = app.fresh();
  const outubro = R().vehiclePeriodSummary(s, 'VEI-001', P().resolve('2026-10'));
  /* MNT-0005: retirada PEC-001 (55) + despesa (120) = 175 de manutenção; abastecimento ABS-0005 = 920,70. */
  assert.equal(outubro.custos.total, 175);
  assert.equal(outubro.custos.combustivel.total, 920.7);
  assert.equal(outubro.totalGeral, 1095.7);
  /* Nenhum evento de troca de óleo com custo próprio no período. */
  assert.equal(outubro.custos.trocasOleoProprias, 0);
});

test('filtro mensal: troca de óleo com custo próprio entra no total uma única vez', () => {
  const s = app.fresh();
  const setembro = P().resolve('2026-09');
  const resumo = R().vehiclePeriodSummary(s, 'VEI-006', setembro);
  /* OLE-0006 é uma troca própria (sem movimentacaoId): 8 L x 31,50 = 252. */
  assert.equal(resumo.custos.trocasOleoProprias, 252);
  const evento = resumo.eventos.find(e => e.tipo === 'Troca de óleo');
  assert.equal(evento.custo, 252);
  assert.notEqual(evento.custoJaContado, true);
  /* OLE-0006 está vinculada à MNT-0004; o total do período é 948 e inclui essa troca uma única vez. */
  assert.equal(resumo.custos.total, 948);
  assert.equal(resumo.custos.trocasOleoProprias, 252, 'o custo próprio da troca aparece separado');
  assert.equal(resumo.custos.pecasAlmoxarifado, 109 + 252, 'MOV-019 (correia) + MOV-020 (óleo do estoque)');
  assert.equal(resumo.custos.pecasExternas, 245, 'EXT-001');
  assert.equal(resumo.custos.outrasDespesas, 90, 'DES-004');
  const eventoManutencao = resumo.eventos.find(e => e.tipo === 'Manutenção');
  assert.equal(eventoManutencao.custoAgregado, true, 'o evento de manutenção traz o total da manutenção');
  assert.equal(eventoManutencao.custo, 948);
});

test('filtro mensal: troca de óleo com origem no estoque não é somada duas vezes', () => {
  const s = app.fresh();
  /* Cria uma troca usando óleo do almoxarifado e confirma que o custo aparece só uma vez. */
  const troca = O().create(s, {
    veiculoId: 'VEI-003', data: '2026-10-15', quilometragem: 89000, especificacao: '15W40 mineral',
    quantidade: 5, valorUnitario: '', responsavel: 'Márcia Lopes', intervaloKm: 8000, intervaloMeses: 12,
    manutencaoId: 'Nenhuma', pecaId: 'PEC-006',
  });
  assert.equal(troca.ok, true);
  const outubro = P().resolve('2026-10');
  const resumo = R().vehiclePeriodSummary(s, 'VEI-003', outubro);
  const evento = resumo.eventos.find(e => e.tipo === 'Troca de óleo' && e.referencia === troca.value.id);
  assert.equal(evento.custoJaContado, true, 'custo vem da retirada de estoque');
  assert.equal(resumo.custos.trocasOleoProprias, 0, 'não soma custo próprio');
  /* O valor da retirada entra nas peças do almoxarifado, sem acréscimo no total por causa da troca. */
  const mov = s.movimentacoes.find(m => m.id === troca.value.movimentacaoId);
  const custoRetirada = mov.quantidade * mov.valorUnitario;
  assert.equal(resumo.custos.pecasAlmoxarifado, 2 * 1380 + 4 * 41 + custoRetirada, 'retiradas de VEI-003 no mês incluem a troca uma única vez');
  /* O total de manutenção é exatamente a soma das parcelas, sem duplicidade. */
  assert.equal(
    resumo.custos.total,
    Math.round((resumo.custos.pecasAlmoxarifado + resumo.custos.pecasExternas + resumo.custos.outrasDespesas + resumo.custos.trocasOleoProprias) * 100) / 100,
  );
});

test('filtro mensal: veículo sem movimentação no mês continua visível e sinalizado', () => {
  const s = app.fresh();
  const outubro = P().resolve('2026-10');
  const resumos = R().vehicleSummaries(s, outubro);
  assert.equal(resumos.length, 8, 'todos os veículos permanecem na lista');
  const semRegistros = resumos.filter(r => !r.temRegistros).map(r => r.veiculo.placa);
  assert.equal(semRegistros.sort().join(','), 'DEM5E05,DEM6F06,DEM7G07,DEM8H08');
  const inativo = resumos.find(r => r.veiculo.placa === 'DEM7G07');
  assert.equal(inativo.temRegistros, false);
  assert.equal(inativo.veiculo.situacao, 'Inativo', 'filtro de mês não altera a situação cadastral');
});

test('filtro mensal: preserva situação cadastral e operacional calculada', () => {
  const s = app.fresh();
  const antes = V().filter(s, {}).map(v => `${v.placa}:${v.situacao}:${V().operationalStatus(s, v.id)}`);
  R().vehicleSummaries(s, P().resolve('2026-07'));
  const depois = V().filter(s, {}).map(v => `${v.placa}:${v.situacao}:${V().operationalStatus(s, v.id)}`);
  assert.equal(depois.join('|'), antes.join('|'), 'o filtro de mês não modifica dados nem situações');
});

test('filtro mensal: combina com a pesquisa por placa, marca ou identificação', () => {
  const s = app.fresh();
  const outubro = P().resolve('2026-10');
  const filtrados = V().filter(s, { termo: 'volvo' });
  assert.equal(filtrados.length, 1);
  const resumos = R().vehicleSummaries(s, outubro, filtrados);
  assert.equal(resumos.length, 1);
  assert.equal(resumos[0].veiculo.placa, 'DEM3C03');
  assert.equal(resumos[0].temRegistros, true, 'VEI-003 tem movimentação em outubro');
  /* Pesquisa sem resultado continua vazia, sem quebrar o resumo do período. */
  assert.equal(R().vehicleSummaries(s, outubro, V().filter(s, { termo: 'inexistente' })).length, 0);
});

test('filtro mensal: pesquisa encontra veículo sem movimentação no mês', () => {
  const s = app.fresh();
  const outubro = P().resolve('2026-10');
  const filtrados = V().filter(s, { termo: 'DEM5E05' });
  const resumos = R().vehicleSummaries(s, outubro, filtrados);
  assert.equal(resumos.length, 1);
  assert.equal(resumos[0].temRegistros, false, 'aparece mesmo sem registros no período');
});

test('histórico do veículo: eventos ordenados do mais recente e com data do evento', () => {
  const s = app.fresh();
  const eventos = R().vehicleHistory(s, 'VEI-001', {});
  assert.ok(eventos.length >= 5);
  for (let i = 1; i < eventos.length; i += 1) {
    assert.ok(eventos[i - 1].data >= eventos[i].data, 'ordem decrescente por data do evento');
  }
  assert.equal(eventos.every(e => typeof e.data === 'string' && e.data.length >= 10), true);
  const tipos = new Set(eventos.map(e => e.tipo));
  assert.equal(tipos.has('Manutenção'), true);
  assert.equal(tipos.has('Abastecimento'), true);
  assert.equal(tipos.has('Troca de óleo'), true);
});

test('histórico do veículo: período restringe os eventos e o histórico completo é maior', () => {
  const s = app.fresh();
  const outubro = P().resolve('2026-10');
  const parcial = R().vehicleHistory(s, 'VEI-003', outubro);
  const completo = R().vehicleHistory(s, 'VEI-003', {});
  assert.ok(completo.length > parcial.length);
  assert.equal(parcial.every(e => e.data >= outubro.from && e.data <= outubro.to + 'T23:59'), true);
  assert.equal(parcial.length, 4, 'MNT-0006, MOV-022, MOV-023, EXT-003');
});

test('consistência: totais da aba Veículos batem com o relatório de veículos em cada mês', () => {
  const s = app.fresh();
  P().availableMonths(s).forEach(mes => {
    const period = P().resolve(mes);
    const resumos = R().vehicleSummaries(s, period);
    const relatorio = R().vehiclesReport(s, period);
    resumos.forEach(x => {
      const linha = relatorio.find(y => y.id === x.veiculoId);
      assert.equal(x.custos.total, linha.custoManutencao, `manutenção ${mes} ${x.veiculoId}`);
      assert.equal(x.custos.combustivel.total, linha.custoCombustivel, `combustível ${mes} ${x.veiculoId}`);
      assert.equal(x.totalGeral, linha.custoTotal, `total ${mes} ${x.veiculoId}`);
    });
    const somaVeiculos = Math.round(resumos.reduce((a, x) => a + x.totalGeral, 0) * 100) / 100;
    const somaRelatorio = Math.round(relatorio.reduce((a, v) => a + v.custoTotal, 0) * 100) / 100;
    assert.equal(somaVeiculos, somaRelatorio, `soma dos veículos em ${mes}`);
  });
});

test('consistência: total do mês bate com o relatório completo do mesmo período', () => {
  const s = app.fresh();
  P().availableMonths(s).forEach(mes => {
    const period = P().resolve(mes);
    const resumos = R().vehicleSummaries(s, period);
    const somaVeiculos = Math.round(resumos.reduce((a, x) => a + x.totalGeral, 0) * 100) / 100;
    const full = R().fullReport(s, period);
    assert.equal(somaVeiculos, full.totalGeral, `total geral em ${mes}`);
  });
});

test('consistência: litros e gastos de combustível do mês batem com o relatório de combustível', () => {
  const s = app.fresh();
  P().availableMonths(s).forEach(mes => {
    const period = P().resolve(mes);
    const resumos = R().vehicleSummaries(s, period);
    const litros = Math.round(resumos.reduce((a, x) => a + x.custos.combustivel.litros, 0) * 1000) / 1000;
    const valor = Math.round(resumos.reduce((a, x) => a + x.custos.combustivel.total, 0) * 100) / 100;
    const relatorio = R().fuelReport(s, period);
    assert.equal(litros, relatorio.totals.litros, `litros em ${mes}`);
    assert.equal(valor, relatorio.totals.valor, `valor em ${mes}`);
  });
});

test('filtro mensal: a seleção não grava nem remove dados', () => {
  const s = app.fresh();
  const antes = JSON.stringify(s);
  P().availableMonths(s).forEach(mes => {
    R().vehicleSummaries(s, P().resolve(mes));
    R().vehicleHistory(s, 'VEI-001', P().resolve(mes));
  });
  assert.equal(JSON.stringify(s), antes, 'consultar o filtro não altera os dados');
});
