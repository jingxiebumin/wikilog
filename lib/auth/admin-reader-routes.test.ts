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
  let resetRoute: typeof import("@/app/api/admin/readers/[id]/reset-password/route");
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
    resetRoute = await import("@/app/api/admin/readers/[id]/reset-password/route");
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

  it("hides every reader management write from anonymous and reader sessions", async () => {
    const disableRoute = await import("@/app/api/admin/readers/[id]/disable/route");
    const requests = [
      () => listRoute.POST(new Request("http://localhost/api/admin/readers", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" })),
      () => readerRoute.PATCH(new Request("http://localhost/api/admin/readers/id", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{" }), { params: Promise.resolve({ id: readerId }) }),
      () => readerRoute.DELETE(new Request("http://localhost/api/admin/readers/id", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{" }), { params: Promise.resolve({ id: readerId }) }),
      () => resetRoute.POST(new Request("http://localhost/api/admin/readers/id/reset-password", { method: "POST" }), { params: Promise.resolve({ id: readerId }) }),
      () => restoreRoute.POST(new Request("http://localhost/api/admin/readers/id/restore", { method: "POST" }), { params: Promise.resolve({ id: readerId }) }),
      () => disableRoute.POST(),
    ];

    for (const token of ["unknown-session", "reader-session-token"]) {
      state.token = token;
      for (const request of requests) expect((await request()).status).toBe(404);
    }
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

  it("limits reader creation by email and source IP", async () => {
    vi.stubEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", "1");
    vi.stubEnv("AUTH_ADMIN_MANAGE_IP_LIMIT", "30");
    vi.resetModules();
    listRoute = await import("@/app/api/admin/readers/route");
    const create = () => listRoute.POST(new Request("http://localhost/api/admin/readers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.41" },
      body: JSON.stringify({ email: "limited@example.test" }),
    }));

    expect((await create()).status).toBe(201);
    const blocked = await create();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    const accounts = await database.query<{ count: number }>("SELECT count(*)::int AS count FROM users WHERE lower(email) = 'limited@example.test'");
    expect(accounts.rows[0].count).toBe(1);
  });

  it("applies the shared source IP limit to profile, reset, deletion, and restore routes", async () => {
    vi.stubEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", "30");
    vi.stubEnv("AUTH_ADMIN_MANAGE_IP_LIMIT", "1");
    vi.resetModules();
    listRoute = await import("@/app/api/admin/readers/route");
    readerRoute = await import("@/app/api/admin/readers/[id]/route");
    resetRoute = await import("@/app/api/admin/readers/[id]/reset-password/route");
    restoreRoute = await import("@/app/api/admin/readers/[id]/restore/route");
    const ip = "203.0.113.42";
    const created = await listRoute.POST(new Request("http://localhost/api/admin/readers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: "ip-limited@example.test" }),
    }));
    expect(created.status).toBe(201);

    const edit = await readerRoute.PATCH(new Request("http://localhost/api/admin/readers/id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: "reader@example.test", displayName: "Changed" }),
    }), { params: Promise.resolve({ id: readerId }) });
    const reset = await resetRoute.POST(new Request("http://localhost/api/admin/readers/id/reset-password", {
      method: "POST", headers: { "x-forwarded-for": ip },
    }), { params: Promise.resolve({ id: readerId }) });
    const deletion = await readerRoute.DELETE(new Request("http://localhost/api/admin/readers/id", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ reason: "测试" }),
    }), { params: Promise.resolve({ id: readerId }) });
    const restore = await restoreRoute.POST(new Request("http://localhost/api/admin/readers/id/restore", {
      method: "POST", headers: { "x-forwarded-for": ip },
    }), { params: Promise.resolve({ id: readerId }) });

    expect([edit.status, reset.status, deletion.status, restore.status]).toEqual([429, 429, 429, 429]);
    expect([edit, reset, deletion, restore].every((response) => Boolean(response.headers.get("retry-after")))).toBe(true);
  });

  it("rejects invalid reader profile data without changing the account", async () => {
    const response = await readerRoute.PATCH(new Request("http://localhost/api/admin/readers/id", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "reader@example.test", displayName: "Changed", phone: "123", gender: "not-a-choice" }),
    }), { params: Promise.resolve({ id: readerId }) });

    expect(response.status).toBe(400);
    const reader = await database.query<{ email: string; display_name: string; updated_at: Date }>(
      "SELECT email, display_name, updated_at FROM users WHERE id = $1", [readerId],
    );
    expect(reader.rows[0]).toMatchObject({ email: "reader@example.test", display_name: "Reader" });
  });

  it("keeps reader lifecycle changes in users audit fields and revokes sessions", async () => {
    const created = await listRoute.POST(new Request("http://localhost/api/admin/readers", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.8" },
      body: JSON.stringify({ email: "lifecycle@example.test" }),
    }));
    expect(created.status).toBe(201);
    const createdUser = (await created.json()).user as { id: string };
    const initial = await database.query<{ created_by: string; updated_by: string; created_at: Date; updated_at: Date }>(
      "SELECT created_by, updated_by, created_at, updated_at FROM users WHERE id = $1", [createdUser.id],
    );
    expect(initial.rows[0]).toMatchObject({ created_by: adminId, updated_by: adminId });
    expect(initial.rows[0].created_at).toEqual(initial.rows[0].updated_at);

    const otherToken = "lifecycle-other-session";
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [
      createdUser.id,
      tokenHash(otherToken),
    ]);
    const edited = await readerRoute.PATCH(new Request("http://localhost/api/admin/readers/reader", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.8" },
      body: JSON.stringify({
        email: "lifecycle-updated@example.test",
        displayName: "Lifecycle Reader",
        phone: "+8613812345678",
        gender: "other",
        role: "admin",
        introduction: "管理员不能编辑此项",
      }),
    }), { params: Promise.resolve({ id: createdUser.id }) });
    expect(edited.status).toBe(200);
    await expect(edited.json()).resolves.toMatchObject({
      user: { email: "lifecycle-updated@example.test", displayName: "Lifecycle Reader", role: "reader", phone: "+8613812345678", gender: "other" },
    });
    const afterEdit = await database.query<{ updated_by: string; email: string; role: string; introduction: string | null; active_sessions: number }>(`
      SELECT users.updated_by, users.email, users.role, users.introduction,
        (SELECT count(*)::int FROM reader_sessions WHERE user_id = users.id AND revoked_at IS NULL) AS active_sessions
      FROM users WHERE users.id = $1
    `, [createdUser.id]);
    expect(afterEdit.rows[0]).toEqual({
      updated_by: adminId,
      email: "lifecycle-updated@example.test",
      role: "reader",
      introduction: null,
      active_sessions: 0,
    });

    const reset = await resetRoute.POST(new Request("http://localhost/api/admin/readers/reader/reset-password", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.8" },
    }), { params: Promise.resolve({ id: createdUser.id }) });
    expect(reset.status).toBe(200);
    const afterReset = await database.query<{ updated_by: string; password_reset_required: boolean; active_sessions: number }>(`
      SELECT updated_by, password_reset_required,
        (SELECT count(*)::int FROM reader_sessions WHERE user_id = users.id AND revoked_at IS NULL) AS active_sessions
      FROM users WHERE id = $1
    `, [createdUser.id]);
    expect(afterReset.rows[0]).toEqual({ updated_by: adminId, password_reset_required: true, active_sessions: 0 });

    const deletion = await readerRoute.DELETE(new Request("http://localhost/api/admin/readers/reader", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.8" },
      body: JSON.stringify({ reason: "测试删除原因" }),
    }), { params: Promise.resolve({ id: createdUser.id }) });
    expect(deletion.status).toBe(200);
    const deleted = await database.query<{ updated_by: string; del_flag: boolean; deleted_reason: string; active_sessions: number }>(`
      SELECT updated_by, del_flag, deleted_reason,
        (SELECT count(*)::int FROM reader_sessions WHERE user_id = users.id AND revoked_at IS NULL) AS active_sessions
      FROM users WHERE id = $1
    `, [createdUser.id]);
    expect(deleted.rows[0]).toEqual({ updated_by: adminId, del_flag: true, deleted_reason: "测试删除原因", active_sessions: 0 });

    const restored = await restoreRoute.POST(new Request("http://localhost/api/admin/readers/reader/restore", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.8" },
    }), { params: Promise.resolve({ id: createdUser.id }) });
    expect(restored.status).toBe(200);
    const finalUser = await database.query<{ updated_by: string; del_flag: boolean; deleted_reason: string | null; active_sessions: number }>(`
      SELECT updated_by, del_flag, deleted_reason,
        (SELECT count(*)::int FROM reader_sessions WHERE user_id = users.id AND revoked_at IS NULL) AS active_sessions
      FROM users WHERE id = $1
    `, [createdUser.id]);
    expect(finalUser.rows[0]).toEqual({ updated_by: adminId, del_flag: false, deleted_reason: null, active_sessions: 0 });

    const operationLogs = await database.query<{ count: number }>(`
      SELECT (
        (SELECT count(*) FROM admin_password_resets) +
        (SELECT count(*) FROM admin_reader_profile_changes) +
        (SELECT count(*) FROM admin_reader_status_changes)
      )::int AS count
    `);
    expect(operationLogs.rows[0].count).toBe(0);
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
