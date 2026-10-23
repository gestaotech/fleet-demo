import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/*
 * Testes em tres camadas:
 *  - unit: regras puras (sem banco);
 *  - integration: banco PostgreSQL real (TEST_DATABASE_URL);
 *  - security: autorizacao, isolamento entre empresas, auditoria e sessao.
 *
 * Os testes de integracao sao ignorados automaticamente (com aviso) quando
 * TEST_DATABASE_URL nao esta configurada. Nao existe substituto em memoria:
 * o comportamento transacional e as restricoes do PostgreSQL precisam ser reais.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    hookTimeout: 60_000,
    testTimeout: 30_000,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
