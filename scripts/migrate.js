"use strict";

/*
 * Aplica as migrações SQL de database/migrations/ em ordem alfabética.
 *
 * - Cada arquivo roda em uma transação; se falhar, nada do arquivo é gravado.
 * - Registros aplicados ficam em schema_migrations; migrações já aplicadas são puladas.
 * - Usa o driver pg (protocolo PostgreSQL padrão, aceito pelo Neon). As funções
 *   serverless usam @neondatabase/serverless; migrações não precisam dele.
 * - A URL é lida de MIGRATION_DATABASE_URL ou DATABASE_URL e NUNCA é impressa.
 *
 * Uso: npm run db:migrate
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

require("../lib/load-env").carregarEnv();

const MIGRATIONS_DIR = path.join(__dirname, "..", "database", "migrations");

function carregarUrl() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Defina MIGRATION_DATABASE_URL ou DATABASE_URL (veja .env.example).");
  }
  return url;
}

/* Aplica as migrações pendentes na URL informada. Usado pelo CLI e pelos testes de integração. */
async function aplicarMigracoes(url, { log = console.log } = {}) {
  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);

    const { rows } = await client.query("SELECT version, checksum FROM schema_migrations");
    const aplicadas = new Map(rows.map((r) => [r.version, r.checksum]));

    const arquivos = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((nome) => nome.endsWith(".sql"))
      .sort();

    let novas = 0;
    for (const arquivo of arquivos) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, arquivo), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");

      if (aplicadas.has(arquivo)) {
        if (aplicadas.get(arquivo) !== checksum) {
          throw new Error(
            `A migração ${arquivo} já foi aplicada e foi alterada depois. Crie uma nova migração em vez de editar esta.`,
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
          [arquivo, checksum],
        );
        await client.query("COMMIT");
        novas += 1;
        log(`Aplicada: ${arquivo}`);
      } catch (erro) {
        await client.query("ROLLBACK");
        throw new Error(`Falha na migração ${arquivo}: ${erro.message}`);
      }
    }

    log(novas ? `${novas} migração(ões) aplicada(s).` : "Banco já está atualizado.");
    return { aplicadas: novas };
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  aplicarMigracoes(carregarUrl()).catch((erro) => {
    console.error(erro.message);
    process.exitCode = 1;
  });
}

module.exports = { aplicarMigracoes, MIGRATIONS_DIR };
