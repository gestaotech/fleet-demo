"use strict";

/*
 * Validação de usuários e permissões (criação e edição).
 *
 * Regras preservadas da demonstração (js/core/access.js):
 *  - login de 3 a 20 caracteres (letras, números, ponto, hífen, sublinhado), único;
 *  - nome com pelo menos 3 caracteres e cargo obrigatório;
 *  - permissões restritas à lista de módulos conhecidos;
 *  - sempre deve existir ao menos um administrador ativo na empresa.
 *
 * Regra nova: a senha passa a ter mínimo de 10 caracteres (antes 6). A senha é
 * tratada apenas aqui e em lib/security.js: nunca é gravada em texto nem retornada.
 */

const { ApiError } = require("./errors");
const { MODULOS, permissoesValidas } = require("./permissions");
const { validarPoliticaSenha } = require("./security");

const LOGIN_FORMATO = /^[a-z0-9._-]{3,20}$/;
const UUID_FORMATO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function texto(valor) {
  return typeof valor === "string" ? valor.trim().replace(/\s+/g, " ") : "";
}

function validarIdentificador(id) {
  if (typeof id !== "string" || !UUID_FORMATO.test(id)) {
    throw new ApiError(400, "IDENTIFICADOR_INVALIDO", "Identificador inválido.");
  }
  return id;
}

/*
 * Valida o corpo da criação. Retorna o objeto normalizado.
 * Lança ApiError 422 com a primeira falha encontrada (mensagens em português).
 */
function validarNovoUsuario(corpo) {
  const erros = [];
  const login = texto(corpo.login).toLowerCase();
  const nome = texto(corpo.nome);
  const cargo = texto(corpo.cargo);
  const senha = typeof corpo.senha === "string" ? corpo.senha : "";
  const permissoes = Array.isArray(corpo.permissoes) ? [...new Set(corpo.permissoes)] : null;

  if (!LOGIN_FORMATO.test(login)) {
    erros.push("Usuário de acesso deve ter de 3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado.");
  }
  if (nome.length < 3 || nome.length > 120) erros.push("Informe o nome do usuário (de 3 a 120 caracteres).");
  if (!cargo || cargo.length > 80) erros.push("Informe o cargo ou função (até 80 caracteres).");
  const falhaSenha = validarPoliticaSenha(senha);
  if (falhaSenha) erros.push(falhaSenha);
  if (permissoes === null || !permissoesValidas(permissoes)) {
    erros.push(`Permissões inválidas. Use somente: ${MODULOS.join(", ")}.`);
  }
  if (typeof corpo.ativo !== "undefined" && typeof corpo.ativo !== "boolean") {
    erros.push("O campo ativo deve ser verdadeiro ou falso.");
  }

  if (erros.length) throw new ApiError(422, "DADOS_INVALIDOS", erros[0], { campos: erros });
  return {
    login,
    nome,
    cargo,
    senha,
    permissoes: permissoes || [],
    ativo: corpo.ativo !== false,
  };
}

/*
 * Valida a edição parcial. Campos ausentes mantêm o valor atual.
 * Senha é opcional na edição; quando informada, passa pela mesma política.
 */
function validarEdicao(corpo, atual) {
  const erros = [];
  const alteracoes = {};

  if (corpo.nome !== undefined) {
    const nome = texto(corpo.nome);
    if (nome.length < 3 || nome.length > 120) erros.push("Informe o nome do usuário (de 3 a 120 caracteres).");
    else alteracoes.nome = nome;
  }
  if (corpo.cargo !== undefined) {
    const cargo = texto(corpo.cargo);
    if (!cargo || cargo.length > 80) erros.push("Informe o cargo ou função (até 80 caracteres).");
    else alteracoes.cargo = cargo;
  }
  if (corpo.permissoes !== undefined) {
    if (!Array.isArray(corpo.permissoes) || !permissoesValidas(corpo.permissoes)) {
      erros.push(`Permissões inválidas. Use somente: ${MODULOS.join(", ")}.`);
    } else {
      alteracoes.permissoes = [...new Set(corpo.permissoes)];
    }
  }
  if (corpo.ativo !== undefined) {
    if (typeof corpo.ativo !== "boolean") erros.push("O campo ativo deve ser verdadeiro ou falso.");
    else alteracoes.ativo = corpo.ativo;
  }
  if (corpo.senha !== undefined && corpo.senha !== "") {
    const falhaSenha = validarPoliticaSenha(corpo.senha);
    if (falhaSenha) erros.push(falhaSenha);
    else alteracoes.senha = corpo.senha;
  }

  if (erros.length) throw new ApiError(422, "DADOS_INVALIDOS", erros[0], { campos: erros });

  const final = {
    nome: alteracoes.nome ?? atual.nome,
    cargo: alteracoes.cargo ?? atual.cargo,
    permissoes: alteracoes.permissoes ?? atual.permissoes,
    ativo: alteracoes.ativo ?? atual.ativo,
  };
  return { final, senha: alteracoes.senha || null, camposAlterados: Object.keys(alteracoes) };
}

/*
 * Confirma que a edição não deixa a empresa sem administrador ativo.
 * `outrosAdministradoresAtivos` é a contagem feita no banco, excluindo o usuário editado.
 */
function validarAdministradorRestante(final, eraAdministradorAtivo, outrosAdministradoresAtivos) {
  const continuaAdministrador = final.ativo && final.permissoes.includes("admin");
  if (eraAdministradorAtivo && !continuaAdministrador && outrosAdministradoresAtivos === 0) {
    throw new ApiError(422, "ULTIMO_ADMINISTRADOR", "Mantenha ao menos um administrador ativo na empresa.");
  }
}

module.exports = {
  LOGIN_FORMATO,
  UUID_FORMATO,
  validarIdentificador,
  validarNovoUsuario,
  validarEdicao,
  validarAdministradorRestante,
};
