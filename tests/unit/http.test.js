"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Readable } = require("node:stream");
const {
  serializarCookie,
  lerCookies,
  exigirMetodo,
  lerCorpoJson,
  exigirMesmaOrigem,
  exigirCsrf,
  ipDoCliente,
  COOKIE_CSRF,
} = require("../../lib/http");
const { ApiError } = require("../../lib/errors");

function requisicao(overrides = {}) {
  const req = Readable.from([]);
  return Object.assign(req, {
    method: "GET",
    headers: {},
    socket: { remoteAddress: "10.0.0.5" },
    ...overrides,
  });
}

function capturar(fn) {
  try {
    fn();
    return null;
  } catch (erro) {
    return erro;
  }
}

test("cookie de sessão é HttpOnly, Secure e SameSite", () => {
  const cookie = serializarCookie("gt_session", "abc", { httpOnly: true, maxAge: 60, sameSite: "Lax" });
  assert.match(cookie, /^gt_session=abc; Path=\/; Max-Age=60; HttpOnly; Secure; SameSite=Lax$/);
});

test("cookie de CSRF não é HttpOnly, pois a interface precisa lê-lo", () => {
  const cookie = serializarCookie(COOKIE_CSRF, "tok", { sameSite: "Lax" });
  assert.equal(cookie.includes("HttpOnly"), false);
  assert.match(cookie, /Secure/);
});

test("lerCookies interpreta cabeçalho e ignora valores inválidos", () => {
  const req = requisicao({ headers: { cookie: "a=1; gt_session=x%20y; ruim; b=%E0%A4%A" } });
  const cookies = lerCookies(req);
  assert.equal(cookies.a, "1");
  assert.equal(cookies.gt_session, "x y");
  assert.equal(cookies.b, "");
  assert.equal("ruim" in cookies, false);
});

test("métodos fora da lista retornam 405 com cabeçalho Allow", () => {
  const erro = capturar(() => exigirMetodo(requisicao({ method: "DELETE" }), ["GET", "PUT"]));
  assert.ok(erro instanceof ApiError);
  assert.equal(erro.status, 405);
  assert.equal(erro.extra.allow, "GET, PUT");
});

test("corpo JSON inválido e tipo diferente de JSON são rejeitados", async () => {
  const invalido = requisicao({ method: "POST", headers: { "content-type": "application/json" } });
  invalido.body = "{nao-e-json";
  await assert.rejects(lerCorpoJson(invalido), (e) => e.status === 400 && e.code === "JSON_INVALIDO");

  const tipo = requisicao({ method: "POST", headers: { "content-type": "text/plain" } });
  await assert.rejects(lerCorpoJson(tipo), (e) => e.status === 415);
});

test("corpo acima do limite é recusado sem ser processado", async () => {
  const grande = requisicao({ method: "POST", headers: { "content-type": "application/json" } });
  grande.body = JSON.stringify({ texto: "a".repeat(2000) });
  await assert.rejects(lerCorpoJson(grande, 1000), (e) => e.status === 413);
});

test("corpo lido do stream respeita o limite de bytes", async () => {
  const req = Readable.from([Buffer.from('{"a":"'), Buffer.from("x".repeat(500)), Buffer.from('"}')]);
  req.headers = { "content-type": "application/json" };
  req.method = "POST";
  await assert.rejects(lerCorpoJson(req, 100), (e) => e.status === 413);
});

test("origem diferente do host é bloqueada e origem igual é aceita", () => {
  const cruzada = requisicao({ headers: { host: "app.exemplo.com", origin: "https://outro.com" } });
  assert.equal(capturar(() => exigirMesmaOrigem(cruzada)).code, "ORIGEM_INVALIDA");

  const mesma = requisicao({ headers: { host: "app.exemplo.com", origin: "https://app.exemplo.com" } });
  assert.equal(capturar(() => exigirMesmaOrigem(mesma)), null);

  const navegadorCruzado = requisicao({ headers: { host: "app.exemplo.com", "sec-fetch-site": "cross-site" } });
  assert.equal(capturar(() => exigirMesmaOrigem(navegadorCruzado)).code, "ORIGEM_INVALIDA");
});

test("CSRF exige cabeçalho igual ao cookie", () => {
  const ok = requisicao({ headers: { cookie: "gt_csrf=segredo-123456", "x-csrf-token": "segredo-123456" } });
  assert.equal(capturar(() => exigirCsrf(ok)), null);

  const diferente = requisicao({ headers: { cookie: "gt_csrf=segredo-123456", "x-csrf-token": "outro-valor-99" } });
  assert.equal(capturar(() => exigirCsrf(diferente)).code, "CSRF_INVALIDO");

  const ausente = requisicao({ headers: { cookie: "gt_csrf=segredo-123456" } });
  assert.equal(capturar(() => exigirCsrf(ausente)).code, "CSRF_INVALIDO");
});

test("IP só vem de cabeçalhos encaminhados quando o proxy é confiável", () => {
  const anterior = process.env.TRUSTED_PROXY_HEADERS;
  try {
    delete process.env.TRUSTED_PROXY_HEADERS;
    const req = requisicao({ headers: { "x-forwarded-for": "203.0.113.9" } });
    assert.equal(ipDoCliente(req), "10.0.0.5", "cabeçalho forjado não deve ser usado");

    process.env.TRUSTED_PROXY_HEADERS = "true";
    assert.equal(ipDoCliente(req), "203.0.113.9");
  } finally {
    if (anterior === undefined) delete process.env.TRUSTED_PROXY_HEADERS;
    else process.env.TRUSTED_PROXY_HEADERS = anterior;
  }
});
