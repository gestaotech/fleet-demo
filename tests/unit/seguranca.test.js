"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  hashPassword,
  verifyPassword,
  validarPoliticaSenha,
  gerarToken,
  sha256,
  iguaisSeguro,
} = require("../../lib/security");
const { sanitizarMetadados } = require("../../lib/audit");

test("senha é armazenada como scrypt com salt individual e nunca em texto puro", () => {
  const a = hashPassword("senha-forte-123");
  const b = hashPassword("senha-forte-123");
  assert.match(a, /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b, "mesma senha deve gerar hashes diferentes (salt aleatório)");
  assert.equal(a.includes("senha-forte-123"), false);
});

test("verifyPassword aceita a senha correta e rejeita as demais", () => {
  const armazenado = hashPassword("senha-forte-123");
  assert.equal(verifyPassword("senha-forte-123", armazenado), true);
  assert.equal(verifyPassword("senha-forte-124", armazenado), false);
  assert.equal(verifyPassword("", armazenado), false);
});

test("verifyPassword rejeita formatos malformados ou adulterados sem lançar erro", () => {
  const valido = hashPassword("senha-forte-123");
  const partes = valido.split("$");
  assert.equal(verifyPassword("x", "texto-qualquer"), false);
  assert.equal(verifyPassword("x", "scrypt$1$2$3$4$5"), false);
  assert.equal(verifyPassword("x", "scrypt$16384$8$1$AAAA$BBBB"), false);
  assert.equal(verifyPassword("senha-forte-123", [...partes.slice(0, 5), "AAAA"].join("$")), false);
  assert.equal(verifyPassword(undefined, valido), false);
});

test("política de senha exige 10 a 200 caracteres", () => {
  assert.match(validarPoliticaSenha("123456789"), /pelo menos 10/);
  assert.equal(validarPoliticaSenha("1234567890"), null);
  assert.match(validarPoliticaSenha("a".repeat(201)), /no máximo 200/);
  assert.match(validarPoliticaSenha(undefined), /Informe a senha/);
});

test("tokens aleatórios são distintos e o hash SHA-256 é determinístico", () => {
  const t1 = gerarToken();
  const t2 = gerarToken();
  assert.notEqual(t1, t2);
  assert.ok(t1.length >= 40, "token deve ter entropia suficiente");
  assert.equal(sha256(t1), sha256(t1));
  assert.notEqual(sha256(t1), t1, "o banco guarda o hash, não o token");
});

test("comparação de segredos rejeita valores de tamanhos diferentes", () => {
  assert.equal(iguaisSeguro("abc", "abc"), true);
  assert.equal(iguaisSeguro("abc", "abd"), false);
  assert.equal(iguaisSeguro("abc", "abcd"), false);
  assert.equal(iguaisSeguro(undefined, "abc"), false);
});

test("auditoria remove chaves sensíveis e limita o tamanho dos textos", () => {
  const limpo = sanitizarMetadados({
    motivo: "senha_invalida",
    senha: "nao-pode-aparecer",
    password: "nao-pode-aparecer",
    token: "x",
    cookie: "y",
    tokenHash: "z",
    descricao: "a".repeat(500),
    camposAlterados: ["nome", "senha"],
  });
  assert.equal(limpo.senha, undefined);
  assert.equal(limpo.password, undefined);
  assert.equal(limpo.token, undefined);
  assert.equal(limpo.cookie, undefined);
  assert.equal(limpo.tokenHash, undefined);
  assert.equal(limpo.descricao.length, 200);
  assert.equal(limpo.motivo, "senha_invalida");
  assert.deepEqual(limpo.camposAlterados, ["nome", "senha"], "nomes de campos podem aparecer; valores não");
  assert.equal(sanitizarMetadados(null), null);
});
