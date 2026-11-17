import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import type { ArticleBlock } from "@/lib/content";
import type { ParsedArticle } from "./parser";
import type { StoredArticleImage } from "./image-storage";

type Db = NonNullable<typeof pool>;
type AdminArticleVersion = ParsedArticle & { id: string; versionNumber: number; current: boolean; status: "draft" | "published" | "archived"; visibility: "visible" | "hidden" | "deleted"; sourceMdx: string };
type AdminArticleVersionRow = QueryResultRow & {
  id: string; slug: string; title: string; summary: string; published_at: string;
  category: string; tags: string[]; version_number: number; current: boolean;
  status: "draft" | "published" | "archived";
  visibility: "visible" | "hidden" | "deleted";
  source_mdx: string; content: ArticleBlock[]; content_text: string; read_minutes: number;
};
type CurrentArticleRow = QueryResultRow & {
  id: string; title: string; summary: string; published_at: string; category: string; tags: string[];
  read_minutes: number; content: ArticleBlock[]; source_mdx: string; source_filename: string;
  created_at: string; visibility: "visible" | "hidden";
};

const currentArticleSelect = `
  SELECT a.public_id AS id, v.title, v.summary, v.published_at::text AS published_at, c.slug AS category,
    COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), ARRAY[]::text[]) AS tags,
    v.read_minutes, v.content, v.source_mdx, v.source_filename, a.created_at::text AS created_at,
    CASE WHEN a.archived_at IS NULL THEN 'visible' ELSE 'hidden' END AS visibility
  FROM articles a JOIN article_versions v ON v.id = a.current_published_version_id
  JOIN categories c ON c.id = a.category_id
  LEFT JOIN article_version_tags avt ON avt.article_version_id = v.id AND avt.del_flag = false
  LEFT JOIN tags t ON t.id = avt.tag_id AND t.del_flag = false
`;

export type ArticleListOptions = { category?: string; status?: "visible" | "hidden"; search?: string; page?: number; pageSize?: number };

export type CurrentAdminArticle = {
  id: string; title: string; summary: string; publishedAt: string; category: string; tags: string[];
  readMinutes: number; content: ArticleBlock[]; sourceMdx: string; sourceFilename: string;
  createdAt: string; visibility: "visible" | "hidden";
};

export type CurrentArticleInput = ParsedArticle & { sourceMdx: string; sourceFilename: string; articleId?: string };

export type CurrentArticle = AdminArticleVersion & { createdAt: string; sourceFilename: string };

const database = (): Db => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

function mapCurrentArticle(row: CurrentArticleRow): CurrentAdminArticle {
  return {
    id: row.id, title: row.title, summary: row.summary, publishedAt: row.published_at,
    category: row.category, tags: row.tags, readMinutes: row.read_minutes, content: row.content,
    sourceMdx: row.source_mdx, sourceFilename: row.source_filename, createdAt: row.created_at,
    visibility: row.visibility,
  };
}

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

