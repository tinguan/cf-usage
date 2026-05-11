import { drizzle } from "drizzle-orm/d1";
import { getRequestContext } from "@cloudflare/next-on-pages";
import * as schema from "./schema";

export type AppDB = ReturnType<typeof getDb>;

export function getDb() {
  const ctx = getRequestContext();
  const binding = (ctx.env as Record<string, unknown>)["DB"] as D1Database;
  if (!binding) throw new Error("D1 binding 'DB' not found in environment");
  return drizzle(binding, { schema });
}

// Re-export schema for convenience
export * from "./schema";

