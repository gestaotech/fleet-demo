"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, "public");
const staticEntries = ["index.html", "assets", "css", "js"];
const fixtureRelativePath = path.join("js", "data.js");
const setupHtml = path.join(root, "setup-admin.html");
const setupOutput = path.join(output, "setup-admin.html");
const bootstrapEnabled = typeof process.env.ADMIN_BOOTSTRAP_TOKEN === "string"
  && process.env.ADMIN_BOOTSTRAP_TOKEN.length >= 32;

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const entry of staticEntries) {
  const source = path.join(root, entry);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo/pasta estática obrigatória ausente: ${entry}`);
  }
  fs.cpSync(source, path.join(output, entry), { recursive: true });
}

/*
 * A tela de bootstrap só entra no pacote se a variável temporária estiver
 * configurada durante o build. Sem ela, o HTML não é publicado.
 */
if (bootstrapEnabled) {
  if (!fs.existsSync(setupHtml)) {
    throw new Error("ADMIN_BOOTSTRAP_TOKEN está configurado, mas setup-admin.html não existe.");
  }
  fs.copyFileSync(setupHtml, setupOutput);
} else {
  fs.rmSync(setupOutput, { force: true });
}

/*
 * js/data.js contém somente fixtures fictícias usadas pelo seed e por testes.
 * O arquivo-fonte é mantido para ferramentas internas, mas nunca deve ser publicado.
 */
fs.rmSync(path.join(output, fixtureRelativePath), { force: true });

const htmlPublico = fs.readFileSync(path.join(output, "index.html"), "utf8");
if (/src=["']js\/data\.js["']/.test(htmlPublico)) {
  throw new Error("O HTML publicado ainda referencia o arquivo de dados fictícios.");
}

const arquivosPublicos = [];
function listarArquivos(diretorio) {
  for (const item of fs.readdirSync(diretorio, { withFileTypes: true })) {
    const caminho = path.join(diretorio, item.name);
    if (item.isDirectory()) listarArquivos(caminho);
    else arquivosPublicos.push(caminho);
  }
}
listarArquivos(output);

if (fs.existsSync(path.join(output, fixtureRelativePath))) {
  throw new Error("Fixture de desenvolvimento foi incluída no pacote público.");
}
if (!bootstrapEnabled && fs.existsSync(setupOutput)) {
  throw new Error("A tela de configuração inicial não pode ser publicada sem ADMIN_BOOTSTRAP_TOKEN.");
}
for (const arquivo of arquivosPublicos) {
  const conteudo = fs.readFileSync(arquivo, "utf8");
  if (conteudo.includes("demo123")) {
    throw new Error(`Possível dado fictício de desenvolvimento encontrado no pacote público: ${path.relative(output, arquivo)}`);
  }
}

console.log("Arquivos estáticos copiados para public/ sem fixtures de desenvolvimento; as funções em api/ permanecem na raiz.");
console.log(bootstrapEnabled
  ? "Tela temporária de configuração inicial incluída; remova ADMIN_BOOTSTRAP_TOKEN e publique novamente após o uso."
  : "Tela temporária de configuração inicial excluída do pacote público.");
