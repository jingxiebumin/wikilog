import "server-only";
import { pool } from "@/lib/db";
import type { Article } from "@/lib/content";

const database = () => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

export async function listFavoritesForUser(userId: string): Promise<Article[]> {
  const result = await database().query<Article>(`
    SELECT a.slug, v.title, v.summary, v.published_at::text AS "publishedAt", v.updated_at AS "updatedAt",
      v.status, c.slug AS category,
      COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), ARRAY[]::text[]) AS tags,
      v.read_minutes AS "readMinutes", v.cover, v.content AS body
    FROM favorites f
    JOIN articles a ON a.id = f.article_id AND a.del_flag = false AND a.archived_at IS NULL AND a.deleted_at IS NULL
    JOIN article_versions v ON v.id = a.current_published_version_id AND v.article_id = a.id
      AND v.status = 'published' AND v.del_flag = false
    JOIN categories c ON c.id = a.category_id AND c.del_flag = false
    LEFT JOIN article_version_tags avt ON avt.article_version_id = v.id AND avt.del_flag = false
    LEFT JOIN tags t ON t.id = avt.tag_id AND t.del_flag = false
    WHERE f.user_id = $1 AND f.del_flag = false
    GROUP BY f.id, a.id, v.id, c.id
    ORDER BY f.created_at DESC
  `, [userId]);
  return result.rows;
}

export async function addFavorite(userId: string, slug: string): Promise<boolean> {
  const result = await database().query<{ id: string }>(`
    INSERT INTO favorites (user_id, article_id, created_by, updated_by)
    SELECT $1, a.id, $1, $1
    FROM articles a
    JOIN article_versions v ON v.id = a.current_published_version_id AND v.article_id = a.id
      AND v.status = 'published' AND v.del_flag = false
    WHERE a.slug = $2 AND a.del_flag = false AND a.archived_at IS NULL AND a.deleted_at IS NULL
    ON CONFLICT (user_id, article_id) DO NOTHING
    RETURNING id
  `, [userId, slug]);
  if (result.rowCount) return true;

  const existing = await database().query<{ id: string }>(`
    SELECT f.id FROM favorites f
    JOIN articles a ON a.id = f.article_id AND a.slug = $2
    WHERE f.user_id = $1 AND f.del_flag = false
  `, [userId, slug]);
  if (existing.rows[0]) return false;
  throw new Error("文章不存在或当前不可收藏。");
}

export async function removeFavorite(userId: string, slug: string): Promise<void> {
  await database().query(`
    DELETE FROM favorites f USING articles a
    WHERE f.article_id = a.id AND f.user_id = $1 AND a.slug = $2
  `, [userId, slug]);
}

export async function hasFavorite(userId: string, slug: string): Promise<boolean> {
  const result = await database().query<{ present: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM favorites f JOIN articles a ON a.id = f.article_id
      WHERE f.user_id = $1 AND a.slug = $2 AND f.del_flag = false
    ) AS present
  `, [userId, slug]);
  return result.rows[0]?.present ?? false;
}
