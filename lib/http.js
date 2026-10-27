"use strict";

/*
 * Utilitários HTTP das funções serverless.
 *
 * - Respostas JSON no formato { data } ou { error: { code, message } }.
 * - Somente métodos explicitamente permitidos por rota (405 com cabeçalho Allow).
 * - Corpo JSON com limite de tamanho e content-type validado.
 * - Proteção CSRF por duplo envio (cookie gt_csrf == cabeçalho X-CSRF-Token) e
 *   verificação de origem para requisições que alteram dados.
 * - Cookies com HttpOnly (sessão), Secure e SameSite. O cookie de CSRF não é
 *   HttpOnly, pois o navegador precisa lê-lo para enviar o cabeçalho.
 */

const crypto = require("node:crypto");
const { ApiError } = require("./errors");
const { iguaisSeguro, hashComSal } = require("./security");

const COOKIE_SESSAO = "gt_session";
const COOKIE_CSRF = "gt_csrf";
const METODOS_QUE_ALTERAM = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function aplicarCabecalhosBase(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
}

function enviarJson(res, status, corpo) {
  aplicarCabecalhosBase(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(status).send(JSON.stringify(corpo));
}

function enviarDados(res, status, dados) {
  enviarJson(res, status, { data: dados });
}

/*
 * Resposta de erro. Para status 5xx inclui requestId (o mesmo do cabeçalho X-Request-Id),
 * que permite localizar a linha de log correspondente sem expor detalhes ao cliente.
 * O log registra apenas código, status, rota (sem query) e tipo do erro:
 * mensagens e stack podem conter SQL, parâmetros ou valores de dados.
 */
function enviarErro(res, erro, requestId, rota) {
  const status = erro instanceof ApiError ? erro.status : 500;
  const codigo = erro instanceof ApiError ? erro.code : "ERRO_INTERNO";
  const mensagem =
    erro instanceof ApiError ? erro.message : "Não foi possível concluir a operação.";
  const corpo = { error: { code: codigo, message: mensagem } };
  if (erro instanceof ApiError && erro.extra && Object.keys(erro.extra).length) {
    Object.assign(corpo.error, erro.extra);
  }
  if (status === 405) res.setHeader("Allow", erro.extra.allow || "GET");
  if (status >= 500) {
    if (requestId) corpo.error.requestId = requestId;
    console.error(`[api] requestId=${requestId || "-"} rota=${rota || "-"} status=${status} codigo=${codigo} tipo=${erro && erro.name}`);
  }
  enviarJson(res, status, corpo);
}

/* Caminho da rota sem query string (a query pode conter identificadores de registros). */
function rotaSegura(req) {
  try {
    return new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    return "-";
  }
}

/* Envolve um handler: converte exceções em respostas de erro padronizadas e identificadas. */
function comErros(handler) {
  return async (req, res) => {
    const requestId = crypto.randomUUID();
    res.setHeader("X-Request-Id", requestId);
    try {
      await handler(req, res);
    } catch (erro) {
      enviarErro(res, erro, requestId, rotaSegura(req));
    }
  };
}

function exigirMetodo(req, metodos) {
  if (!metodos.includes(req.method)) {
    throw new ApiError(405, "METODO_NAO_PERMITIDO", "Método não permitido.", {
      allow: metodos.join(", "),
    });
  }
}

function lerCookies(req) {
  const cabecalho = req.headers.cookie || "";
  const cookies = {};
  for (const parte of cabecalho.split(";")) {
    const indice = parte.indexOf("=");
    if (indice === -1) continue;
    const nome = parte.slice(0, indice).trim();
    const valor = parte.slice(indice + 1).trim();
    if (nome && !(nome in cookies)) {
      try {
        cookies[nome] = decodeURIComponent(valor);
      } catch {
        cookies[nome] = "";
      }
    }
  }
  return cookies;
}

function serializarCookie(nome, valor, opcoes = {}) {
  const partes = [`${nome}=${encodeURIComponent(valor)}`, "Path=/"];
  if (opcoes.maxAge !== undefined) partes.push(`Max-Age=${opcoes.maxAge}`);
  if (opcoes.httpOnly) partes.push("HttpOnly");
  if (opcoes.secure !== false) partes.push("Secure");
  partes.push(`SameSite=${opcoes.sameSite || "Lax"}`);
  return partes.join("; ");
}

function definirCookie(res, nome, valor, opcoes) {
  const atuais = res.getHeader("Set-Cookie");
  const lista = Array.isArray(atuais) ? atuais : atuais ? [atuais] : [];
  lista.push(serializarCookie(nome, valor, opcoes));
  res.setHeader("Set-Cookie", lista);
}

function limparCookie(res, nome, opcoes) {
  definirCookie(res, nome, "", { ...opcoes, maxAge: 0 });
}

/* Corpo JSON com limite de bytes. Aceita corpo já interpretado pela plataforma. */
async function lerCorpoJson(req, limiteBytes = 1024 * 1024) {
  const tipo = String(req.headers["content-type"] || "");
  if (tipo && !tipo.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "TIPO_NAO_SUPORTADO", "Envie os dados em JSON.");
  }

  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
      if (Buffer.byteLength(JSON.stringify(req.body)) > limiteBytes) {
        throw new ApiError(413, "CORPO_GRANDE_DEMAIS", "Os dados enviados excedem o limite permitido.");
      }
      return req.body;
    }
    const texto = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : String(req.body);
    if (Buffer.byteLength(texto) > limiteBytes) {
      throw new ApiError(413, "CORPO_GRANDE_DEMAIS", "Os dados enviados excedem o limite permitido.");
    }
    return interpretar(texto);
  }

  const partes = [];
  let total = 0;
  for await (const parte of req) {
    total += parte.length;
    if (total > limiteBytes) {
      throw new ApiError(413, "CORPO_GRANDE_DEMAIS", "Os dados enviados excedem o limite permitido.");
    }
    partes.push(parte);
  }
  return interpretar(Buffer.concat(partes).toString("utf8"));
}

