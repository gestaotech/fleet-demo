"use strict";

/*
 * Garante que todo import desestruturado entre módulos locais (lib/, api/, scripts/)
 * aponta para um nome realmente exportado. Um nome inexistente só falha em tempo de
 * execução (ex.: "enviarJson is not a function"); este teste detecta antes do deploy.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "..");

function arquivosJs(dir) {
  const encontrados = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...arquivosJs(caminho));
    else if (entrada.name.endsWith(".js")) encontrados.push(caminho);
  }
  return encontrados;
}

test("todo import local desestruturado existe no módulo de origem", () => {
  const problemas = [];
  const arquivos = ["lib", "api", "scripts"].flatMap((d) => arquivosJs(path.join(RAIZ, d)));
  for (const arquivo of arquivos) {
    const codigo = fs.readFileSync(arquivo, "utf8");
    const re = /const\s*\{([^}]+)\}\s*=\s*require\(\s*["'](\.[^"']+)["']\s*\)/g;
    let m;
    while ((m = re.exec(codigo))) {
      const alvo = path.resolve(path.dirname(arquivo), m[2]);
      const exportacoes = require(alvo);
      for (const parte of m[1].split(",")) {
        const nome = parte.split(":")[0].trim();
        if (nome && !(nome in exportacoes)) {
          problemas.push(`${path.relative(RAIZ, arquivo)} importa "${nome}" de ${m[2]}`);
        }
      }
    }
  }
  assert.deepEqual(problemas, []);
});