export async function saveCurrentArticle(input: CurrentArticleInput, actorId: string): Promise<string> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const category = await client.query<{ id: string }>("SELECT id FROM categories WHERE slug = $1 AND del_flag = false", [input.category]);
    if (!category.rows[0]) throw new Error("主分类不存在。");
    const tags = [...new Set(input.tags)];
    if (tags.length > 2) throw new Error("文章最多选择两个标签。");
    if (tags.length) {
      const found = await client.query<{ slug: string }>("SELECT slug FROM tags WHERE slug = ANY($1::text[]) AND del_flag = false", [tags]);
      if (found.rowCount !== tags.length) throw new Error("标签不在系统设置中。");
    }
    let articleId = input.articleId;
    if (articleId) {
      const locked = await client.query<{ id: string; current_published_version_id: string | null; archived_at: string | null; deleted_at: string | null; del_flag: boolean }>("SELECT id, current_published_version_id, archived_at, deleted_at, del_flag FROM articles WHERE public_id = $1 FOR UPDATE", [articleId]);
      const row = locked.rows[0];
      if (!row) throw new Error("文章不存在。");
      if (row.del_flag || row.deleted_at) throw new Error("文章已删除，不能编辑。");
      if (!row.archived_at) throw new Error("只有下架文章可以编辑。");
      const versionId = row.current_published_version_id;
      if (!versionId) throw new Error("文章正文不存在。");
      await client.query(`UPDATE article_versions SET title=$2, summary=$3, content=$4::jsonb, content_text=$5, read_minutes=$6, published_at=$7::date, source_mdx=$8, source_filename=$9, updated_at=now(), updated_by=$10 WHERE id=$1`, [versionId, input.title, input.summary, JSON.stringify(input.content), input.contentText, input.readMinutes, input.publishedAt, input.sourceMdx, input.sourceFilename, actorId]);
      await client.query("DELETE FROM article_version_tags WHERE article_version_id = $1", [versionId]);
      for (const tag of tags) {
        const row = await client.query<{ id: string }>("SELECT id FROM tags WHERE slug = $1", [tag]);
        await client.query("INSERT INTO article_version_tags (article_version_id, tag_id, created_by, updated_by) VALUES ($1,$2,$3,$3)", [versionId, row.rows[0].id, actorId]);
      }
      await client.query("UPDATE articles SET category_id=$2, updated_at=now(), updated_by=$3 WHERE public_id=$1", [articleId, category.rows[0].id, actorId]);
    } else {
      const sequence = await client.query<{ id: string }>("SELECT nextval('article_public_id_seq')::text AS id");
      const publicId = sequence.rows[0].id;
      const article = await client.query<{ id: string }>("INSERT INTO articles (slug, public_id, category_id, archived_at, created_by, updated_by) VALUES ($1,$1,$2,now(),$3,$3) RETURNING id", [publicId, category.rows[0].id, actorId]);
      articleId = publicId;
      const version = await client.query<{ id: string }>(`INSERT INTO article_versions (article_id, version_number, status, title, summary, content, content_text, cover, read_minutes, published_at, source_mdx, source_filename, created_by, updated_by) VALUES ($1,1,'published',$2,$3,$4::jsonb,$5,'content',$6,$7::date,$8,$9,$10,$10) RETURNING id`, [article.rows[0].id, input.title, input.summary, JSON.stringify(input.content), input.contentText, input.readMinutes, input.publishedAt, input.sourceMdx, input.sourceFilename, actorId]);
      await client.query("UPDATE articles SET current_published_version_id=$2 WHERE id=$1", [article.rows[0].id, version.rows[0].id]);
      for (const tag of tags) {
        const row = await client.query<{ id: string }>("SELECT id FROM tags WHERE slug = $1", [tag]);
        await client.query("INSERT INTO article_version_tags (article_version_id, tag_id, created_by, updated_by) VALUES ($1,$2,$3,$3)", [version.rows[0].id, row.rows[0].id, actorId]);
      }
    }
    await client.query("COMMIT");
    return articleId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function listCurrentArticles(options: ArticleListOptions = {}) {
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize ?? 10)));
  const filters: string[] = ["a.del_flag = false", "a.deleted_at IS NULL", "v.id = a.current_published_version_id", "v.del_flag = false"];
  const values: unknown[] = [];
  const add = (sql: string, value: unknown) => { values.push(value); filters.push(sql.replace("?", `$${values.length}`)); };
  if (options.category) add("c.slug = ?", options.category);
  if (options.status) add("CASE WHEN a.archived_at IS NULL THEN 'visible' ELSE 'hidden' END = ?", options.status);
  if (options.search?.trim()) add("v.title ILIKE ?", `%${options.search.trim()}%`);
  const where = filters.join(" AND ");
  const total = await database().query<{ total: number }>(`SELECT count(*)::int AS total FROM articles a JOIN article_versions v ON v.id = a.current_published_version_id JOIN categories c ON c.id = a.category_id WHERE ${where}`, values);
  values.push(pageSize, (page - 1) * pageSize);
  const result = await database().query<CurrentArticleRow>(`
    ${currentArticleSelect}
    WHERE ${where}
    GROUP BY a.id, v.id, c.id ORDER BY a.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}
  `, values);
  return { articles: result.rows.map(mapCurrentArticle), total: total.rows[0]?.total ?? 0, page, pageSize };
}

