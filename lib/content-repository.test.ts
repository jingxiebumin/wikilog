import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repositoryState = vi.hoisted(() => ({ database: undefined as PGlite | undefined }));

vi.mock("@/lib/db", () => ({
  hasDatabase: true,
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => repositoryState.database!.query(...args),
  },
}));

import {
  findPublishedArticleFromDatabase,
  listPublishedArticlesFromDatabase,
  listTagArticlesFromDatabase,
  searchPublishedArticlesFromDatabase,
} from "./content-repository";

describe("PostgreSQL public content repository", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    repositoryState.database = database;
    await database.exec(`
      CREATE TABLE categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
        name text NOT NULL, description text NOT NULL DEFAULT '', tone text NOT NULL DEFAULT 'blue',
        del_flag boolean NOT NULL DEFAULT false
      );
      CREATE TABLE tags (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
        name text NOT NULL, del_flag boolean NOT NULL DEFAULT false
      );
      CREATE TABLE articles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
        category_id uuid NOT NULL REFERENCES categories(id), current_published_version_id uuid,
        archived_at timestamptz, deleted_at timestamptz, del_flag boolean NOT NULL DEFAULT false
      );
      CREATE TABLE article_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), article_id uuid NOT NULL REFERENCES articles(id),
        version_number integer NOT NULL, status text NOT NULL, title text NOT NULL, summary text NOT NULL,
        published_at date, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
        del_flag boolean NOT NULL DEFAULT false, read_minutes integer NOT NULL DEFAULT 1,
        cover text NOT NULL DEFAULT 'boundary', content jsonb NOT NULL DEFAULT '[]', content_text text NOT NULL DEFAULT ''
      );
      CREATE TABLE article_version_tags (
        article_version_id uuid NOT NULL REFERENCES article_versions(id), tag_id uuid NOT NULL REFERENCES tags(id),
        del_flag boolean NOT NULL DEFAULT false
      );
      INSERT INTO categories (id, slug, name) VALUES ('00000000-0000-0000-0000-000000000001', 'engineering', '工程实践');
      INSERT INTO tags (id, slug, name) VALUES
        ('00000000-0000-0000-0000-000000000011', 'visible', '公开标签'),
        ('00000000-0000-0000-0000-000000000012', 'removed', '已删除标签');
    `);
  });

  afterEach(async () => {
    repositoryState.database = undefined;
    await database.close();
  });

  const createArticle = async (input: {
    slug: string;
    status?: "published" | "draft" | "archived";
    current?: boolean;
    articleDeleted?: boolean;
    archived?: boolean;
    versionDeleted?: boolean;
    title: string;
    contentText: string;
    publishedAt?: string;
  }) => {
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, category_id, archived_at, deleted_at, del_flag)
      VALUES ($1, '00000000-0000-0000-0000-000000000001', $2, $3, $4)
      RETURNING id
    `, [input.slug, input.archived ? new Date() : null, input.articleDeleted ? new Date() : null, input.articleDeleted ?? false]);
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, content, published_at, del_flag)
      VALUES ($1, 1, $2, $3, '文章摘要', $4, $5::jsonb, $6, $7)
      RETURNING id
    `, [
      article.rows[0].id,
      input.status ?? "published",
      input.title,
      input.contentText,
      JSON.stringify([{ type: "paragraph", text: input.contentText }]),
      input.status === "draft" ? null : input.publishedAt ?? "2026-10-01",
      input.versionDeleted ?? false,
    ]);
    if (input.current !== false) {
      await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [
        article.rows[0].id,
        version.rows[0].id,
      ]);
    }
    return { articleId: article.rows[0].id, versionId: version.rows[0].id };
  };

  it("returns only active articles whose current version is published", async () => {
    await createArticle({ slug: "public", title: "公开标题", contentText: "公开正文" });
    await createArticle({ slug: "draft", title: "草稿标题", contentText: "草稿私文", status: "draft" });
    const versioned = await createArticle({ slug: "versioned", title: "旧版本标题", contentText: "旧版私文" });
    const newerVersion = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, content, published_at)
      VALUES ($1, 2, 'published', '当前版本标题', '当前摘要', '当前正文', '[{"type":"paragraph","text":"当前正文"}]'::jsonb, '2026-10-02')
      RETURNING id
    `, [versioned.articleId]);
    await database.query("UPDATE articles SET current_published_version_id = $1 WHERE id = $2", [newerVersion.rows[0].id, versioned.articleId]);
    await createArticle({ slug: "archived", title: "下架标题", contentText: "下架私文", archived: true });
    await createArticle({ slug: "deleted", title: "删除标题", contentText: "删除私文", articleDeleted: true });
    await createArticle({ slug: "version-deleted", title: "版本删除标题", contentText: "版本删除私文", versionDeleted: true });

    const results = await listPublishedArticlesFromDatabase();

    expect(results.map(({ slug }) => slug)).toEqual(["versioned", "public"]);
    expect(results.find(({ slug }) => slug === "versioned")?.title).toBe("当前版本标题");
    await expect(findPublishedArticleFromDatabase("draft")).resolves.toBeUndefined();
    await expect(findPublishedArticleFromDatabase("archived")).resolves.toBeUndefined();
    await expect(findPublishedArticleFromDatabase("deleted")).resolves.toBeUndefined();
  });

  it("keeps search title priority, case-insensitive matching, and nearby body snippets", async () => {
    await createArticle({
      slug: "body-match",
      title: "较新文章",
      contentText: `开头内容 ${"背景文字 ".repeat(12)}中文连续词与 PostGreSQL 在此出现。`,
      publishedAt: "2026-10-29",
    });
    await createArticle({
      slug: "title-match",
      title: "PostgreSQL 与中文连续词",
      contentText: "另一篇文章正文。",
      publishedAt: "2026-10-01",
    });

    const chineseResults = await searchPublishedArticlesFromDatabase("中文连续词");
    const englishResults = await searchPublishedArticlesFromDatabase("pOsTgReSqL");

    expect(chineseResults.map(({ matchType }) => matchType)).toEqual(["title", "body"]);
    expect(chineseResults[1].snippet).toContain("中文连续词");
    expect(englishResults.map(({ article }) => article.slug)).toEqual(["title-match", "body-match"]);
    expect(await searchPublishedArticlesFromDatabase("  ")).toEqual([]);
    expect(await searchPublishedArticlesFromDatabase("不存在的词")).toEqual([]);
  });

  it("omits soft-deleted tags from article metadata and tag reads", async () => {
    const article = await createArticle({ slug: "tagged", title: "带标签的文章", contentText: "公开正文" });
    await database.query(`
      INSERT INTO article_version_tags (article_version_id, tag_id)
      VALUES ($1, '00000000-0000-0000-0000-000000000011'), ($1, '00000000-0000-0000-0000-000000000012')
    `, [article.versionId]);
    await database.query("UPDATE tags SET del_flag = true WHERE slug = 'removed'");

    const [found, byTag] = await Promise.all([
      findPublishedArticleFromDatabase("tagged"),
      listTagArticlesFromDatabase("removed"),
    ]);

    expect(found?.tags).toEqual(["visible"]);
    expect(byTag).toEqual([]);
  });
});
