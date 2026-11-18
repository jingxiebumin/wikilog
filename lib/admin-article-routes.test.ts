import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
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

describe("admin article routes", () => {
  let database: PGlite;
  let articleRoute: typeof import("@/app/api/admin/articles/route");
  let taxonomyRoute: typeof import("@/app/api/admin/settings/route");
  let adminId: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("AUTH_ENABLED", "true");
    state.token = "admin-session-token";
    database = new PGlite();
    state.database = database;
    const migrationDirectory = path.join(process.cwd(), "db/migrations");
    const migrations = (await readdir(migrationDirectory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const migration of migrations) await database.exec(await readFile(path.join(migrationDirectory, migration), "utf8"));
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    adminId = admin.rows[0].id;
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [adminId, tokenHash("admin-session-token")]);
    await database.query("INSERT INTO categories (slug, name, created_by, updated_by) VALUES ('engineering', '工程实践', $1, $1)", [adminId]);
    articleRoute = await import("@/app/api/admin/articles/route");
    taxonomyRoute = await import("@/app/api/admin/settings/route");
  });

  afterEach(async () => {
    state.database = undefined;
    vi.unstubAllEnvs();
    await database.close();
  });

  it("accepts a valid UTF-8 Markdown upload and preserves its text", async () => {
    const form = new FormData();
    form.set("title", "UTF-8 文章");
    form.set("category", "engineering");
    form.set("publishedAt", "2026-11-18");
    form.set("file", new File(["## 标题\n\n正文包含中文和 emoji 🙂。"], "utf8.md", { type: "text/markdown" }));

    const response = await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", body: form }));

    expect(response.status).toBe(201);
    const saved = await database.query<{ source_mdx: string; created_by: string; updated_by: string }>(`
      SELECT version.source_mdx, article.created_by, article.updated_by
      FROM articles article JOIN article_versions version ON version.id = article.current_published_version_id
      WHERE version.title = 'UTF-8 文章'
    `);
    expect(saved.rows[0]).toMatchObject({ source_mdx: "## 标题\n\n正文包含中文和 emoji 🙂。", created_by: adminId, updated_by: adminId });
  });

  it("rejects Markdown containing invalid UTF-8 bytes before saving the article", async () => {
    const invalidUtf8 = new Uint8Array([0x23, 0x20, 0xc3, 0x28]);
    const form = new FormData();
    form.set("title", "Invalid UTF-8");
    form.set("category", "engineering");
    form.set("publishedAt", "2026-11-18");
    form.set("file", new File([invalidUtf8], "invalid.md", { type: "text/markdown" }));

    const response = await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", body: form }));

    expect(response.status).toBe(400);
    await expect(database.query("SELECT id FROM articles")).resolves.toMatchObject({ rows: [] });
  });

  it("rate limits article writes and records the managing administrator on successful writes", async () => {
    vi.stubEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", "1");
    vi.resetModules();
    articleRoute = await import("@/app/api/admin/articles/route");

    const createForm = () => {
      const form = new FormData();
      form.set("title", "Limited");
      form.set("category", "engineering");
      form.set("publishedAt", "2026-11-18");
      form.set("file", new File(["正文内容。"], "limited.md", { type: "text/markdown" }));
      return form;
    };
    const first = await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", headers: { "x-forwarded-for": "192.0.2.10" }, body: createForm() }));
    const second = await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", headers: { "x-forwarded-for": "192.0.2.10" }, body: createForm() }));

    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
    await expect(database.query("SELECT count(*)::int AS count FROM articles")).resolves.toMatchObject({ rows: [{ count: 1 }] });
    await expect(database.query("SELECT count(*)::int AS count FROM auth_rate_limits")).resolves.toMatchObject({ rows: [{ count: 2 }] });
  });

  it("hides article writes from anonymous and reader sessions", async () => {
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [reader.rows[0].id, tokenHash("reader-session-token")]);
    const form = new FormData();
    form.set("title", "Denied");
    form.set("category", "engineering");
    form.set("publishedAt", "2026-11-18");
    form.set("file", new File(["Body"], "denied.md", { type: "text/markdown" }));

    state.token = "unknown";
    expect((await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", body: form }))).status).toBe(404);
    state.token = "reader-session-token";
    expect((await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", body: form }))).status).toBe(404);
    await expect(database.query("SELECT id FROM articles")).resolves.toMatchObject({ rows: [] });
  });

  it("rate limits taxonomy writes and records the managing administrator", async () => {
    vi.stubEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", "1");
    vi.resetModules();
    taxonomyRoute = await import("@/app/api/admin/settings/route");

    const create = () => taxonomyRoute.POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.20" },
      body: JSON.stringify({ type: "tag", slug: "security", name: "安全" }),
    }));
    const first = await create();
    const second = await create();

    expect(first.status).toBe(201);
    expect(second.status).toBe(429);
    const tag = await database.query<{ id: string; created_by: string; updated_by: string }>(
      "SELECT id, created_by, updated_by FROM tags WHERE slug = 'security'",
    );
    expect(tag.rows[0]).toMatchObject({ created_by: adminId, updated_by: adminId });
    const rename = () => taxonomyRoute.PATCH(new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.20" },
      body: JSON.stringify({ type: "tag", id: tag.rows[0].id, name: "安全实践" }),
    }));
    expect((await rename()).status).toBe(200);
    expect((await rename()).status).toBe(429);
    const renamed = await database.query<{ name: string; updated_by: string; updated_at: Date }>(
      "SELECT name, updated_by, updated_at FROM tags WHERE id = $1", [tag.rows[0].id],
    );
    expect(renamed.rows[0]).toMatchObject({ name: "安全实践", updated_by: adminId });
    expect(renamed.rows[0].updated_at).toBeInstanceOf(Date);

    await database.query("DELETE FROM auth_rate_limits");
    const remove = () => taxonomyRoute.DELETE(new Request(`http://localhost/api/admin/settings?type=tag&id=${tag.rows[0].id}`, {
      method: "DELETE",
      headers: { "x-forwarded-for": "192.0.2.20" },
    }));
    expect((await remove()).status).toBe(200);
    expect((await remove()).status).toBe(429);
    await expect(database.query<{ del_flag: boolean; updated_by: string }>(
      "SELECT del_flag, updated_by FROM tags WHERE id = $1", [tag.rows[0].id],
    )).resolves.toMatchObject({ rows: [{ del_flag: true, updated_by: adminId }] });
    await expect(database.query("SELECT count(*)::int AS count FROM auth_rate_limits")).resolves.toMatchObject({ rows: [{ count: 2 }] });
  });

  it("denies taxonomy writes to reader sessions", async () => {
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    await database.query("INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')", [reader.rows[0].id, tokenHash("reader-session-token")]);
    state.token = "reader-session-token";

    const response = await taxonomyRoute.POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "tag", slug: "forbidden", name: "禁止" }),
    }));

    expect(response.status).toBe(404);
    await expect(database.query("SELECT id FROM tags WHERE slug = 'forbidden'")).resolves.toMatchObject({ rows: [] });
  });

  it("rate limits article visibility changes and records the administrator", async () => {
    const form = new FormData();
    form.set("title", "Visibility");
    form.set("category", "engineering");
    form.set("publishedAt", "2026-11-18");
    form.set("file", new File(["## 可见性\n\n正文。"], "visibility.md", { type: "text/markdown" }));
    const created = await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", body: form }));
    const { id } = await created.json() as { id: string };

    vi.stubEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", "1");
    vi.resetModules();
    const visibilityRoute = await import("@/app/api/admin/articles/[id]/visibility/route");
    const request = () => visibilityRoute.POST(new Request(`http://localhost/api/admin/articles/${id}/visibility`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.30" },
      body: JSON.stringify({ action: "restore", confirmed: true }),
    }), { params: Promise.resolve({ id }) });
    const first = await request();
    const second = await request();

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    await expect(database.query<{ updated_by: string; archived_at: Date | null }>(
      "SELECT updated_by, archived_at FROM articles WHERE public_id = $1", [id],
    )).resolves.toMatchObject({ rows: [{ updated_by: adminId, archived_at: null }] });
  });

  it("rate limits article edits and records the managing administrator", async () => {
    const createForm = () => {
      const form = new FormData();
      form.set("title", "Editable");
      form.set("category", "engineering");
      form.set("publishedAt", "2026-11-18");
      form.set("file", new File(["## 原文\n\n正文。"], "editable.md", { type: "text/markdown" }));
      return form;
    };
    const created = await articleRoute.POST(new Request("http://localhost/api/admin/articles", { method: "POST", body: createForm() }));
    const { id } = await created.json() as { id: string };
    vi.stubEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", "1");
    vi.resetModules();
    articleRoute = await import("@/app/api/admin/articles/route");
    const edit = () => {
      const form = createForm();
      form.set("id", id);
      form.set("title", "Edited");
      return articleRoute.POST(new Request("http://localhost/api/admin/articles", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.40" },
        body: form,
      }));
    };
    expect((await edit()).status).toBe(200);
    expect((await edit()).status).toBe(429);
    await expect(database.query<{ title: string; created_by: string; updated_by: string }>(`
      SELECT version.title, version.created_by, version.updated_by
      FROM articles article JOIN article_versions version ON version.id = article.current_published_version_id
      WHERE article.public_id = $1
    `, [id])).resolves.toMatchObject({ rows: [{ title: "Edited", created_by: adminId, updated_by: adminId }] });
  });
});
