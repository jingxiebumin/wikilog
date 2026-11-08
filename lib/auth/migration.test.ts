import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("reader account migration", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    await database.query("INSERT INTO users (email, display_name, password_hash, status) VALUES ('legacy@example.test', 'Legacy', 'old-hash', 'pending'), ('broken@example.test', 'Broken', NULL, 'pending')");
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0003_reader_accounts.sql"), "utf8"));
  });

  afterEach(async () => database.close());

  it("removes legacy email verification state and supports sessions/audits", async () => {
    const columns = await database.query<{ column_name: string }>(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('email_verified_at', 'password_reset_required')
    `);
    expect(columns.rows.map((row) => row.column_name)).toEqual(["password_reset_required"]);
    const tables = await database.query<{ table_name: string }>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('reader_sessions', 'admin_password_resets', 'auth_rate_limits')
      ORDER BY table_name
    `);
    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "admin_password_resets",
      "auth_rate_limits",
      "reader_sessions",
    ]);
  });

  it("converts pending accounts safely according to whether a password exists", async () => {
    const users = await database.query<{ email: string; status: string }>(`
      SELECT email, status FROM users WHERE email IN ('legacy@example.test', 'broken@example.test') ORDER BY email
    `);
    expect(users.rows).toEqual([
      { email: "broken@example.test", status: "disabled" },
      { email: "legacy@example.test", status: "active" },
    ]);
  });
});
