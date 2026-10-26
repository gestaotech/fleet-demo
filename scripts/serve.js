"use strict";

/*
 * Servidor local que simula a hospedagem da Vercel sem a CLI:
 *  - arquivos estáticos da raiz (index.html, css/, js/, assets/);
 *  - rotas /api/... mapeadas para api/**.js no mesmo formato da Vercel
 *    (api/v1/users/[id].js recebe req.query.id).
 *
 * Uso: npm start -> http://localhost:8080 (variável PORT para outra porta).
 * Requer DATABASE_URL (ou .env.local) para as rotas de API.
 * Para o deploy real use `npm run dev` (vercel dev) ou a própria Vercel.
 */

require("../lib/load-env").carregarEnv();

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 8080;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json; charset=utf-8",
};

const CABECALHOS_SEGURANCA = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/* Resolve /api/v1/x/y para o arquivo de função correspondente. */
function resolverFuncao(pathname) {
  const segmentos = pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  if (!segmentos.length) return null;

  const direto = path.join(RAIZ, "api", ...segmentos) + ".js";
  if (fs.existsSync(direto)) return { arquivo: direto, parametros: {} };

  const indice = path.join(RAIZ, "api", ...segmentos, "index.js");
  if (fs.existsSync(indice)) return { arquivo: indice, parametros: {} };

  const pai = path.join(RAIZ, "api", ...segmentos.slice(0, -1));
  const valor = segmentos[segmentos.length - 1];
  const dinamico = path.join(pai, "[id].js");
  if (segmentos.length >= 2 && fs.existsSync(dinamico)) {
    return { arquivo: dinamico, parametros: { id: valor } };
  }
  return null;
}

function prepararResposta(res) {
  res.status = (codigo) => {
    res.statusCode = codigo;
    return res;
  };
  res.send = (corpo) => res.end(corpo);
  return res;
}

async function rotearApi(req, res, url) {
  const funcao = resolverFuncao(url.pathname);
  if (!funcao) {
    res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { code: "NAO_ENCONTRADO", message: "Rota não encontrada." } }));
    return;
  }
  req.query = { ...Object.fromEntries(url.searchParams), ...funcao.parametros };
  prepararResposta(res);
  const handler = require(funcao.arquivo);
  await handler(req, res);
}

function servirEstatico(req, res, url) {
  const solicitado = decodeURIComponent(url.pathname);
  const arquivo = path.normalize(path.join(RAIZ, solicitado === "/" ? "index.html" : solicitado));
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403, CABECALHOS_SEGURANCA).end("Acesso negado");
    return;
  }
  fs.readFile(arquivo, (erro, dados) => {
    if (erro) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", ...CABECALHOS_SEGURANCA }).end("Não encontrado");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(arquivo)] || "application/octet-stream",
      ...CABECALHOS_SEGURANCA,
    });
    res.end(dados);
  });
}

function criarServidor() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      rotearApi(req, res, url).catch((erro) => {
        console.error("[serve] falha inesperada:", erro && erro.name);
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
          res.end(JSON.stringify({ error: { code: "ERRO_INTERNO", message: "Não foi possível concluir a operação." } }));
        }
      });
      return;
    }
    servirEstatico(req, res, url);
  });
}

if (require.main === module) {
  criarServidor().listen(PORT, () => {
    console.log(`Demonstração disponível em http://localhost:${PORT}`);
  });
}

module.exports = { criarServidor, resolverFuncao };
