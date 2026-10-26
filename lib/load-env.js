"use strict";

/*
 * Carrega .env.local e .env (quando existirem) para process.env, sem dependências.
 * Variáveis já definidas no ambiente (ex.: painel da Vercel) têm prioridade.
 * Os valores nunca são impressos.
 */

const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");

function carregarEnv() {
  for (const nome of [".env.local", ".env"]) {
    const arquivo = path.join(RAIZ, nome);
    if (fs.existsSync(arquivo)) {
      process.loadEnvFile(arquivo);
    }
  }
}

module.exports = { carregarEnv };
