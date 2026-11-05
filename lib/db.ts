import "server-only";
import { Pool } from "pg";

const globalForPostgres = globalThis as typeof globalThis & {
  wikilogPool?: Pool;
};

export const hasDatabase = Boolean(process.env.DATABASE_URL);

export const pool = hasDatabase
  ? globalForPostgres.wikilogPool ?? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "wikilog-web",
    })
  : null;

if (pool && process.env.NODE_ENV !== "production") {
  globalForPostgres.wikilogPool = pool;
}
