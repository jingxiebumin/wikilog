import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repositoryState = vi.hoisted(() => ({ database: undefined as PGlite | undefined }));

vi.mock("@/lib/db", () => ({
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => repositoryState.database!.query(...args),
    connect: async () => ({
      query: (...args: Parameters<PGlite["query"]>) => repositoryState.database!.query(...args),
      release: () => undefined,
    }),
  },
}));

import { deleteAccount } from "./repository";

describe("reader account removal", () => {
  let database: PGlite;
  let adminId: string;
  let readerId: string;

  beforeEach(async () => {
    database = new PGlite();
    repositoryState.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    adminId = admin.rows[0].id;
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    readerId = reader.rows[0].id;
    await database.query(`
      INSERT INTO reader_sessions (user_id, token_hash, expires_at)
      VALUES ($1, 'reader-session-hash', now() + interval '1 day')
    `, [readerId]);
    await database.query(`
      INSERT INTO admin_password_resets (operator_user_id, target_user_id, target_email, reason, result)
      VALUES ($1, $2, 'reader@example.test', '线下确认', 'success')
    `, [adminId, readerId]);
  });

  afterEach(async () => {
    repositoryState.database = undefined;
    await database.close();
  });

  it("cascades reader sessions and keeps the reset audit snapshot", async () => {
    await deleteAccount(readerId);

    const users = await database.query<{ id: string }>("SELECT id FROM users WHERE id = $1", [readerId]);
    const sessions = await database.query<{ id: string }>("SELECT id FROM reader_sessions WHERE user_id = $1", [readerId]);
    const audits = await database.query<{ target_user_id: string | null; target_email: string }>(`
      SELECT target_user_id, target_email FROM admin_password_resets WHERE operator_user_id = $1
    `, [adminId]);
    expect(users.rows).toEqual([]);
    expect(sessions.rows).toEqual([]);
    expect(audits.rows).toEqual([{ target_user_id: null, target_email: "reader@example.test" }]);
  });
});
