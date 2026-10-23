import { vi, beforeEach } from "vitest";

(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-secret-test-secret-test-secret-test-32";
process.env.IP_HASH_SALT = process.env.IP_HASH_SALT ?? "test-salt";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined }),
  headers: async () => new Headers(),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
