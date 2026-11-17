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

describe("admin taxonomy settings route", () => {
  let database: PGlite;
  let adminSettingsRoute: typeof import("@/app/api/admin/settings/route");
  let adminId: string;
  let readerId: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("AUTH_ENABLED", "true");
    state.token = "admin-session-token";
    database = new PGlite();
    state.database = database;
    const migrationsPath = path.join(process.cwd(), "db/migrations");
    const migrationFiles = (await readdir(migrationsPath)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
    for (const file of migrationFiles) {
      await database.exec(await readFile(path.join(migrationsPath, file), "utf8"));
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
      await database.query(
        "INSERT INTO reader_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
        [userId, tokenHash(token)],
      );
    }
    adminSettingsRoute = await import("@/app/api/admin/settings/route");
  });

  afterEach(async () => {
    state.database = undefined;
    vi.unstubAllEnvs();
    await database.close();
  });

  it("hides taxonomy settings from anonymous and reader sessions", async () => {
    state.token = "unknown-session";
    expect((await adminSettingsRoute.GET()).status).toBe(404);
    state.token = "reader-session-token";
    expect((await adminSettingsRoute.GET()).status).toBe(404);
    const readerWrite = await adminSettingsRoute.POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", slug: "engineering", name: "工程实践" }),
    }));
    expect(readerWrite.status).toBe(404);
  });

  it("lets an administrator create categories and tags and rename their display names", async () => {
    const categoryResponse = await adminSettingsRoute.POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", slug: "engineering", name: "工程实践" }),
    }));
    expect(categoryResponse.status).toBe(201);
    const category = await categoryResponse.json() as { item: { id: string; slug: string; name: string } };
    expect(category.item).toMatchObject({ slug: "engineering", name: "工程实践" });

    const tagResponse = await adminSettingsRoute.POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "tag", slug: "postgres", name: "PostgreSQL" }),
    }));
    expect(tagResponse.status).toBe(201);

    const renamed = await adminSettingsRoute.PATCH(new Request("http://localhost/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", id: category.item.id, name: "系统工程" }),
    }));
    expect(renamed.status).toBe(200);
    await expect(renamed.json()).resolves.toMatchObject({ item: { id: category.item.id, slug: "engineering", name: "系统工程" } });

    const listed = await adminSettingsRoute.GET();
    await expect(listed.json()).resolves.toMatchObject({
      categories: [{ id: category.item.id, slug: "engineering", name: "系统工程" }],
      tags: [{ slug: "postgres", name: "PostgreSQL" }],
    });
  });

  it("blocks deleting a category or tag used by any article", async () => {
    const category = await database.query<{ id: string }>(
      "INSERT INTO categories (slug, name) VALUES ('engineering', '工程') RETURNING id",
    );
    const tag = await database.query<{ id: string }>(
      "INSERT INTO tags (slug, name) VALUES ('postgres', 'PostgreSQL') RETURNING id",
    );
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, public_id, category_id, created_by, updated_by)
      VALUES ('first-article', '1010101010101010101', $1, $2, $2) RETURNING id
    `, [category.rows[0].id, adminId]);
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, cover, read_minutes, created_by, updated_by)
      VALUES ($1, 1, 'draft', '第一篇文章', '', 'content', 1, $2, $2) RETURNING id
    `, [article.rows[0].id, adminId]);
    await database.query(
      "INSERT INTO article_version_tags (article_version_id, tag_id, created_by, updated_by) VALUES ($1, $2, $3, $3)",
      [version.rows[0].id, tag.rows[0].id, adminId],
    );

    const deleteCategory = await adminSettingsRoute.DELETE(new Request(
      `http://localhost/api/admin/settings?type=category&id=${category.rows[0].id}`, { method: "DELETE" },
    ));
    expect(deleteCategory.status).toBe(409);
    const deleteTag = await adminSettingsRoute.DELETE(new Request(
      `http://localhost/api/admin/settings?type=tag&id=${tag.rows[0].id}`, { method: "DELETE" },
    ));
    expect(deleteTag.status).toBe(409);

    await expect(database.query("SELECT del_flag FROM categories WHERE id = $1", [category.rows[0].id]))
      .resolves.toMatchObject({ rows: [{ del_flag: false }] });
    await expect(database.query("SELECT del_flag FROM tags WHERE id = $1", [tag.rows[0].id]))
      .resolves.toMatchObject({ rows: [{ del_flag: false }] });
  });

  it("allows deleting taxonomy entries with no article references", async () => {
    const created = await adminSettingsRoute.POST(new Request("http://localhost/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "tag", slug: "unused-tag", name: "未使用" }),
    }));
    const item = await created.json() as { item: { id: string } };
    const deleted = await adminSettingsRoute.DELETE(new Request(
      `http://localhost/api/admin/settings?type=tag&id=${item.item.id}`, { method: "DELETE" },
    ));
    expect(deleted.status).toBe(200);
    await expect(database.query("SELECT del_flag FROM tags WHERE id = $1", [item.item.id]))
      .resolves.toMatchObject({ rows: [{ del_flag: true }] });
  });
});
