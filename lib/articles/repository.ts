import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import type { ArticleBlock } from "@/lib/content";
import type { ParsedArticle } from "./parser";

type Db = NonNullable<typeof pool>;
type AdminArticleVersion = ParsedArticle & { id: string; versionNumber: number; current: boolean; status: "draft" | "published" | "archived"; visibility: "visible" | "hidden" | "deleted"; sourceMdx: string };
type AdminArticleVersionRow = QueryResultRow & {
  id: string; slug: string; title: string; summary: string; published_at: string;
  category: string; tags: string[]; version_number: number; current: boolean;
  status: "draft" | "published" | "archived";
  visibility: "visible" | "hidden" | "deleted";
  source_mdx: string; content: ArticleBlock[]; content_text: string; read_minutes: number;
};

const database = (): Db => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

function mapAdminArticleVersion(row: AdminArticleVersionRow): AdminArticleVersion {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    publishedAt: row.published_at,
    category: row.category,
    tags: row.tags,
    content: row.content,
    contentText: row.content_text,
    readMinutes: row.read_minutes,
    cover: "content",
    sourceMdx: row.source_mdx,
    versionNumber: row.version_number,
    current: row.current,
    status: row.status,
    visibility: row.visibility,
  };
}

export async function getArticleCategories(): Promise<string[]> {
  const result = await database().query<{ slug: string }>(
    "SELECT slug FROM categories WHERE del_flag = false ORDER BY slug",
  );
  return result.rows.map(({ slug }) => slug);
}

export async function listAdminArticles() {
  const result = await database().query<AdminArticleVersionRow>(`
    SELECT v.id, a.slug, v.title, v.summary, v.published_at::text AS published_at,
      c.slug AS category,
      COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), ARRAY[]::text[]) AS tags,
      v.version_number, v.status, v.source_mdx, v.content, v.content_text, v.read_minutes,
      (a.current_published_version_id = v.id) AS current,
      CASE WHEN a.del_flag OR a.deleted_at IS NOT NULL THEN 'deleted'
        WHEN a.archived_at IS NOT NULL THEN 'hidden' ELSE 'visible' END AS visibility
    FROM article_versions v
    JOIN articles a ON a.id = v.article_id
    JOIN categories c ON c.id = a.category_id
    LEFT JOIN article_version_tags avt ON avt.article_version_id = v.id AND avt.del_flag = false
    LEFT JOIN tags t ON t.id = avt.tag_id AND t.del_flag = false
    GROUP BY v.id, a.id, c.id
    ORDER BY a.updated_at DESC, v.version_number DESC
  `);
  return result.rows.map(mapAdminArticleVersion);
}

export async function saveArticleDraft(input: ParsedArticle & { sourceMdx: string }, actorId: string): Promise<void> {
  const client: PoolClient = await database().connect();
  try {
    await client.query("BEGIN");
    const category = await client.query<{ id: string }>(
      "SELECT id FROM categories WHERE slug = $1 AND del_flag = false FOR SHARE",
      [input.category],
    );
    if (!category.rows[0]) throw new Error("主分类不存在。");

    const existing = await client.query<{ id: string }>(
      "SELECT id FROM articles WHERE slug = $1 FOR UPDATE",
      [input.slug],
    );
    let articleId: string;
    if (existing.rows[0]) {
      articleId = existing.rows[0].id;
      await client.query("UPDATE articles SET updated_at = now(), updated_by = $2 WHERE id = $1", [articleId, actorId]);
    } else {
      const created = await client.query<{ id: string }>(`
        INSERT INTO articles (slug, category_id, created_by, updated_by)
        VALUES ($1, $2, $3, $3) RETURNING id
      `, [input.slug, category.rows[0].id, actorId]);
      articleId = created.rows[0].id;
    }
    const number = await client.query<{ next_number: number }>(
      "SELECT COALESCE(MAX(version_number), 0) + 1 AS next_number FROM article_versions WHERE article_id = $1",
      [articleId],
    );
    const version = await client.query<{ id: string }>(`
      INSERT INTO article_versions (
        article_id, version_number, status, title, summary, content, content_text,
        cover, read_minutes, published_at, source_mdx, created_by, updated_by
      ) VALUES ($1, $2, 'draft', $3, $4, $5::jsonb, $6, $7, $8, $9::date, $10, $11, $11)
      RETURNING id
    `, [
      articleId, number.rows[0].next_number, input.title, input.summary,
      JSON.stringify(input.content), input.contentText, input.cover, input.readMinutes,
      input.publishedAt, input.sourceMdx, actorId,
    ]);

    for (const tagSlug of input.tags) {
      const tag = await client.query<{ id: string }>(`
        INSERT INTO tags (slug, name, created_by, updated_by)
        VALUES ($1, $1, $2, $2)
        ON CONFLICT (slug) DO UPDATE SET del_flag = false, updated_at = now(), updated_by = EXCLUDED.updated_by
        RETURNING id
      `, [tagSlug, actorId]);
      await client.query(`
        INSERT INTO article_version_tags (article_version_id, tag_id, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (article_version_id, tag_id) DO NOTHING
      `, [version.rows[0].id, tag.rows[0].id, actorId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function publishArticleVersion(versionId: string, actorId: string): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const lookup = await client.query<{ article_id: string }>(
      "SELECT article_id FROM article_versions WHERE id = $1 AND del_flag = false",
      [versionId],
    );
    const articleId = lookup.rows[0]?.article_id;
    if (!articleId) throw new Error("草稿不存在或状态已变化。");
    const article = await client.query<{ id: string }>("SELECT id FROM articles WHERE id = $1 FOR UPDATE", [articleId]);
    if (!article.rows[0]) throw new Error("文章不存在。");
    const selected = await client.query<{ status: string }>(
      "SELECT status FROM article_versions WHERE id = $1 AND article_id = $2 AND del_flag = false FOR UPDATE",
      [versionId, articleId],
    );
    if (selected.rows[0]?.status !== "draft") throw new Error("草稿不存在或状态已变化。");
    await client.query(`
      UPDATE article_versions SET status = 'archived', updated_at = now(), updated_by = $2
      WHERE article_id = $1 AND status = 'published' AND id <> $3
    `, [articleId, actorId, versionId]);
    await client.query(`
      UPDATE article_versions SET status = 'published', published_at = COALESCE(published_at, CURRENT_DATE),
        updated_at = now(), updated_by = $2 WHERE id = $1
    `, [versionId, actorId]);
    await client.query(`
      UPDATE articles SET current_published_version_id = $2, archived_at = NULL, deleted_at = NULL,
        del_flag = false, updated_at = now(), updated_by = $3 WHERE id = $1
    `, [articleId, versionId, actorId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setArticleVisibility(slug: string, action: "hide" | "delete" | "restore", actorId: string): Promise<void> {
  const result = await database().query(`
    UPDATE articles SET
      archived_at = CASE WHEN $2 = 'hide' THEN now() WHEN $2 = 'restore' THEN NULL ELSE archived_at END,
      deleted_at = CASE WHEN $2 = 'delete' THEN now() WHEN $2 = 'restore' THEN NULL ELSE deleted_at END,
      del_flag = CASE WHEN $2 = 'delete' THEN true WHEN $2 = 'restore' THEN false ELSE del_flag END,
      updated_at = now(), updated_by = $3
    WHERE slug = $1 AND ($2 <> 'restore' OR current_published_version_id IS NOT NULL)
    RETURNING id
  `, [slug, action, actorId]);
  if (!result.rowCount) throw new Error("文章不存在或没有可恢复的已发布版本。");
}
