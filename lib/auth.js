"use strict";

/*
 * Autenticação e autorização das rotas protegidas.
 *
 * Toda rota protegida chama exigirSessao(): a identidade vem do cookie validado
 * no banco, nunca de cabeçalhos ou campos enviados pela interface. A empresa usada
 * em consultas é a da sessão, não um companyId informado pelo cliente.
 */

const { ApiError } = require("./errors");
const { lerCookies, COOKIE_SESSAO, COOKIE_CSRF, definirCookie } = require("./http");
const { carregarSessao, ttlHoras } = require("./sessions");
const { gerarToken } = require("./security");
const { temPermissao } = require("./permissions");

async function exigirSessao(req) {
  const token = lerCookies(req)[COOKIE_SESSAO];
  const sessao = token ? await carregarSessao(token) : null;
  if (!sessao) {
    throw new ApiError(401, "NAO_AUTENTICADO", "Sessão inválida ou expirada. Entre novamente.");
  }
  return sessao;
}

function exigirPermissao(sessao, modulo) {
  if (!temPermissao(sessao.permissoes, modulo)) {
    throw new ApiError(403, "SEM_PERMISSAO", "Seu perfil não tem permissão para esta ação.");
  }
}

/* Usuário sem módulo algum não acessa os dados operacionais da empresa. */
function exigirAlgumaPermissao(sessao) {
  if (!sessao.permissoes.length) {
    throw new ApiError(403, "SEM_PERMISSAO", "Seu usuário não possui módulos liberados.");
  }
}

/* Emite um novo token CSRF (legível pela interface) quando o cookie não existe. */
function garantirCookieCsrf(req, res) {
  if (lerCookies(req)[COOKIE_CSRF]) return;
  definirCookie(res, COOKIE_CSRF, gerarToken(), { maxAge: ttlHoras() * 3600, sameSite: "Lax" });
}

module.exports = { exigirSessao, exigirPermissao, exigirAlgumaPermissao, garantirCookieCsrf };
