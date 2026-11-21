import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ database: undefined as PGlite | undefined, token: "profile-session-token" }));

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

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: state.token }) }),
}));

describe("personal profile API", () => {
  let database: PGlite;
  let userId: string;
  let route: typeof import("@/app/api/auth/profile/route");
  let avatarRoute: typeof import("@/app/api/auth/avatar/route");

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("AUTH_ENABLED", "true");
    database = new PGlite();
    state.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0008_personal_center.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    const otherReader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('other-reader@example.test', 'Other Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    userId = reader.rows[0].id;
    const tokenHash = createHash("sha256").update(state.token).digest("hex");
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [userId, tokenHash]);
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [otherReader.rows[0].id, createHash("sha256").update("other-reader-session-token").digest("hex")]);
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [admin.rows[0].id, createHash("sha256").update("admin-session-token").digest("hex")]);
    route = await import("@/app/api/auth/profile/route");
    avatarRoute = await import("@/app/api/auth/avatar/route");
  });

  afterEach(async () => {
    state.database = undefined;
    vi.unstubAllEnvs();
    await database.close();
  });

  it("returns the signed-in user's private profile", async () => {
    const response = await route.GET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { id: userId, email: "reader@example.test", displayName: "Reader", phone: null },
    });
  });

  it("updates the signed-in user's profile and returns the new values", async () => {
    const response = await route.PATCH(new Request("http://localhost/api/auth/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Updated", phone: "13812345678", gender: "female", introduction: "仅本人可见" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: { id: userId, displayName: "Updated", phone: "13812345678", gender: "female", introduction: "仅本人可见" },
    });
  });

  it("revokes every session and clears the current cookie after an email change", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    await database.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, await hashPassword("correct-password")]);
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [
      userId,
      createHash("sha256").update("other-session-token").digest("hex"),
    ]);
    const emailRoute = await import("@/app/api/auth/email/route");
    const response = await emailRoute.POST(new Request("http://localhost/api/auth/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "correct-password", email: "new@example.test" }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    const sessions = await database.query<{ active: number }>("SELECT count(*)::int AS active FROM reader_sessions WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    expect(sessions.rows[0].active).toBe(0);
  });

  it("keeps the current session and revokes other sessions after a regular password change", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    await database.query("UPDATE users SET password_hash = $2 WHERE id = $1", [userId, await hashPassword("correct-password")]);
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [
      userId,
      createHash("sha256").update("other-session-token").digest("hex"),
    ]);
    const passwordRoute = await import("@/app/api/auth/password/route");
    const response = await passwordRoute.POST(new Request("http://localhost/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "correct-password", password: "new-correct-password", confirmation: "new-correct-password" }),
    }));

    expect(response.status).toBe(200);
    const sessions = await database.query<{ token_hash: string; revoked_at: Date | null }>("SELECT token_hash, revoked_at FROM reader_sessions WHERE user_id = $1 ORDER BY created_at, id", [userId]);
    expect(sessions.rows).toHaveLength(2);
    expect(sessions.rows.find((row) => row.token_hash === createHash("sha256").update(state.token).digest("hex"))?.revoked_at).toBeNull();
    expect(sessions.rows.find((row) => row.token_hash === createHash("sha256").update("other-session-token").digest("hex"))?.revoked_at).not.toBeNull();
  });

  it("rotates the current session after a required first-login password change", async () => {
    const { hashPassword } = await import("@/lib/auth/password");
    await database.query("UPDATE users SET password_hash = $2, password_reset_required = true WHERE id = $1", [userId, await hashPassword("initial-password")]);
    const passwordRoute = await import("@/app/api/auth/password/route");
    const response = await passwordRoute.POST(new Request("http://localhost/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: "initial-password", password: "new-correct-password", confirmation: "new-correct-password" }),
    }));

    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("wikilog_reader_session=");
    expect(cookie).not.toContain("Max-Age=0");
    const sessions = await database.query<{ revoked_at: Date | null; token_hash: string }>("SELECT revoked_at, token_hash FROM reader_sessions WHERE user_id = $1 ORDER BY created_at, id", [userId]);
    expect(sessions.rows).toHaveLength(2);
    expect(sessions.rows.find((row) => row.token_hash === createHash("sha256").update(state.token).digest("hex"))?.revoked_at).not.toBeNull();
    expect(sessions.rows.filter((row) => row.revoked_at === null)).toHaveLength(1);
    expect(sessions.rows.find((row) => row.revoked_at === null)?.token_hash).not.toBe(createHash("sha256").update(state.token).digest("hex"));
  });

  it("does not expose an avatar before storage verification is enabled", async () => {
    const form = new FormData();
    form.set("avatar", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "avatar.png", { type: "image/png" }));
    const response = await avatarRoute.POST(new Request("http://localhost/api/auth/avatar", { method: "POST", body: form }));
    expect(response.status).toBe(503);
    expect((await avatarRoute.GET()).status).toBe(404);
  });

  it("lets the owner upload and read a private image", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "wikilog-avatar-api-"));
    vi.stubEnv("AVATAR_STORAGE_DIR", directory);
    vi.stubEnv("AVATAR_STORAGE_VERIFIED", "true");
    try {
      const form = new FormData();
      form.set("avatar", new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "avatar.png", { type: "image/png" }));
      const upload = await avatarRoute.POST(new Request("http://localhost/api/auth/avatar", { method: "POST", body: form }));
      expect(upload.status).toBe(200);
      expect((await upload.json()).avatarKey).toMatch(/^[0-9a-f-]+\.png$/);
      const image = await avatarRoute.GET();
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toBe("image/png");
      expect(image.headers.get("cache-control")).toContain("private");
      expect(new Uint8Array(await image.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
      state.token = "other-reader-session-token";
      expect((await avatarRoute.GET()).status).toBe(404);
      state.token = "admin-session-token";
      expect((await avatarRoute.GET()).status).toBe(404);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
