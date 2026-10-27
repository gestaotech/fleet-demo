"use strict";

/*
 * Verificação executada antes dos testes de integração.
 *
 * Os testes criam dados e, com TEST_DATABASE_RESET=sim, recriam o schema público.
 * Por isso exigimos uma URL de teste separada da URL da aplicação, para evitar
 * que um teste apague dados de desenvolvimento ou de produção por engano.
 *
 * Alternativas locais: um PostgreSQL instalado na máquina ou um branch de teste do Neon.
 */

require("../lib/load-env").carregarEnv();

const teste = process.env.TEST_DATABASE_URL;
const app = process.env.DATABASE_URL;

if (!teste) {
  console.error("Testes de integração não executados: defina TEST_DATABASE_URL (banco descartável).");
  process.exit(1);
}
if (teste === app) {
  console.error("Recusado: TEST_DATABASE_URL é igual a DATABASE_URL. Use um banco separado.");
  process.exit(1);
}
if (process.env.TEST_DATABASE_RESET !== "sim") {
  console.error("Recusado: defina TEST_DATABASE_RESET=sim para confirmar que o schema público do banco de teste pode ser recriado.");
  process.exit(1);
}
console.log("Banco de teste configurado; executando testes de integração.");
