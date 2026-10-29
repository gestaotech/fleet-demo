"use strict";

/*
 * Limpeza destrutiva de um banco que contém SOMENTE dados fictícios.
 *
 * Padrão: somente leitura (relatório de contagens).
 * Para executar a limpeza, são obrigatórios:
 *   CONFIRMAR_LIMPEZA_DADOS_FICTICIOS=SIM
 *   CONFIRMAR_NOME_BANCO=<nome exato retornado pelo PostgreSQL>
 *   CONFIRMAR_BACKUP_FEITO=SIM
 *
 * Nunca executa em ambiente Vercel/Node production. Preserva schema_migrations
 * e toda a estrutura do banco. Remove os dados de todas as empresas, usuários,
 * sessões, tentativas de login, estado operacional e auditoria.
 */
require("../lib/load-env").carregarEnv();

const TABELAS = [
  "companies",
  "app_users",
  "company_memberships",
  "app_sessions",
  "login_attempts",
  "fleet_workspace_state",
  "audit_logs",
];

function exigirAmbienteSeguro() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Limpeza bloqueada em ambiente de produção. Execute localmente e confirme o banco de destino.");
  }
}

async function main() {
  exigirAmbienteSeguro();
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL em ambiente local.");

  const { Client } = require("pg");
  const client = new Client({ connectionString: url, application_name: "gestaotech-fleet-fictitious-data-cleanup" });
  await client.connect();

  try {
    const info = await client.query("SELECT current_database() AS database, current_user AS user");
    const banco = info.rows[0].database;
    console.log(`Banco conectado: ${banco}`);
    console.log("Relatório atual (nenhum dado foi alterado):");

    const contagens = {};
    for (const tabela of TABELAS) {
      const resultado = await client.query(`SELECT COUNT(*)::int AS total FROM public."${tabela}"`);
      contagens[tabela] = resultado.rows[0].total;
      console.log(` - ${tabela}: ${contagens[tabela]}`);
    }

    const empresas = await client.query("SELECT name, slug FROM public.companies ORDER BY slug");
    for (const empresa of empresas.rows) {
      console.log(` - empresa: ${empresa.name} (slug: ${empresa.slug})`);
    }

    const autorizado =
      process.env.CONFIRMAR_LIMPEZA_DADOS_FICTICIOS === "SIM" &&
      process.env.CONFIRMAR_NOME_BANCO === banco &&
      process.env.CONFIRMAR_BACKUP_FEITO === "SIM";

    if (!autorizado) {
      console.log("");
      console.log("MODO SOMENTE LEITURA: nada foi apagado.");
      console.log("Após conferir o banco e fazer backup/ponto de restauração, execute novamente com:");
      console.log("CONFIRMAR_LIMPEZA_DADOS_FICTICIOS=SIM");
      console.log(`CONFIRMAR_NOME_BANCO="${banco}"`);
      console.log("CONFIRMAR_BACKUP_FEITO=SIM");
      return;
    }

    await client.query("BEGIN");
    try {
      await client.query(`
        TRUNCATE TABLE
          public.audit_logs,
          public.app_sessions,
          public.company_memberships,
          public.fleet_workspace_state,
          public.login_attempts,
          public.app_users,
          public.companies
        RESTART IDENTITY CASCADE
      `);
      await client.query("COMMIT");
    } catch (erro) {
      await client.query("ROLLBACK");
      throw erro;
    }

    console.log("");
    console.log("Limpeza concluída. Estrutura e schema_migrations foram preservados.");
    for (const tabela of TABELAS) console.log(` - ${tabela}: 0`);
    console.log("O banco agora precisa ser inicializado com um administrador real, usando npm run db:criar-admin.");
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error(`[limpar-dados-ficticios] ${erro.message}`);
  process.exitCode = 1;
});
