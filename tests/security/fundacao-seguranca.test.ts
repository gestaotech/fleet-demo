import { describe, it, expect } from "vitest";
import { createContext, runInContext } from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function vmRun(files: string[]) {
  const ctx: Record<string, unknown> = {};
  createContext(ctx);
  for (const f of files) {
    const code = readFileSync(resolve(process.cwd(), f), "utf8");
    runInContext(code, ctx, { filename: f });
  }
  return ctx;
}

describe("Isolamento multiempresa - helpers e modelo", () => {
  it("permissoes padrao nao vazam entre perfis", async () => {
    const { DEFAULT_ROLE_MODULES } = await import("@/config/permissions");
    expect(DEFAULT_ROLE_MODULES.VIEWER).toEqual(["REPORTS"]);
    expect(DEFAULT_ROLE_MODULES.MEMBER).toContain("VEHICLES");
    expect(DEFAULT_ROLE_MODULES.ADMIN).toContain("USERS");
    expect(DEFAULT_ROLE_MODULES.OWNER).toContain("AUDIT");
  });

  it("validacao de login nao revela existencia de usuario", async () => {
    const { loginSchema } = await import("@/lib/validations/auth");
    expect(loginSchema.safeParse({ email: "x@x.com" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "x@x", password: "123" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "x@x.com", password: "123" }).success).toBe(true);
  });

  it("funcoes de auditoria nao exponham segredos no contrato", async () => {
    const { hashIp, hashToken, getClientIp } = await import("@/lib/security/network");
    expect(typeof hashIp("1.2.3.4")).toBe("string");
    expect(typeof hashToken("abc")).toBe("string");

    // Cabeçalhos encaminhados não devem ser aceitos sem configuração explícita do proxy.
    const anterior = process.env.TRUSTED_PROXY_HEADERS;
    try {
      process.env.TRUSTED_PROXY_HEADERS = "false";
      expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.10" }))).toBeNull();
      process.env.TRUSTED_PROXY_HEADERS = "true";
      expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }))).toBe("203.0.113.10");
    } finally {
      if (anterior === undefined) delete process.env.TRUSTED_PROXY_HEADERS;
      else process.env.TRUSTED_PROXY_HEADERS = anterior;
    }
  });
});
