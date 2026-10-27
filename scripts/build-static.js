"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, "public");
const staticEntries = ["index.html", "assets", "css", "js"];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of staticEntries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo/pasta estática obrigatória ausente: ${entry}`);
  }
  fs.cpSync(source, path.join(output, entry), { recursive: true });
}

console.log("Arquivos estáticos copiados para public/; as funções em api/ permanecem na raiz.");
