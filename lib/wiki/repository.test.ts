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

import {
  findPublishedWikiPage,
  getWikiPageHistory,
  listPublishedWikiPages,
  mergeWikiPages,
  publishWikiPageVersion,
  saveWikiPageDraft,
} from "./repository";

describe("Wiki repository", () => {
  let database: PGlite;
  let adminId: string;
  let sourceArticleVersionId: string;
  let secondArticleVersionId: string;

  beforeEach(async () => {
    database = new PGlite();
    state.database = database;
    for (const file of [
      "0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql",
      "0004_article_sources.sql", "0005_favorites.sql", "0006_reader_status_audit.sql",
      "0007_reader_profile_audit.sql", "0008_personal_center.sql", "0009_article_images.sql",
      "0010_qa.sql", "0011_wiki.sql", "0012_wiki_generation.sql",
      "0014_current_article_management.sql", "0015_wiki_single_draft.sql",
    ]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }

    const user = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, role, status)
      VALUES ('admin@example.test', 'Admin', 'admin', 'active') RETURNING id
    `);
    adminId = user.rows[0].id;
    const category = await database.query<{ id: string }>(`
      INSERT INTO categories (slug, name, tone) VALUES ('systems', 'Systems', 'blue') RETURNING id
    `);
    const firstArticle = await createPublishedArticle("transactions", "事务", category.rows[0].id);
    const secondArticle = await createPublishedArticle("indexes", "索引", category.rows[0].id);
    sourceArticleVersionId = firstArticle.versionId;
    secondArticleVersionId = secondArticle.versionId;
  });

  afterEach(async () => database.close());

  async function createPublishedArticle(slug: string, title: string, categoryId: string) {
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, public_id, category_id) VALUES ($1, $3, $2) RETURNING id
    `, [slug, categoryId, slug === "transactions" ? "7699320318288494630" : "7699320318288494631"]);
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, cover, read_minutes, published_at)
      VALUES ($1, 1, 'published', $2, '摘要', '正文证据', 'content', 1, CURRENT_DATE) RETURNING id
    `, [article.rows[0].id, title]);
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [article.rows[0].id, version.rows[0].id]);
    return { articleId: article.rows[0].id, versionId: version.rows[0].id };
  }

  it("keeps draft Wiki versions out of public reads until an admin publishes them", async () => {
    const draft = await saveWikiPageDraft({
      slug: "database-transactions",
      title: "数据库事务",
      body: "事务保证一组变更的原子性。",
      sourceArticleVersionIds: [sourceArticleVersionId],
      relatedSlugs: [],
    }, adminId);

    await expect(listPublishedWikiPages()).resolves.toEqual([]);
    await expect(findPublishedWikiPage("database-transactions")).resolves.toBeUndefined();

    await publishWikiPageVersion(draft.pageId, draft.versionId, adminId);
    await expect(findPublishedWikiPage("database-transactions")).resolves.toMatchObject({
      slug: "database-transactions",
      title: "数据库事务",
      body: "事务保证一组变更的原子性。",
      sources: [{ articleVersionId: sourceArticleVersionId, articleSlug: "7699320318288494630" }],
    });
  });

  it("overwrites the single draft and does not retain old Wiki正文 versions", async () => {
    const first = await saveWikiPageDraft({
      slug: "database-transactions", title: "事务", body: "第一版。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId);
    const second = await saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务", body: "第二版。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId);
    expect(second).toMatchObject({ pageId: first.pageId, versionId: first.versionId });
    expect((await database.query("SELECT id FROM wiki_page_versions WHERE page_id = $1", [first.pageId])).rowCount).toBe(1);
    await publishWikiPageVersion(second.pageId, second.versionId, adminId);
    const revised = await saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务（修订）", body: "第三版。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(revised.pageId, revised.versionId, adminId);

    await expect(getWikiPageHistory("database-transactions")).resolves.toEqual([
      expect.objectContaining({ id: revised.versionId, status: "published", body: "第三版。" }),
    ]);
  });

  it("rejects sources that are not the current published article version", async () => {
    const article = await database.query<{ id: string; article_id: string }>("SELECT article_id AS id, article_id FROM article_versions WHERE id = $1", [sourceArticleVersionId]);
    const staleVersion = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, cover, read_minutes)
      VALUES ($1, 2, 'draft', '草稿', '摘要', '草稿', 'content', 1) RETURNING id
    `, [article.rows[0].article_id]);

    await expect(saveWikiPageDraft({
      slug: "stale-source", title: "旧来源", body: "不得发布。",
      sourceArticleVersionIds: [staleVersion.rows[0].id], relatedSlugs: [],
    }, adminId)).rejects.toThrow("来源文章版本当前不可用。");

    const hidden = await database.query("UPDATE articles SET archived_at = now() WHERE id = $1", [article.rows[0].article_id]);
    expect(hidden.rowCount).toBe(1);
    await expect(saveWikiPageDraft({
      slug: "hidden-source", title: "下架来源", body: "不得发布。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId)).rejects.toThrow("来源文章版本当前不可用。");
  });

  it("shows only reviewed relationships in the published knowledge graph", async () => {
    const related = await saveWikiPageDraft({
      slug: "database-indexes", title: "数据库索引", body: "索引帮助查找数据。",
      sourceArticleVersionIds: [secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(related.pageId, related.versionId, adminId);
    const root = await saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务", body: "事务组织数据变更。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: ["database-indexes"],
    }, adminId);

    await expect(listPublishedWikiPages()).resolves.toHaveLength(1);
    await publishWikiPageVersion(root.pageId, root.versionId, adminId);
    await expect(findPublishedWikiPage("database-transactions")).resolves.toMatchObject({
      relatedPages: [{ slug: "database-indexes", title: "数据库索引" }],
    });
    await expect(findPublishedWikiPage("database-indexes")).resolves.toMatchObject({
      relatedPages: [{ slug: "database-transactions", title: "数据库事务" }],
    });
  });

  it("hides a published page when all of its article-version sources are no longer current", async () => {
    const page = await saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务", body: "正文。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(page.pageId, page.versionId, adminId);
    await database.query("UPDATE articles SET current_published_version_id = NULL WHERE current_published_version_id = $1", [sourceArticleVersionId]);

    await expect(listPublishedWikiPages()).resolves.toEqual([]);
    await expect(findPublishedWikiPage("database-transactions")).resolves.toBeUndefined();
  });

  it("makes a merged source redirect only after the target merge version is published", async () => {
    const first = await saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务", body: "事务正文。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(first.pageId, first.versionId, adminId);
    const second = await saveWikiPageDraft({
      slug: "transaction-isolation", title: "事务隔离", body: "隔离级别正文。",
      sourceArticleVersionIds: [secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(second.pageId, second.versionId, adminId);
    const referrer = await saveWikiPageDraft({
      slug: "transaction-locking", title: "事务锁", body: "锁定正文。",
      sourceArticleVersionIds: [secondArticleVersionId], relatedSlugs: ["transaction-isolation"],
    }, adminId);
    await publishWikiPageVersion(referrer.pageId, referrer.versionId, adminId);

    const merge = await mergeWikiPages("transaction-isolation", "database-transactions", adminId);
    await expect(database.query<{ body: string }>("SELECT body FROM wiki_page_versions WHERE id = $1", [merge.versionId]))
      .resolves.toMatchObject({ rows: [{ body: "事务正文。" }] });
    await expect(findPublishedWikiPage("transaction-isolation")).resolves.toMatchObject({
      body: "隔离级别正文。",
    });
    expect(merge.versionId).toBeTruthy();
    const editedMerge = await saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务整理版", body: "管理员整理后的合并正文。",
      sourceArticleVersionIds: [sourceArticleVersionId, secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    expect(editedMerge.versionId).toBe(merge.versionId);
    await publishWikiPageVersion(editedMerge.pageId, editedMerge.versionId, adminId);

    await expect(findPublishedWikiPage("transaction-isolation")).resolves.toMatchObject({
      redirectTo: "/wiki/database-transactions",
    });
    await expect(findPublishedWikiPage("database-transactions")).resolves.toMatchObject({
      title: "数据库事务整理版",
      body: "管理员整理后的合并正文。",
      sources: expect.arrayContaining([
        expect.objectContaining({ articleVersionId: sourceArticleVersionId }),
        expect.objectContaining({ articleVersionId: secondArticleVersionId }),
      ]),
    });
    await expect(findPublishedWikiPage("transaction-locking")).resolves.toMatchObject({
      relatedPages: [{ slug: "database-transactions", title: "数据库事务整理版" }],
    });
    const source = await database.query<{ id: string }>(`
      SELECT version.id FROM wiki_page_versions version JOIN wiki_pages page ON page.id = version.page_id
      WHERE page.slug = 'transaction-isolation'
    `);
    expect(source.rows).toEqual([]);
    await expect(getWikiPageHistory("transaction-isolation")).resolves.toEqual([]);
  });

  it("keeps only currently valid sources when merging a page with a stale source", async () => {
    const source = await saveWikiPageDraft({
      slug: "mixed-source-topic", title: "多来源主题", body: "原页面正文。",
      sourceArticleVersionIds: [sourceArticleVersionId, secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(source.pageId, source.versionId, adminId);
    const staleArticle = await database.query<{ article_id: string }>(
      "SELECT article_id FROM article_versions WHERE id = $1", [sourceArticleVersionId],
    );
    await database.query("UPDATE articles SET archived_at = now() WHERE id = $1", [staleArticle.rows[0].article_id]);

    const target = await saveWikiPageDraft({
      slug: "merge-target-topic", title: "保留主题", body: "保留页面正文。",
      sourceArticleVersionIds: [secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(target.pageId, target.versionId, adminId);

    const draft = await mergeWikiPages("mixed-source-topic", "merge-target-topic", adminId);

    await expect(getWikiPageHistory("merge-target-topic")).resolves.toContainEqual(
      expect.objectContaining({ id: draft.versionId, status: "draft" }),
    );
    await expect(findPublishedWikiPage("mixed-source-topic")).resolves.toMatchObject({
      sources: [{ articleVersionId: secondArticleVersionId }],
    });
  });

  it("requires related pages to be publicly available when a draft is saved", async () => {
    await saveWikiPageDraft({
      slug: "database-indexes", title: "数据库索引", body: "索引正文。",
      sourceArticleVersionIds: [secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    await expect(saveWikiPageDraft({
      slug: "database-transactions", title: "数据库事务", body: "事务正文。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: ["database-indexes"],
    }, adminId)).rejects.toThrow("相关 Wiki 页面当前不可用。");
  });

  it("rejects candidate relationships to unknown or merged pages", async () => {
    const first = await saveWikiPageDraft({
      slug: "database-transactions", title: "事务", body: "事务正文。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(first.pageId, first.versionId, adminId);
    const second = await saveWikiPageDraft({
      slug: "database-indexes", title: "索引", body: "索引正文。",
      sourceArticleVersionIds: [secondArticleVersionId], relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(second.pageId, second.versionId, adminId);
    const merge = await mergeWikiPages("database-indexes", "database-transactions", adminId);
    await publishWikiPageVersion(merge.pageId, merge.versionId, adminId);

    await expect(saveWikiPageDraft({
      slug: "unknown-target", title: "未知关系", body: "正文。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: ["not-a-page"],
    }, adminId)).rejects.toThrow("相关 Wiki 页面当前不可用。");
    await expect(saveWikiPageDraft({
      slug: "merged-target", title: "合并关系", body: "正文。",
      sourceArticleVersionIds: [sourceArticleVersionId], relatedSlugs: ["database-indexes"],
    }, adminId)).rejects.toThrow("相关 Wiki 页面当前不可用。");
  });
});
