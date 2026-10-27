"use strict";

/*
 * Cria o PRIMEIRO administrador de uma empresa, inclusive em produção.
 *
 * Diferente do seed de demonstração, não grava estado operacional nem usuários de
 * exemplo: cria apenas empresa (se não existir), usuário e vínculo com todos os módulos.
 *
 * Proteções:
 *  - exige CONFIRMAR_CRIACAO_ADMIN=sim;
 *  - a senha vem de ADMIN_SENHA (mínimo de 10 caracteres) e nunca é impressa;
 *  - não altera usuário existente: se o login já existir, o script para sem alterar nada;
 *  - grava auditoria ADMIN_CRIADO_PELO_SCRIPT (sem senha).
 *
 * Uso (variáveis apenas na sessão do terminal, nunca em arquivos versionados):
 *   CONFIRMAR_CRIACAO_ADMIN=sim ADMIN_LOGIN=... ADMIN_NOME=... ADMIN_SENHA=... \
 *   EMPRESA_NOME=... EMPRESA_SLUG=... node scripts/criar-admin.js
 */

require("../lib/load-env").carregarEnv();

const { hashPassword, validarPoliticaSenha } = require("../lib/security");
const { MODULOS } = require("../lib/permissions");

async function main() {
  if (process.env.CONFIRMAR_CRIACAO_ADMIN !== "sim") {
    throw new Error("Defina CONFIRMAR_CRIACAO_ADMIN=sim para confirmar a criação do administrador.");
  }
  const login = (process.env.ADMIN_LOGIN || "").trim().toLowerCase();
  const nome = (process.env.ADMIN_NOME || "").trim();
  const senha = process.env.ADMIN_SENHA || "";
  const empresaNome = (process.env.EMPRESA_NOME || "").trim();
  const empresaSlug = (process.env.EMPRESA_SLUG || "").trim().toLowerCase();

  if (!/^[a-z0-9._-]{3,20}$/.test(login)) throw new Error("ADMIN_LOGIN inválido (3 a 20 caracteres: letras, números, ponto, hífen ou sublinhado).");
  if (nome.length < 3) throw new Error("ADMIN_NOME deve ter pelo menos 3 caracteres.");
  const falhaSenha = validarPoliticaSenha(senha);
  if (falhaSenha) throw new Error(`ADMIN_SENHA: ${falhaSenha}`);
  if (!empresaNome) throw new Error("Informe EMPRESA_NOME.");
  if (!/^[a-z0-9-]{3,60}$/.test(empresaSlug)) throw new Error("EMPRESA_SLUG inválido (letras minúsculas, números e hífen).");

  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL.");

  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("BEGIN");
    const existente = await client.query("SELECT id FROM app_users WHERE login = $1", [login]);
    if (existente.rows[0]) {
      await client.query("ROLLBACK");
      console.log("Usuário já existe. Nada foi alterado.");
      return;
    }

    const empresa = await client.query(
      `INSERT INTO companies (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = companies.name
       RETURNING id`,
      [empresaNome, empresaSlug],
    );
    const empresaId = empresa.rows[0].id;

    const usuario = await client.query(
      "INSERT INTO app_users (login, name, cargo, password_hash, active) VALUES ($1, $2, 'Administrador', $3, TRUE) RETURNING id",
      [login, nome, hashPassword(senha)],
    );
    const usuarioId = usuario.rows[0].id;

    await client.query(
      "INSERT INTO company_memberships (user_id, company_id, role, active, permissions) VALUES ($1, $2, 'OWNER', TRUE, $3)",
      [usuarioId, empresaId, `{${MODULOS.join(",")}}`],
    );
    await client.query(
      `INSERT INTO audit_logs (company_id, actor_user_id, action, entity, entity_id, result, metadata)
       VALUES ($1, NULL, 'ADMIN_CRIADO_PELO_SCRIPT', 'app_users', $2, 'SUCCESS', $3::jsonb)`,
      [empresaId, usuarioId, JSON.stringify({ login })],
    );
    await client.query("COMMIT");
    console.log(`Administrador criado: ${login} (empresa: ${empresaSlug}). A senha não foi exibida.`);
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exitCode = 1;
});
