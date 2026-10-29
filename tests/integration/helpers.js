"use strict";

/*
 * Infraestrutura dos testes de integração.
 *
 * Usa TEST_DATABASE_URL (PostgreSQL real, local ou branch de teste do Neon).
 * Antes dos testes o schema público é recriado (exige TEST_DATABASE_RESET=sim),
 * as migrações são aplicadas e o servidor HTTP da aplicação é iniciado em porta livre.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const URL_TESTE = process.env.TEST_DATABASE_URL;
if (URL_TESTE) {
  // Configura o ambiente antes de carregar lib/db (que lê DATABASE_URL ao usar).
  process.env.DATABASE_URL = URL_TESTE;
  process.env.IP_HASH_SALT = process.env.IP_HASH_SALT || "salt-de-teste";
  process.env.SESSION_TTL_HOURS = "8";
  // Cada requisição de teste informa um IP distinto por X-Forwarded-For, para que
  // o limite por IP não interfira entre cenários.
  process.env.TRUSTED_PROXY_HEADERS = "true";
}

const { Client } = require("pg");
const { aplicarMigracoes } = require("../../scripts/migrate");
const { criarServidor } = require("../../scripts/serve");
const { hashPassword } = require("../../lib/security");
const { MODULOS } = require("../../lib/permissions");

let cliente = null;
let servidor = null;
let base = "";
let contadorIp = 0;

function estadoDemo() {
  const codigo = fs.readFileSync(path.join(__dirname, "..", "..", "tests", "fixtures", "data.js"), "utf8");
  const DemoData = vm.runInNewContext(`${codigo}\nDemoData;`, {});
  const estado = DemoData.createSeed();
  delete estado.usuarios;
  return estado;
}

async function prepararBanco() {
  if (process.env.TEST_DATABASE_RESET !== "sim") {
    throw new Error("TEST_DATABASE_RESET=sim é obrigatório para os testes de integração.");
  }
  cliente = new Client({ connectionString: URL_TESTE });
  await cliente.connect();
  await cliente.query("DROP SCHEMA IF EXISTS public CASCADE");
  await cliente.query("CREATE SCHEMA public");
  await aplicarMigracoes(URL_TESTE, { log: () => {} });

  servidor = criarServidor();
  await new Promise((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${servidor.address().port}`;
}

async function encerrar() {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  if (cliente) await cliente.end();
}

function sql(texto, parametros = []) {
  return cliente.query(texto, parametros).then((r) => r.rows);
}

async function criarEmpresa(slug, nome = `Empresa ${slug}`) {
  const linhas = await sql("INSERT INTO companies (name, slug) VALUES ($1, $2) RETURNING id", [nome, slug]);
  return linhas[0].id;
}

async function criarEstado(empresaId, ajustes = {}) {
  const estado = { ...estadoDemo(), ...ajustes };
  await sql(
    "INSERT INTO fleet_workspace_state (company_id, schema_version, state, revision) VALUES ($1, 2, $2::jsonb, 1)",
    [empresaId, JSON.stringify(estado)],
  );
  return estado;
}

async function criarUsuario({ empresaId, login, senha = "senha-forte-123", permissoes = MODULOS, ativo = true, vinculoAtivo = true, nome = login }) {
  const usuario = await sql(
    "INSERT INTO app_users (login, name, cargo, password_hash, active) VALUES ($1, $2, 'Teste', $3, $4) RETURNING id",
    [login, nome, hashPassword(senha), ativo],
  );
  const id = usuario[0].id;
  if (empresaId) {
    await sql(
      `INSERT INTO company_memberships (user_id, company_id, role, active, permissions)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, empresaId, permissoes.includes("admin") ? "ADMIN" : "MEMBER", vinculoAtivo, `{${permissoes.join(",")}}`],
    );
  }
  return id;
}

function proximoIp() {
  contadorIp += 1;
  return `198.51.100.${(contadorIp % 250) + 1}`;
}

/* Envia uma requisição HTTP real ao servidor de teste. */
async function requisitar(metodo, caminho, { cookies = "", csrf, corpo, cabecalhos = {}, ip } = {}) {
  const headers = {
    "x-forwarded-for": ip || proximoIp(),
    host: new URL(base).host,
    origin: base,
    ...cabecalhos,
  };
  if (cookies) headers.cookie = cookies;
  if (csrf) headers["x-csrf-token"] = csrf;
  let body;
  if (corpo !== undefined) {
    headers["content-type"] = "application/json";
    body = typeof corpo === "string" ? corpo : JSON.stringify(corpo);
  }
  const resposta = await fetch(base + caminho, { method: metodo, headers, body, redirect: "manual" });
  const texto = await resposta.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  return {
    status: resposta.status,
    headers: resposta.headers,
    texto,
    json,
    cookiesRecebidos: resposta.headers.getSetCookie(),
  };
}

function valorDoCookie(lista, nome) {
  for (const linha of lista) {
    const [par] = linha.split(";");
    const indice = par.indexOf("=");
    if (par.slice(0, indice) === nome) return par.slice(indice + 1);
  }
  return null;
}

/* Login real pela API. Devolve o cabeçalho de cookies e o token CSRF para as próximas chamadas. */
async function entrar(login, senha = "senha-forte-123", ip) {
  const resposta = await requisitar("POST", "/api/v1/auth/login", { corpo: { login, senha }, ip });
  if (resposta.status !== 200) {
    throw new Error(`Login de teste falhou com status ${resposta.status}`);
  }
  const sessao = valorDoCookie(resposta.cookiesRecebidos, "gt_session");
  const csrf = valorDoCookie(resposta.cookiesRecebidos, "gt_csrf");
  return {
    cookies: `gt_session=${sessao}; gt_csrf=${csrf}`,
    csrf,
    sessao,
    resposta,
  };
}

module.exports = {
  URL_TESTE,
  prepararBanco,
  encerrar,
  sql,
  criarEmpresa,
  criarEstado,
  criarUsuario,
  requisitar,
  entrar,
  valorDoCookie,
  estadoDemo,
  get base() {
    return base;
  },
};
