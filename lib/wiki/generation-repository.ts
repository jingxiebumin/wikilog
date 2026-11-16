import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import type { WikiGenerationArticle, WikiGenerationJob, WikiGenerationRepository } from "./generation";
import { persistGeneratedWikiDrafts } from "./repository";

const database = () => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

export const wikiGenerationRepository: WikiGenerationRepository = {
  async enqueueInitialJob(actorId) {
    await database().query(`
      INSERT INTO wiki_generation_jobs (kind, actor_id)
      VALUES ('initial', $1)
      ON CONFLICT DO NOTHING
    `, [actorId]);
  },


  async claimNextJob(): Promise<WikiGenerationJob | undefined> {
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<QueryResultRow & {
        id: string; kind: WikiGenerationJob["kind"]; article_version_id: string | null; actor_id: string | null;
      }>(`
        SELECT id, kind, article_version_id, actor_id
        FROM wiki_generation_jobs
        WHERE status = 'queued' OR (status = 'running' AND updated_at < now() - interval '2 minutes')
        ORDER BY created_at, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `);
      const row = result.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return undefined;
      }
      const claimed = await client.query(`
        UPDATE wiki_generation_jobs SET status = 'running', updated_at = now()
        WHERE id = $1 AND (status = 'queued' OR (status = 'running' AND updated_at < now() - interval '2 minutes'))
      `, [row.id]);
      if (claimed.rowCount !== 1) throw new Error("Wiki generation job is no longer available.");
      await client.query("COMMIT");
      if (!row.actor_id) {
        await database().query("UPDATE wiki_generation_jobs SET status = 'failed', failure_code = 'invalid_candidate', updated_at = now() WHERE id = $1", [row.id]);
        return undefined;
      }
      return {
        id: row.id,
        kind: row.kind,
        articleVersionId: row.article_version_id,
        actorId: row.actor_id,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  async loadCurrentPublishedArticles(versionId?: string): Promise<WikiGenerationArticle[]> {
    const result = await database().query<QueryResultRow & {
      id: string; version_id: string; slug: string; title: string; content_text: string;
    }>(`
      SELECT article.id, version.id AS version_id, article.slug, version.title, version.content_text
      FROM articles article
      JOIN article_versions version ON version.id = article.current_published_version_id
        AND version.article_id = article.id AND version.status = 'published' AND version.del_flag = false
      WHERE article.del_flag = false AND article.archived_at IS NULL AND article.deleted_at IS NULL
        AND ($1::uuid IS NULL OR version.id = $1)
      ORDER BY version.published_at DESC, article.slug
    `, [versionId ?? null]);
    return result.rows.map((row) => ({
      id: row.id,
      versionId: row.version_id,
      slug: row.slug,
      title: row.title,
      contentText: row.content_text,
    }));
  },

  async loadAffectedPages(versionId: string) {
    const result = await database().query<QueryResultRow & {
      slug: string; title: string; body: string; source_article_version_ids: string[];
    }>(`
      SELECT page.slug, page_version.title, page_version.body,
        array_agg(DISTINCT current_source.id::text) AS source_article_version_ids
      FROM article_versions changed_version
      JOIN wiki_page_version_sources changed_source ON changed_source.article_version_id IN (
        SELECT replaced.id FROM article_versions replaced
        WHERE replaced.article_id = changed_version.article_id
      ) AND changed_source.del_flag = false
      JOIN wiki_page_versions page_version ON page_version.id = changed_source.page_version_id
        AND page_version.status = 'published' AND page_version.del_flag = false
      JOIN wiki_pages page ON page.id = page_version.page_id AND page.current_published_version_id = page_version.id
        AND page.state = 'active' AND page.del_flag = false
      JOIN wiki_page_version_sources source ON source.page_version_id = page_version.id AND source.del_flag = false
      JOIN article_versions source_version ON source_version.id = source.article_version_id
        AND source_version.del_flag = false
      JOIN articles source_article ON source_article.id = source_version.article_id
        AND source_article.del_flag = false AND source_article.archived_at IS NULL AND source_article.deleted_at IS NULL
      JOIN article_versions current_source ON current_source.id = source_article.current_published_version_id
        AND current_source.article_id = source_article.id AND current_source.status = 'published' AND current_source.del_flag = false
      WHERE changed_version.id = $1 AND changed_version.status = 'published' AND changed_version.del_flag = false
      GROUP BY page.id, page_version.id
      ORDER BY page.slug
    `, [versionId]);
    return result.rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      body: row.body,
      sourceArticleVersionIds: row.source_article_version_ids,
    }));
  },

  async completeJobWithDrafts(job, candidates, usage) {
    await persistGeneratedWikiDrafts(job, candidates, usage);
  },

  async failJob(jobId, reason) {
    await database().query(`
      UPDATE wiki_generation_jobs SET status = 'failed', failure_code = $2, updated_at = now()
      WHERE id = $1 AND status = 'running'
    `, [jobId, reason]);
  },
};

export async function enqueueWikiUpdateJob(articleVersionId: string, actorId: string, client?: PoolClient) {
  const executor = client ?? database();
  await executor.query(`
    INSERT INTO wiki_generation_jobs (kind, article_version_id, actor_id)
    VALUES ('update', $1, $2)
    ON CONFLICT DO NOTHING
  `, [articleVersionId, actorId]);
}
