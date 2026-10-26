"use strict";

/*
 * Limite de tentativas de login persistido no PostgreSQL.
 *
 * Duas chaves são controladas por janela de tempo:
 *  - ip:<hash>      -> muitas tentativas de um mesmo endereço (contra varredura);
 *  - login:<hash>   -> muitas tentativas contra o mesmo usuário (contra força bruta).
 * As chaves são hashes com salt; o IP e o login nunca são gravados em texto.
 *
 * Ao bloquear, a resposta é genérica (429) e não indica se o login existe.
 */

const { consultar } = require("./db");
const { hashComSal } = require("./security");

const POLITICA = Object.freeze({
  janelaMinutos: 15,
  bloqueioMinutos: 15,
  limitePorIp: 30,
  limitePorLogin: 5,
});

function chavesDeLogin(ip, login) {
  return [
    { chave: `ip:${hashComSal(ip)}`, limite: POLITICA.limitePorIp },
    { chave: `login:${hashComSal(login)}`, limite: POLITICA.limitePorLogin },
  ];
}

/* Retorna true quando alguma das chaves está bloqueada no momento. */
async function estaBloqueado(chaves) {
  const linhas = await consultar(
    `SELECT 1 FROM login_attempts
      WHERE key = ANY($1::TEXT[]) AND blocked_until > NOW()
      LIMIT 1`,
    [chaves.map((c) => c.chave)],
  );
  return linhas.length > 0;
}

/*
 * Registra uma falha. Quando a janela expirou, o contador recomeça. Ao atingir o
 * limite, a chave fica bloqueada por bloqueioMinutos.
 */
async function registrarFalha({ chave, limite }) {
  await consultar(
    `INSERT INTO login_attempts AS la (key, failures, window_started_at, blocked_until)
     VALUES ($1, 1, NOW(), CASE WHEN 1 >= $3 THEN NOW() + make_interval(mins => $4) END)
     ON CONFLICT (key) DO UPDATE SET
       failures = CASE WHEN la.window_started_at < NOW() - make_interval(mins => $2)
                       THEN 1 ELSE la.failures + 1 END,
       window_started_at = CASE WHEN la.window_started_at < NOW() - make_interval(mins => $2)
                                THEN NOW() ELSE la.window_started_at END,
       blocked_until = CASE
         WHEN la.window_started_at < NOW() - make_interval(mins => $2)
           THEN CASE WHEN 1 >= $3 THEN NOW() + make_interval(mins => $4) END
         WHEN la.failures + 1 >= $3 THEN NOW() + make_interval(mins => $4)
         ELSE la.blocked_until
       END`,
    [chave, POLITICA.janelaMinutos, limite, POLITICA.bloqueioMinutos],
  );
}

async function registrarFalhas(chaves) {
  for (const item of chaves) {
    await registrarFalha(item);
  }
}

/* Login bem-sucedido zera apenas o contador do próprio login, não o do IP. */
async function limparFalhasDoLogin(login) {
  await consultar("DELETE FROM login_attempts WHERE key = $1", [`login:${hashComSal(login)}`]);
}

module.exports = {
  POLITICA,
  chavesDeLogin,
  estaBloqueado,
  registrarFalhas,
  limparFalhasDoLogin,
};
