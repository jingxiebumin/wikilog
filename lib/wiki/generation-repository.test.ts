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

import { enqueueWikiUpdateJob, wikiGenerationRepository } from "./generation-repository";
import { publishWikiPageVersion, saveWikiPageDraft } from "./repository";

describe("Wiki generation queue", () => {
  let database: PGlite;
  let adminId: string;
  let publishedVersionId: string;

  beforeEach(async () => {
    database = new PGlite();
    state.database = database;
    for (const file of [
      "0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0004_article_sources.sql",
      "0005_favorites.sql", "0006_reader_status_audit.sql", "0007_reader_profile_audit.sql",
      "0008_personal_center.sql", "0009_article_images.sql", "0010_qa.sql", "0011_wiki.sql", "0012_wiki_generation.sql",
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
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, category_id) VALUES ('transactions', $1) RETURNING id
    `, [category.rows[0].id]);
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, cover, read_minutes, published_at)
      VALUES ($1, 1, 'published', '事务', '摘要', '正文', 'content', 1, CURRENT_DATE) RETURNING id
    `, [article.rows[0].id]);
    publishedVersionId = version.rows[0].id;
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [article.rows[0].id, publishedVersionId]);
  });

  afterEach(async () => database.close());

  it("keeps one initial generation job and claims queued work with its actor", async () => {
    await wikiGenerationRepository.enqueueInitialJob(adminId);
    await wikiGenerationRepository.enqueueInitialJob(adminId);

    await expect(wikiGenerationRepository.claimNextJob()).resolves.toMatchObject({
      kind: "initial", articleVersionId: null, actorId: adminId,
    });
    await expect(wikiGenerationRepository.claimNextJob()).resolves.toBeUndefined();
  });

  it("accepts an update job inside the caller's transaction", async () => {
    const client = await database.waitReady.then(() => ({
      query: database.query.bind(database),
    })) as unknown as import("pg").PoolClient;
    await client.query("BEGIN");
    await enqueueWikiUpdateJob(publishedVersionId, adminId, client);
    await client.query("ROLLBACK");
    const jobs = await database.query("SELECT id FROM wiki_generation_jobs");
    expect(jobs.rows).toEqual([]);
  });

  it("loads only the currently published visible article version", async () => {
    const articles = await wikiGenerationRepository.loadCurrentPublishedArticles();
    expect(articles).toEqual([{
      id: expect.any(String), versionId: publishedVersionId, slug: "transactions", title: "事务", contentText: "正文",
    }]);

    await database.query("UPDATE articles SET archived_at = now() WHERE current_published_version_id = $1", [publishedVersionId]);
    await expect(wikiGenerationRepository.loadCurrentPublishedArticles()).resolves.toEqual([]);
  });

  it("finds Wiki pages that cite the replaced version and remaps their sources to current versions", async () => {
    const draft = await saveWikiPageDraft({
      slug: "database-transactions",
      title: "数据库事务",
      body: "旧版文章总结。",
      sourceArticleVersionIds: [publishedVersionId],
      relatedSlugs: [],
    }, adminId);
    await publishWikiPageVersion(draft.pageId, draft.versionId, adminId);

    const article = await database.query<{ id: string }>(`
      SELECT article_id AS id FROM article_versions WHERE id = $1
    `, [publishedVersionId]);
    const nextVersion = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, cover, read_minutes, published_at)
      VALUES ($1, 2, 'published', '事务 v2', '摘要', '新版正文', 'content', 1, CURRENT_DATE) RETURNING id
    `, [article.rows[0].id]);
    await database.query("UPDATE article_versions SET status = 'archived' WHERE id = $1", [publishedVersionId]);
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [article.rows[0].id, nextVersion.rows[0].id]);

    await expect(wikiGenerationRepository.loadAffectedPages(nextVersion.rows[0].id)).resolves.toEqual([{
      slug: "database-transactions",
      title: "数据库事务",
      body: "旧版文章总结。",
      sourceArticleVersionIds: [nextVersion.rows[0].id],
    }]);
  });
});
