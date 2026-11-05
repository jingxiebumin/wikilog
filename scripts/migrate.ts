import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local or export DATABASE_URL.");
}

const pool = new Pool({ connectionString, max: 2, application_name: "wikilog-migrations" });
const migrationsPath = fileURLToPath(new URL("../db/migrations/", import.meta.url));

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = await pool.query<{ name: string }>("SELECT name FROM app_migrations");
  const appliedNames = new Set(applied.rows.map(({ name }) => name));
  const files = (await readdir(migrationsPath))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedNames.has(file)) continue;

    const sql = await readFile(path.join(migrationsPath, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO app_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      process.stdout.write(`Applied ${file}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  if (files.every((file) => appliedNames.has(file))) {
    process.stdout.write("Database schema is up to date.\n");
  }
} finally {
  await pool.end();
}
