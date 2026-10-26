import { neon } from "@neondatabase/serverless";

/**
 * Verifica a disponibilidade da função e, quando configurado, a conexão com Neon.
 * Não retorna URL, credenciais ou detalhes internos do banco ao cliente.
 */
export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ ok: false, error: "Método não permitido." });
  }

  if (!process.env.DATABASE_URL) {
    return response.status(503).json({
      ok: false,
      service: "fleet-demo-api",
      database: "not_configured",
    });
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    await sql`SELECT 1 AS healthy`;
    return response.status(200).json({
      ok: true,
      service: "fleet-demo-api",
      database: "connected",
    });
  } catch {
    // Não expor mensagens de erro, host ou detalhes da conexão do banco.
    return response.status(503).json({
      ok: false,
      service: "fleet-demo-api",
      database: "unavailable",
    });
  }
}
