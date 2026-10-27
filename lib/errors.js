"use strict";

/*
 * Erro de API com status HTTP e código estável para o cliente.
 * A mensagem é sempre segura para exibir ao usuário: detalhes internos (SQL,
 * host, stack) nunca entram em `message` nem são enviados na resposta.
 */
class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

module.exports = { ApiError };
