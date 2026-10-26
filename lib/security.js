"use strict";

/*
 * Primitivas de segurança sem dependências externas.
 *
 * - Senhas: scrypt (nativo do Node) com salt aleatório individual de 16 bytes.
 *   Formato armazenado: scrypt$N$r$p$salt$hash (base64url). Parâmetros ficam no
 *   próprio hash, permitindo elevar o custo no futuro sem quebrar senhas antigas.
 * - Tokens de sessão e de CSRF: 32 bytes aleatórios (crypto.randomBytes).
 *   Apenas o SHA-256 do token de sessão é gravado no banco.
 * - Comparações de segredos usam timingSafeEqual.
 */

const crypto = require("node:crypto");

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };
const TAMANHO_SALT = 16;
const SENHA_MIN = 10;
const SENHA_MAX = 200;

function hashPassword(senha) {
  const salt = crypto.randomBytes(TAMANHO_SALT);
  const derivada = crypto.scryptSync(senha, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    derivada.toString("base64url"),
  ].join("$");
}

function verifyPassword(senha, armazenado) {
  if (typeof senha !== "string" || typeof armazenado !== "string") return false;
  const partes = armazenado.split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const N = Number(partes[1]);
  const r = Number(partes[2]);
  const p = Number(partes[3]);
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > 2 ** 20) return false;
  const salt = Buffer.from(partes[4], "base64url");
  const esperado = Buffer.from(partes[5], "base64url");
  if (salt.length !== TAMANHO_SALT || esperado.length !== SCRYPT.keylen) return false;
  const calculado = crypto.scryptSync(senha, salt, esperado.length, {
    N,
    r,
    p,
    maxmem: SCRYPT.maxmem,
  });
  return crypto.timingSafeEqual(calculado, esperado);
}

let hashFicticio = null;

/*
 * Executa uma verificação completa quando o usuário não existe, para que o tempo
 * de resposta não revele se o login está cadastrado.
 */
function verificarSenhaFicticia(senha) {
  if (!hashFicticio) hashFicticio = hashPassword("senha-ficticia-para-tempo-constante");
  verifyPassword(String(senha), hashFicticio);
  return false;
}

function validarPoliticaSenha(senha) {
  if (typeof senha !== "string") return "Informe a senha.";
  if (senha.length < SENHA_MIN) return `A senha deve ter pelo menos ${SENHA_MIN} caracteres.`;
  if (senha.length > SENHA_MAX) return `A senha deve ter no máximo ${SENHA_MAX} caracteres.`;
  return null;
}

function gerarToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function sha256(valor) {
  return crypto.createHash("sha256").update(String(valor)).digest("hex");
}

function hashComSal(valor) {
  const sal = process.env.IP_HASH_SALT || "";
  return sha256(`${sal}|${valor}`);
}

function iguaisSeguro(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  SENHA_MIN,
  SENHA_MAX,
  hashPassword,
  verifyPassword,
  verificarSenhaFicticia,
  validarPoliticaSenha,
  gerarToken,
  sha256,
  hashComSal,
  iguaisSeguro,
};
