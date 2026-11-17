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

import { findArticleImageAccess, listCurrentArticles, publishArticleVersion, saveArticleDraft, saveCurrentArticle, setArticleVisibility } from "./repository";
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
    for (const file of [
      "0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0004_article_sources.sql",
      "0005_favorites.sql", "0006_reader_status_audit.sql", "0007_reader_profile_audit.sql",
      "0008_personal_center.sql", "0009_article_images.sql", "0010_qa.sql", "0011_wiki.sql", "0012_wiki_generation.sql", "0014_current_article_management.sql",
    ]) {
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
    const firstJob = await database.query<{ article_version_id: string; status: string }>(`
      SELECT article_version_id, status FROM wiki_generation_jobs WHERE kind = 'update'
    `);
    expect(firstJob.rows).toEqual([]);

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
    const queuedJobs = await database.query<{ article_version_id: string; status: string }>(`
      SELECT article_version_id, status FROM wiki_generation_jobs WHERE kind = 'update' ORDER BY created_at, id
    `);
    expect(queuedJobs.rows).toEqual([]);
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

  it("keeps image assets scoped to versions and exposes only the current published article", async () => {
    await saveArticleDraft({
      ...parsed("First"), sourceMdx: "source-v1",
      images: [{ key: "image-key-v1.jpg", name: "chart.jpg", contentType: "image/jpeg" }],
    }, adminId);
    const first = await database.query<{ id: string }>("SELECT id FROM article_versions WHERE version_number = 1");
    await expect(findArticleImageAccess("image-key-v1.jpg")).resolves.toEqual({ published: false });
    await publishArticleVersion(first.rows[0].id, adminId);
    await expect(findArticleImageAccess("image-key-v1.jpg")).resolves.toEqual({ published: true });

    await saveArticleDraft({
      ...parsed("Second"), sourceMdx: "source-v2",
      images: [{ key: "image-key-v2.jpg", name: "chart.jpg", contentType: "image/jpeg" }],
    }, adminId);
    const second = await database.query<{ id: string }>("SELECT id FROM article_versions WHERE version_number = 2");
    await publishArticleVersion(second.rows[0].id, adminId);
    await expect(findArticleImageAccess("image-key-v1.jpg")).resolves.toEqual({ published: false });
    await expect(findArticleImageAccess("image-key-v2.jpg")).resolves.toEqual({ published: true });
    await setArticleVisibility("release-flow", "hide", adminId);
    await expect(findArticleImageAccess("image-key-v2.jpg")).resolves.toEqual({ published: false });
  });

  it("creates an article from separate form metadata and Markdown, hidden by default with string public id", async () => {
    await database.query("INSERT INTO tags (slug, name, created_by, updated_by) VALUES ('release', 'Release', $1, $1)", [adminId]);
    const id = await saveCurrentArticle({
      ...parsed("A title"), slug: "", summary: "derived summary", sourceMdx: "## Heading\n\nMarkdown body", sourceFilename: "note.md",
    }, adminId);
    expect(id).toMatch(/^\d+$/);
    const stored = await database.query<{ slug: string; public_id: string; hidden: boolean; title: string; source_mdx: string; source_filename: string }>(`
      SELECT a.slug, a.public_id, a.archived_at IS NOT NULL AS hidden, v.title, v.source_mdx, v.source_filename
      FROM articles a JOIN article_versions v ON v.id = a.current_published_version_id
    `);
    expect(stored.rows[0]).toMatchObject({ slug: id, public_id: id, hidden: true, title: "A title", source_mdx: "## Heading\n\nMarkdown body", source_filename: "note.md" });
  });

  it("replaces saved Markdown and metadata in place only for a hidden article", async () => {
    await database.query("INSERT INTO tags (slug, name, created_by, updated_by) VALUES ('release', 'Release', $1, $1)", [adminId]);
    const id = await saveCurrentArticle({ ...parsed("Original"), slug: "", sourceMdx: "Original body", sourceFilename: "original.md" }, adminId);
    await saveCurrentArticle({ ...parsed("Updated"), slug: "", articleId: id, sourceMdx: "Updated body", sourceFilename: "updated.md" }, adminId);
    const saved = await database.query<{ count: number; title: string; source_mdx: string; source_filename: string }>(`
      SELECT count(*)::int AS count, max(v.title) AS title, max(v.source_mdx) AS source_mdx, max(v.source_filename) AS source_filename
      FROM articles a JOIN article_versions v ON v.article_id = a.id
    `);
    expect(saved.rows[0]).toEqual({ count: 1, title: "Updated", source_mdx: "Updated body", source_filename: "updated.md" });
    await setArticleVisibility(id, "delete", adminId);
    await expect(saveCurrentArticle({ ...parsed("Deleted"), slug: "", articleId: id, sourceMdx: "body", sourceFilename: "x.md" }, adminId)).rejects.toThrow("文章已删除");
    const visibleId = await saveCurrentArticle({ ...parsed("Visible"), slug: "", sourceMdx: "visible", sourceFilename: "visible.md" }, adminId);
    await setArticleVisibility(visibleId, "restore", adminId);
    await expect(saveCurrentArticle({ ...parsed("No longer editable"), slug: "", articleId: visibleId, sourceMdx: "body", sourceFilename: "x.md" }, adminId)).rejects.toThrow("只有下架文章可以编辑");
  });

  it("filters and paginates current articles by controlled category, status and title", async () => {
    await database.query("INSERT INTO categories (slug, name, created_by, updated_by) VALUES ('systems', 'Systems', $1, $1)", [adminId]);
    await database.query("INSERT INTO tags (slug, name, created_by, updated_by) VALUES ('release', 'Release', $1, $1)", [adminId]);
    const first = await saveCurrentArticle({ ...parsed("First note"), slug: "", sourceMdx: "First body", sourceFilename: "first.md" }, adminId);
    const second = await saveCurrentArticle({ ...parsed("Second note"), slug: "", category: "systems", sourceMdx: "Second body", sourceFilename: "second.md" }, adminId);
    await setArticleVisibility(second, "restore", adminId);
    const page = await listCurrentArticles({ category: "engineering", status: "hidden", search: "First", page: 1, pageSize: 1 });
    expect(page.total).toBe(1);
    expect(page.articles.map(({ id, title }) => ({ id, title }))).toEqual([{ id: first, title: "First note" }]);
    const empty = await listCurrentArticles({ category: "systems", status: "hidden", search: "First" });
    expect(empty.total).toBe(0);
  });
});
