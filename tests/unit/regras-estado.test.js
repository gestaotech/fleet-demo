"use strict";

/*
 * Validação do estado operacional no servidor, usando o próprio estado de demonstração
 * (js/data.js) como referência: se o seed for válido, as regras não estão bloqueando
 * dados legítimos. Os cenários negativos garantem que as violações são barradas.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {
  validarEstado,
  validarFormato,
  colecoesAlteradas,
  modulosNecessarios,
} = require("../../lib/workspace");

function estadoDemo() {
  const codigo = fs.readFileSync(path.join(__dirname, "..", "..", "tests", "fixtures", "data.js"), "utf8");
  const DemoData = vm.runInNewContext(`${codigo}\nDemoData;`, {});
  const estado = DemoData.createSeed();
  delete estado.usuarios;
  return estado;
}

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

test("estado de demonstração é válido segundo as regras do servidor", () => {
  assert.deepEqual(validarEstado(estadoDemo()), []);
});

test("usuários e senhas não podem entrar no estado", () => {
  const com = estadoDemo();
  com.usuarios = [{ id: "USR-001", login: "admin", senha: "demo123" }];
  assert.ok(validarFormato(com).some((m) => /Usuários não são armazenados/.test(m)));

  const senhaEscondida = estadoDemo();
  senhaEscondida.veiculos[0].senha = "x";
  assert.ok(validarFormato(senhaEscondida).some((m) => /credenciais/.test(m)));
});

test("campos desconhecidos e coleções com tipo errado são recusados", () => {
  const extra = estadoDemo();
  extra.lixo = [];
  assert.ok(validarFormato(extra).some((m) => /Campo não reconhecido no estado: lixo/.test(m)));

  const tipo = estadoDemo();
  tipo.veiculos = "não é lista";
  assert.ok(validarFormato(tipo).some((m) => /veiculos deve ser uma lista/.test(m)));
});

test("estoque negativo é bloqueado", () => {
  const estado = estadoDemo();
  const peca = estado.pecas[0].id;
  estado.movimentacoes.push({
    id: "MOV-999", tipo: "Saida", pecaId: peca, quantidade: 100000, valorUnitario: 1,
    data: "2026-10-20", veiculoId: estado.veiculos[0].id, manutencaoId: null,
  });
  assert.ok(validarEstado(estado).some((m) => /Saldo negativo/.test(m)));
});

test("referências inexistentes entre registros são bloqueadas", () => {
  const estado = estadoDemo();
  estado.manutencoes[0].veiculoId = "VEI-999";
  assert.ok(validarEstado(estado).some((m) => /Manutenção .* veículo inexistente/.test(m)));

  const despesa = estadoDemo();
  despesa.despesas[0].manutencaoId = "MNT-999";
  assert.ok(validarEstado(despesa).some((m) => /Despesa .* manutenção inexistente/.test(m)));

  const oleo = estadoDemo();
  oleo.trocasOleo[0].movimentacaoId = "MOV-999";
  assert.ok(validarEstado(oleo).some((m) => /retirada inexistente/.test(m)));
});

test("peça externa não pode apontar para manutenção de outro veículo", () => {
  const estado = estadoDemo();
  const comManutencao = estado.pecasExternas.find((e) => e.manutencaoId);
  assert.ok(comManutencao, "seed deve ter peça externa vinculada a manutenção");
  const outro = estado.veiculos.find((v) => v.id !== comManutencao.veiculoId);
  comManutencao.veiculoId = outro.id;
  assert.ok(validarEstado(estado).some((m) => /outro veículo/.test(m)));
});

test("quantidades e valores inválidos são bloqueados", () => {
  const estado = estadoDemo();
  estado.abastecimentos[0].litros = 0;
  assert.ok(validarEstado(estado).some((m) => /Litros inválidos/.test(m)));

  const negativo = estadoDemo();
  negativo.despesas[0].valor = -5;
  assert.ok(validarEstado(negativo).some((m) => /Valor inválido na despesa/.test(m)));
});

test("identificadores duplicados e código de peça repetido são bloqueados", () => {
  const estado = estadoDemo();
  estado.veiculos.push(clonar(estado.veiculos[0]));
  assert.ok(validarEstado(estado).some((m) => /Identificador duplicado em veiculos/.test(m)));

  const codigo = estadoDemo();
  codigo.pecas[1].codigo = codigo.pecas[0].codigo.toUpperCase();
  assert.ok(validarEstado(codigo).some((m) => /Código de peça duplicado/.test(m)));
});

test("colecoesAlteradas identifica apenas as coleções realmente modificadas", () => {
  const antes = estadoDemo();
  const depois = clonar(antes);
  depois.abastecimentos.push({ ...clonar(antes.abastecimentos[0]), id: "ABS-NOVO" });
  assert.deepEqual(colecoesAlteradas(antes, depois), ["abastecimentos"]);
  assert.deepEqual(modulosNecessarios(["abastecimentos", "trocasOleo"]), ["combustivel", "manutencao"]);
  assert.deepEqual(colecoesAlteradas(antes, clonar(antes)), [], "estado idêntico não altera coleções");
});
