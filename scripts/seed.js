"use strict";

/*
 * Inicialização controlada de DEMONSTRAÇÃO/DESENVOLVIMENTO.
 *
 * Cria (ou atualiza, sem trocar senhas existentes) a empresa, o usuário
 * administrador com todos os módulos e um estado operacional vazio. Nenhuma senha padrão é gravada.
 *
 * Proteções:
 *  - exige ALLOW_SEED=true;
 *  - recusa NODE_ENV=production e VERCEL_ENV=production;
 *  - exige SEED_ADMIN_PASSWORD com a política de senha (mínimo de 10 caracteres);
 *  - não substitui senha de usuário existente (use SEED_RESET_PASSWORD=true
 *    conscientemente) e não sobrescreve dados operacionais existentes
 *    (use SEED_RESET_WORKSPACE=true conscientemente).
 *
 * Uso: npm run db:seed   (depois de npm run db:migrate)
 */

require("../lib/load-env").carregarEnv();

const { hashPassword, validarPoliticaSenha } = require("../lib/security");
const { MODULOS, COLECOES } = require("../lib/permissions");
const { validarEstado } = require("../lib/workspace");

function exigirAmbienteSeguro() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Seed bloqueado em ambiente de produção.");
  }
  if (process.env.ALLOW_SEED !== "true") {
    throw new Error("Seed bloqueado: defina ALLOW_SEED=true para confirmar um banco de desenvolvimento ou teste.");
  }
}

/* Estado inicial vazio: o seed nunca deve inserir veículos, peças ou movimentações fictícias. */
function estadoInicial() {
  return {
    schemaVersion: 2,
    configuracoes: { alertaTrocaOleoKm: 1000, alertaTrocaOleoDias: 30 },
    ...Object.fromEntries(
      COLECOES.filter((colecao) => colecao !== "configuracoes").map((colecao) => [colecao, []]),
    ),
  };
}

async function main() {
  exigirAmbienteSeguro();

  const nomeEmpresa = process.env.SEED_COMPANY_NAME || "Empresa Demonstração";
  const slug = (process.env.SEED_COMPANY_SLUG || "empresa-demonstracao").toLowerCase();
  const login = (process.env.SEED_ADMIN_LOGIN || "admin").trim().toLowerCase();
  const nomeAdmin = process.env.SEED_ADMIN_NAME || "Administrador";
  const senha = process.env.SEED_ADMIN_PASSWORD || "";

  if (!/^[a-z0-9._-]{3,20}$/.test(login)) throw new Error("SEED_ADMIN_LOGIN inválido.");
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) throw new Error("SEED_COMPANY_SLUG inválido.");
  const falhaSenha = validarPoliticaSenha(senha);
  if (falhaSenha) throw new Error(`SEED_ADMIN_PASSWORD: ${falhaSenha}`);

  const estado = estadoInicial();
  const errosEstado = validarEstado(estado);
  if (errosEstado.length) throw new Error(`Estado inicial inválido: ${errosEstado[0]}`);

  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL.");

  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query("BEGIN");

    const empresa = await client.query(
      `INSERT INTO companies (name, slug) VALUES ($1, $2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
       RETURNING id`,
      [nomeEmpresa, slug],
    );
    const empresaId = empresa.rows[0].id;

    const existente = await client.query("SELECT id FROM app_users WHERE login = $1", [login]);
    let usuarioId;
    if (existente.rows[0]) {
      usuarioId = existente.rows[0].id;
      if (process.env.SEED_RESET_PASSWORD === "true") {
        await client.query(
          "UPDATE app_users SET password_hash = $2, active = TRUE, updated_at = NOW() WHERE id = $1",
          [usuarioId, hashPassword(senha)],
        );
        console.warn("[seed] Senha do usuário existente foi redefinida (SEED_RESET_PASSWORD=true).");
      } else {
        console.log("[seed] Usuário já existe; senha preservada.");
      }
    } else {
      const criado = await client.query(
        "INSERT INTO app_users (login, name, cargo, password_hash, active) VALUES ($1, $2, 'Administrador', $3, TRUE) RETURNING id",
        [login, nomeAdmin, hashPassword(senha)],
      );
      usuarioId = criado.rows[0].id;
    }

    // Permissões do administrador: todos os módulos (ver lib/permissions.js).
    await client.query(
      `INSERT INTO company_memberships (user_id, company_id, role, active, permissions)
       VALUES ($1, $2, 'OWNER', TRUE, $3)
       ON CONFLICT (user_id, company_id)
       DO UPDATE SET role = 'OWNER', active = TRUE, permissions = EXCLUDED.permissions, updated_at = NOW()`,
      [usuarioId, empresaId, `{${MODULOS.join(",")}}`],
    );

    const workspace = await client.query(
      "SELECT company_id FROM fleet_workspace_state WHERE company_id = $1",
      [empresaId],
    );
    if (!workspace.rows[0]) {
      await client.query(
        "INSERT INTO fleet_workspace_state (company_id, schema_version, state, revision, updated_by) VALUES ($1, 2, $2::jsonb, 1, $3)",
        [empresaId, JSON.stringify(estado), usuarioId],
      );
      console.log("[seed] Estado operacional inicial vazio criado (sem registros fictícios).");
    } else if (process.env.SEED_RESET_WORKSPACE === "true") {
      await client.query(
        "UPDATE fleet_workspace_state SET state = $2::jsonb, revision = revision + 1, updated_at = NOW() WHERE company_id = $1",
        [empresaId, JSON.stringify(estado)],
      );
      console.warn("[seed] Estado operacional redefinido (SEED_RESET_WORKSPACE=true).");
    } else {
      console.log("[seed] Estado operacional já existe; dados preservados.");
    }

    await client.query("COMMIT");
    console.log(`[seed] Empresa: ${slug} | Usuário administrador: ${login} | Módulos: ${MODULOS.join(", ")}`);
    console.log("[seed] A senha não é exibida. Use a informada em SEED_ADMIN_PASSWORD.");
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error(`[seed] ${erro.message}`);
  process.exitCode = 1;
});
