import type { NextConfig } from "next";

/*
 * Configuracao do Next.js.
 *
 * serverExternalPackages: mantem Prisma e o hash de senha (modulo nativo) fora do
 * bundle do servidor. Sem isso o build pode tentar empacotar binarios nativos.
 *
 * Cabecalhos de seguranca: reduzem clickjacking, sniffing de conteudo e vazamento
 * de referrer. Uma CSP com nonce sera adicionada quando houver necessidade de
 * scripts externos; hoje o app nao carrega terceiros.
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
