const fs = require("node:fs");
const path = require("node:path");

/*
 * Verificação simples para o build da hospedagem estática.
 * Confirma que a página inicial e os recursos necessários para a interface existem.
 * Não substitui testes de navegador, integração ou validação do banco Neon.
 */
const requiredFiles = [
  "index.html",
  "css/styles.css",
  "js/app.js",
  "js/storage.js",
  "js/data.js",
  "api/v1/health.js",
  "vercel.json",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(process.cwd(), file)));

if (missing.length) {
  console.error("Arquivos obrigatórios ausentes:");
  for (const file of missing) console.error(` - ${file}`);
  process.exit(1);
}

console.log("Estrutura estática e função de saúde verificadas.");
console.log("A conexão com Neon deve ser validada em /api/v1/health após configurar DATABASE_URL.");