function interpretar(texto) {
  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    throw new ApiError(400, "JSON_INVALIDO", "O corpo da requisição não é um JSON válido.");
  }
}

/* Origem da requisição precisa coincidir com o host quando o navegador a informa. */
function exigirMesmaOrigem(req) {
  const origem = req.headers.origin;
  const site = req.headers["sec-fetch-site"];
  if (site === "cross-site") {
    throw new ApiError(403, "ORIGEM_INVALIDA", "Requisição bloqueada por origem diferente.");
  }
  if (!origem) return;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  let hostOrigem = "";
  try {
    hostOrigem = new URL(origem).host;
  } catch {
    hostOrigem = "";
  }
  if (!hostOrigem || hostOrigem !== String(host).split(",")[0].trim()) {
    throw new ApiError(403, "ORIGEM_INVALIDA", "Requisição bloqueada por origem diferente.");
  }
}

function exigirCsrf(req) {
  const cookie = lerCookies(req)[COOKIE_CSRF];
  const cabecalho = req.headers["x-csrf-token"];
  if (!cookie || !cabecalho || !iguaisSeguro(String(cabecalho), cookie)) {
    throw new ApiError(403, "CSRF_INVALIDO", "Requisição bloqueada. Recarregue a página e tente novamente.");
  }
}

/* Cabeçalhos de alteração passam por origem e CSRF antes de qualquer efeito. */
function protegerAlteracao(req) {
  if (METODOS_QUE_ALTERAM.has(req.method)) {
    exigirMesmaOrigem(req);
    exigirCsrf(req);
  }
}

/*
 * IP do cliente para limite de tentativas. Cabeçalhos encaminhados só são lidos
 * quando TRUSTED_PROXY_HEADERS=true (o proxy da Vercel sobrescreve esses cabeçalhos).
 * O IP é sempre armazenado em hash com salt, nunca em texto.
 */
function ipDoCliente(req) {
  // Na Vercel (VERCEL=1) o proxy da plataforma sempre define x-forwarded-for. Sem isso,
  // todas as requisições compartilhariam o IP do proxy e o limite por IP bloquearia todos.
  if (process.env.TRUSTED_PROXY_HEADERS === "true" || process.env.VERCEL) {
    const encaminhado = req.headers["x-forwarded-for"];
    if (encaminhado) return String(encaminhado).split(",")[0].trim();
    if (req.headers["x-real-ip"]) return String(req.headers["x-real-ip"]).trim();
  }
  return (req.socket && req.socket.remoteAddress) || "desconhecido";
}

function hashIp(req) {
  return hashComSal(ipDoCliente(req));
}

function userAgent(req) {
  const valor = req.headers["user-agent"];
  return valor ? String(valor).slice(0, 255) : null;
}

module.exports = {
  COOKIE_SESSAO,
  COOKIE_CSRF,
  enviarJson,
  enviarDados,
  enviarErro,
  rotaSegura,
  comErros,
  exigirMetodo,
  lerCookies,
  serializarCookie,
  definirCookie,
  limparCookie,
  lerCorpoJson,
  protegerAlteracao,
  exigirMesmaOrigem,
  exigirCsrf,
  ipDoCliente,
  hashIp,
  userAgent,
};
