import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseState = vi.hoisted(() => ({ database: undefined as PGlite | undefined }));

vi.mock("@/lib/db", () => ({
  hasDatabase: true,
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => databaseState.database!.query(...args),
    connect: async () => ({
      query: (...args: Parameters<PGlite["query"]>) => databaseState.database!.query(...args),
      release: () => undefined,
    }),
  },
}));

describe("personal profile", () => {
  let database: PGlite;
  let userId: string;
  let auth: typeof import("./service");

  beforeEach(async () => {
    vi.resetModules();
    database = new PGlite();
    databaseState.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0008_personal_center.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    userId = reader.rows[0].id;
    auth = await import("./service");
  });

  afterEach(async () => {
    databaseState.database = undefined;
    await database.close();
  });

  it("rejects invalid phone numbers without changing the profile", async () => {
    await expect(auth.updateOwnProfile({
      userId,
      displayName: "Reader",
      phone: "12345",
      gender: "",
      introduction: "",
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });

    const profile = await auth.getOwnProfile(userId);
    expect(profile).toMatchObject({ displayName: "Reader", phone: null });
  });

  it("saves valid private profile fields and clears blank optional values", async () => {
    const profile = await auth.updateOwnProfile({
      userId,
      displayName: "  New Reader ",
      phone: "+8613812345678",
      gender: "undisclosed",
      introduction: "  个人介绍  ",
    });
    expect(profile).toMatchObject({
      displayName: "New Reader",
      phone: "+8613812345678",
      gender: "undisclosed",
      introduction: "个人介绍",
    });

    await expect(auth.updateOwnProfile({
      userId,
      displayName: "New Reader",
      phone: " ",
      gender: "",
      introduction: " ",
    })).resolves.toMatchObject({ phone: null, gender: null, introduction: null });
  });

  it("limits personal introductions by Unicode character count", async () => {
    await expect(auth.updateOwnProfile({
      userId,
      displayName: "Reader",
      phone: "",
      gender: "",
      introduction: "界".repeat(501),
    })).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
