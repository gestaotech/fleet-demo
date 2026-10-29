"use strict";

/*
 * Verificação do build estático para a hospedagem na Vercel.
 *
 * Confere se os arquivos obrigatórios existem e se as migrações SQL estão na ordem
 * esperada. Não substitui os testes de navegador nem a validação do banco Neon.
 */

const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

const ARQUIVOS_OBRIGATORIOS = [
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/api.js",
  "js/storage.js",
  "api/v1/health.js",
  "api/v1/setup/admin.js",
  "setup-admin.html",
  "js/setup-admin.js",
  "api/v1/auth/login.js",
  "api/v1/auth/logout.js",
  "api/v1/auth/session.js",
  "api/v1/workspace.js",
  "api/v1/users/index.js",
  "api/v1/users/[id].js",
  "lib/db.js",
  "lib/http.js",
  "lib/security.js",
  "vercel.json",
  "package.json",
  "package-lock.json",
];

const ausentes = ARQUIVOS_OBRIGATORIOS.filter((arquivo) => !fs.existsSync(path.join(RAIZ, arquivo)));
if (ausentes.length) {
  console.error("Arquivos obrigatórios ausentes:");
  for (const arquivo of ausentes) console.error(` - ${arquivo}`);
  process.exit(1);
}

const migracoes = fs.readdirSync(path.join(RAIZ, "database", "migrations")).filter((n) => n.endsWith(".sql")).sort();
const esperadas = ["001_initial_schema.sql", "002_autenticacao_sessoes_concorrencia.sql", "003_auditoria_user_agent.sql"];
for (const nome of esperadas) {
  if (!migracoes.includes(nome)) {
    console.error(`Migração ausente: ${nome}`);
    process.exit(1);
  }
}

const scriptSeed = fs.readFileSync(path.join(RAIZ, "scripts", "seed.js"), "utf8");
if (/js\/data\.js|DemoData\.createSeed/.test(scriptSeed)) {
  console.error("O seed não pode carregar fixtures fictícias; deve criar um workspace vazio.");
  process.exit(1);
}

const htmlPrincipal = fs.readFileSync(path.join(RAIZ, "index.html"), "utf8");
if (/src=["\']js\/data\.js["\']/.test(htmlPrincipal)) {
  console.error("index.html não pode carregar dados fictícios de desenvolvimento.");
  process.exit(1);
}

console.log("Estrutura estática, API e migrações verificadas.");
console.log("A conexão com o Neon deve ser validada em /api/v1/health após configurar DATABASE_URL.");
console.log("O bootstrap temporário só será publicado quando ADMIN_BOOTSTRAP_TOKEN tiver ao menos 32 caracteres no build.");
