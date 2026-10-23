import { createContext, runInContext } from "node:vm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function vmRun(files: string[]) {
  const ctx: Record<string, unknown> = {};
  createContext(ctx);
  for (const f of files) {
    const code = readFileSync(resolve(process.cwd(), f), "utf8");
    runInContext(code, ctx, { filename: f });
  }
  return ctx;
}
