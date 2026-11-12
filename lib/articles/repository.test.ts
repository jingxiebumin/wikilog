import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ database: undefined as PGlite | undefined }));

vi.mock("@/lib/db", () => ({
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => state.database!.query(...args),
    connect: async () => ({
      query: (...args: Parameters<PGlite["query"]>) => state.database!.query(...args),
      release: () => undefined,
    }),
  },
}));

import { publishArticleVersion, saveArticleDraft, setArticleVisibility } from "./repository";
import type { ParsedArticle } from "./parser";

const parsed = (title: string): ParsedArticle => ({
  slug: "release-flow",
  title,
  summary: "文章摘要",
  publishedAt: "2026-11-12",
  category: "engineering",
  tags: ["release"],
  content: [{ type: "paragraph", text: title }],
  contentText: title,
  readMinutes: 1,
  cover: "content",
});

describe("article version repository", () => {
  let database: PGlite;
  let adminId: string;

  beforeEach(async () => {
    database = new PGlite();
    state.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0004_article_sources.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    adminId = admin.rows[0].id;
    await database.query("INSERT INTO categories (slug, name, created_by, updated_by) VALUES ('engineering', 'Engineering', $1, $1)", [adminId]);
  });

  afterEach(async () => {
    state.database = undefined;
    await database.close();
  });

  it("keeps a published version live until an uploaded draft is explicitly published", async () => {
    await saveArticleDraft({ ...parsed("First"), sourceMdx: "source-v1" }, adminId);
    const first = await database.query<{ id: string }>("SELECT id FROM article_versions WHERE version_number = 1");
    await publishArticleVersion(first.rows[0].id, adminId);

    await saveArticleDraft({ ...parsed("Second"), sourceMdx: "source-v2" }, adminId);
    const beforePublish = await database.query<{ title: string; status: string; pointer_matches: boolean }>(`
      SELECT v.title, v.status, a.current_published_version_id = v.id AS pointer_matches
      FROM article_versions v JOIN articles a ON a.id = v.article_id ORDER BY v.version_number
    `);
    expect(beforePublish.rows).toEqual([
      { title: "First", status: "published", pointer_matches: true },
      { title: "Second", status: "draft", pointer_matches: false },
    ]);

    const second = await database.query<{ id: string }>("SELECT id FROM article_versions WHERE version_number = 2");
    await publishArticleVersion(second.rows[0].id, adminId);
    const afterPublish = await database.query<{ title: string; status: string; source_mdx: string; pointer_matches: boolean }>(`
      SELECT v.title, v.status, v.source_mdx, a.current_published_version_id = v.id AS pointer_matches
      FROM article_versions v JOIN articles a ON a.id = v.article_id ORDER BY v.version_number
    `);
    expect(afterPublish.rows).toEqual([
      { title: "First", status: "archived", source_mdx: "source-v1", pointer_matches: false },
      { title: "Second", status: "published", source_mdx: "source-v2", pointer_matches: true },
    ]);
  });

  it("hides and restores an article without deleting its published version", async () => {
    await saveArticleDraft({ ...parsed("First"), sourceMdx: "source" }, adminId);
    const version = await database.query<{ id: string }>("SELECT id FROM article_versions WHERE version_number = 1");
    await publishArticleVersion(version.rows[0].id, adminId);
    await setArticleVisibility("release-flow", "hide", adminId);
    const hidden = await database.query<{ archived: boolean }>("SELECT archived_at IS NOT NULL AS archived FROM articles");
    expect(hidden.rows[0].archived).toBe(true);
    await setArticleVisibility("release-flow", "restore", adminId);
    const restored = await database.query<{ visible: boolean }>(`
      SELECT current_published_version_id = $1 AND archived_at IS NULL AND deleted_at IS NULL AND NOT del_flag AS visible
      FROM articles
    `, [version.rows[0].id]);
    expect(restored.rows[0].visible).toBe(true);
  });
});
