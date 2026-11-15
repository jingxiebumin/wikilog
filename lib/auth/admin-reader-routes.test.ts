import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ database: undefined as PGlite | undefined, token: "admin-session-token" }));

vi.mock("@/lib/db", () => ({
  hasDatabase: true,
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => state.database!.query(...args),
    connect: async () => ({
      query: (...args: Parameters<PGlite["query"]>) => state.database!.query(...args),
      release: () => undefined,
    }),
  },
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

describe("admin reader account routes", () => {
  let database: PGlite;
  let adminId: string;
  let readerId: string;
  let listRoute: typeof import("@/app/api/admin/readers/route");
  let readerRoute: typeof import("@/app/api/admin/readers/[id]/route");
  let restoreRoute: typeof import("@/app/api/admin/readers/[id]/restore/route");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("AUTH_ENABLED", "true");
    state.token = "admin-session-token";
    database = new PGlite();
    state.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0006_reader_status_audit.sql", "0007_reader_profile_audit.sql", "0008_personal_center.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    adminId = admin.rows[0].id;
    readerId = reader.rows[0].id;
    for (const [userId, token] of [[adminId, "admin-session-token"], [readerId, "reader-session-token"]]) {
      await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [userId, tokenHash(token)]);
    }
    listRoute = await import("@/app/api/admin/readers/route");
    readerRoute = await import("@/app/api/admin/readers/[id]/route");
    restoreRoute = await import("@/app/api/admin/readers/[id]/restore/route");
  });

  afterEach(async () => {
    state.database = undefined;
    vi.unstubAllEnvs();
    await database.close();
  });

  it("hides account management from anonymous and reader sessions", async () => {
    state.token = "unknown-session";
    expect((await listRoute.GET(new Request("http://localhost/api/admin/readers"))).status).toBe(404);
    state.token = "reader-session-token";
    expect((await listRoute.GET(new Request("http://localhost/api/admin/readers"))).status).toBe(404);
  });

  it("creates a reader with the fixed password and requires first-login setup", async () => {
    const response = await listRoute.POST(new Request("http://localhost/api/admin/readers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new-reader@example.test" }),
    }));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ user: { email: "new-reader@example.test", displayName: "", passwordResetRequired: true } });
    const auth = await import("@/lib/auth/service");
    const login = await auth.login({ email: "new-reader@example.test", password: "123456" });
    expect(login).toMatchObject({
      user: { email: "new-reader@example.test", passwordResetRequired: true },
    });
    state.token = login.token;
    const passwordRoute = await import("@/app/api/auth/password/route");
    const missingName = await passwordRoute.POST(new Request("http://localhost/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "123456", password: "my-personal-password", confirmation: "my-personal-password" }),
    }));
    expect(missingName.status).toBe(400);
    const completed = await passwordRoute.POST(new Request("http://localhost/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "New Reader", currentPassword: "123456", password: "my-personal-password", confirmation: "my-personal-password" }),
    }));
    expect(completed.status).toBe(200);
    expect((await auth.login({ email: "new-reader@example.test", password: "my-personal-password" })).user).toMatchObject({
      displayName: "New Reader",
      passwordResetRequired: false,
    });
  });

  it("allows re-registration after soft deletion and refuses restore after the email is reused", async () => {
    const deletion = await readerRoute.DELETE(new Request("http://localhost/api/admin/readers/id", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "账号申请注销" }),
    }), { params: Promise.resolve({ id: readerId }) });
    expect(deletion.status).toBe(200);

    const activeReaders = await listRoute.GET(new Request("http://localhost/api/admin/readers?status=active"));
    const deletedReaders = await listRoute.GET(new Request("http://localhost/api/admin/readers?status=deleted&search=reader"));
    await expect(activeReaders.json()).resolves.toMatchObject({ readers: [] });
    await expect(deletedReaders.json()).resolves.toMatchObject({ readers: [{ id: readerId, delFlag: true, email: "reader@example.test" }] });

    const registration = await listRoute.POST(new Request("http://localhost/api/admin/readers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "reader@example.test" }),
    }));
    expect(registration.status).toBe(201);

    const restore = await restoreRoute.POST(new Request("http://localhost/api/admin/readers/id/restore", { method: "POST" }), {
      params: Promise.resolve({ id: readerId }),
    });
    expect(restore.status).toBe(409);
  });
});