export async function findCurrentArticle(publicId: string): Promise<CurrentAdminArticle | undefined> {
  const result = await database().query<CurrentArticleRow>(`
    ${currentArticleSelect}
    WHERE a.public_id = $1 AND a.del_flag = false AND a.deleted_at IS NULL AND v.del_flag = false
    GROUP BY a.id, v.id, c.id
  `, [publicId]);
  const row = result.rows[0];
  return row ? mapCurrentArticle(row) : undefined;
}

export async function getArticleCategories(): Promise<string[]> {
  const result = await database().query<{ slug: string }>(
    "SELECT slug FROM categories WHERE del_flag = false ORDER BY slug",
  );
  return result.rows.map(({ slug }) => slug);
}

export async function getArticleFormOptions() {
  const [categories, tags] = await Promise.all([
    database().query<{ slug: string; name: string }>("SELECT slug, name FROM categories WHERE del_flag = false ORDER BY name"),
    database().query<{ slug: string; name: string }>("SELECT slug, name FROM tags WHERE del_flag = false ORDER BY name"),
  ]);
  return { categories: categories.rows, tags: tags.rows };
}

export async function listAdminArticles() {
  const result = await database().query<AdminArticleVersionRow>(`
    SELECT v.id, a.public_id AS slug, v.title, v.summary, v.published_at::text AS published_at,
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
    WHERE v.id = a.current_published_version_id AND a.del_flag = false AND a.deleted_at IS NULL AND a.archived_at IS NULL AND v.del_flag = false
    GROUP BY v.id, a.id, c.id
    ORDER BY a.updated_at DESC, v.version_number DESC
  `);
  return result.rows.map(mapAdminArticleVersion);
}

export async function saveArticleDraft(input: ParsedArticle & { sourceMdx: string; images?: StoredArticleImage[] }, actorId: string): Promise<void> {
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
        INSERT INTO articles (slug, public_id, category_id, created_by, updated_by)
        VALUES ($1, $1, $2, $3, $3) RETURNING id
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

    for (const image of input.images ?? []) {
      await client.query(`
        INSERT INTO article_version_assets (article_version_id, storage_key, original_name, content_type)
        VALUES ($1, $2, $3, $4)
      `, [version.rows[0].id, image.key, image.name, image.contentType]);
    }

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

export async function findArticleImageAccess(storageKey: string): Promise<{ published: boolean } | undefined> {
  const result = await database().query<{ published: boolean }>(`
    SELECT COALESCE(a.current_published_version_id = v.id
      AND a.archived_at IS NULL AND a.deleted_at IS NULL AND a.del_flag = false, false) AS published
    FROM article_version_assets asset
    JOIN article_versions v ON v.id = asset.article_version_id AND v.del_flag = false
    JOIN articles a ON a.id = v.article_id
    WHERE asset.storage_key = $1
    LIMIT 1
  `, [storageKey]);
  return result.rows[0];
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
    WHERE (public_id = $1 OR slug = $1)
      AND del_flag = false AND deleted_at IS NULL
      AND ($2 <> 'restore' OR (current_published_version_id IS NOT NULL AND archived_at IS NOT NULL))
      AND ($2 <> 'hide' OR archived_at IS NULL)
    RETURNING id
  `, [slug, action, actorId]);
  if (!result.rowCount) throw new Error("文章不存在或没有可恢复的已发布版本。");
}
