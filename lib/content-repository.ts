import "server-only";
import type { QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import { getArticleText, type Article, type Category, type SearchResult } from "@/lib/content";

type ArticleRow = QueryResultRow & {
  slug: string;
  title: string;
  summary: string;
  published_at: string;
  updated_at: Date;
  status: Article["status"];
  category: string;
  tags: string[];
  read_minutes: number;
  cover: Article["cover"];
  content: Article["body"];
  favorite_count: number;
};

const articleSelect = (versionJoin: string, versionFilter: string) => `
  SELECT
    a.slug,
    v.title,
    v.summary,
    v.published_at::text AS published_at,
    v.updated_at,
    v.status,
    c.slug AS category,
    COALESCE(array_agg(DISTINCT t.slug) FILTER (WHERE t.slug IS NOT NULL), ARRAY[]::text[]) AS tags,
    v.read_minutes,
    v.cover,
    v.content,
    COUNT(DISTINCT f.id) FILTER (WHERE f.del_flag = false) AS favorite_count
  FROM articles a
  JOIN article_versions v
    ON ${versionJoin}
    AND v.del_flag = false
  JOIN categories c ON c.id = a.category_id AND c.del_flag = false
  LEFT JOIN article_version_tags avt
    ON avt.article_version_id = v.id
    AND avt.del_flag = false
  LEFT JOIN tags t ON t.id = avt.tag_id AND t.del_flag = false
  LEFT JOIN favorites f ON f.article_id = a.id
  WHERE ${versionFilter}
    AND a.del_flag = false
    AND a.archived_at IS NULL
    AND a.deleted_at IS NULL
`;

const publishedArticleSelect = articleSelect(
  "v.id = a.current_published_version_id AND v.article_id = a.id",
  "v.status = 'published'",
);

const groupByArticle = `
  GROUP BY a.id, v.id, c.id
  ORDER BY v.published_at DESC, v.created_at DESC
`;

const mapArticle = (row: ArticleRow): Article => ({
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  publishedAt: row.published_at,
  updatedAt: row.updated_at.toISOString().slice(0, 10),
  status: row.status,
  category: row.category,
  tags: row.tags,
  readMinutes: row.read_minutes,
  cover: row.cover,
  body: row.content,
  favoriteCount: row.favorite_count ?? 0,
});

const getPool = () => {
  if (!pool) throw new Error("Database repository used without DATABASE_URL.");
  return pool;
};

export async function listCategoriesFromDatabase(): Promise<Category[]> {
  const result = await getPool().query<Category>(`
    SELECT slug, name, description, tone
    FROM categories
    WHERE del_flag = false
    ORDER BY name
  `);
  return result.rows;
}

export async function findCategoryFromDatabase(slug: string): Promise<Category | undefined> {
  const result = await getPool().query<Category>(`
    SELECT slug, name, description, tone
    FROM categories
    WHERE slug = $1 AND del_flag = false
  `, [slug]);
  return result.rows[0];
}

export async function listTagsFromDatabase() {
  const result = await getPool().query<{ slug: string; name: string }>(`
    SELECT DISTINCT t.slug, t.name
    FROM tags t
    JOIN article_version_tags avt ON avt.tag_id = t.id AND avt.del_flag = false
    JOIN article_versions v ON v.id = avt.article_version_id AND v.del_flag = false
    JOIN articles a ON a.id = v.article_id
    WHERE t.del_flag = false
      AND v.status = 'published'
      AND a.current_published_version_id = v.id
      AND a.del_flag = false
      AND a.archived_at IS NULL
      AND a.deleted_at IS NULL
    ORDER BY t.name
  `);
  return result.rows;
}

export async function findTagFromDatabase(slug: string) {
  const result = await getPool().query<{ slug: string; name: string }>(`
    SELECT DISTINCT t.slug, t.name
    FROM tags t
    JOIN article_version_tags avt ON avt.tag_id = t.id AND avt.del_flag = false
    JOIN article_versions v ON v.id = avt.article_version_id AND v.del_flag = false
    JOIN articles a ON a.id = v.article_id
    WHERE t.slug = $1
      AND t.del_flag = false
      AND v.status = 'published'
      AND a.current_published_version_id = v.id
      AND a.del_flag = false
      AND a.archived_at IS NULL
      AND a.deleted_at IS NULL
  `, [slug]);
  return result.rows[0];
}

export async function listPublishedArticlesFromDatabase(): Promise<Article[]> {
  const result = await getPool().query<ArticleRow>(publishedArticleSelect + groupByArticle);
  return result.rows.map(mapArticle);
}

export async function listPublishedArticlePageFromDatabase(
  categorySlug: string,
  requestedLimit = 10,
  requestedOffset = 0,
): Promise<{ articles: Article[]; totalCount: number }> {
  const limit = Math.max(1, Math.min(Math.floor(requestedLimit) || 10, 50));
  const offset = Math.max(0, Math.floor(requestedOffset) || 0);
  const byCategory = categorySlug !== "all";
  const filter = byCategory ? " AND c.slug = $1" : "";
  const params = byCategory ? [categorySlug] : [];
  const limitPosition = params.length + 1;
  const offsetPosition = params.length + 2;
  const [page, count] = await Promise.all([
    getPool().query<ArticleRow>(
      publishedArticleSelect + filter + `\n${groupByArticle.replace("ORDER BY v.published_at DESC, v.created_at DESC", `ORDER BY v.published_at DESC, v.created_at DESC LIMIT $${limitPosition} OFFSET $${offsetPosition}`)}`,
      [...params, limit, offset],
    ),
    getPool().query<{ total_count: number }>(`
      SELECT COUNT(*)::int AS total_count
      FROM articles a
      JOIN article_versions v ON v.id = a.current_published_version_id
        AND v.article_id = a.id AND v.status = 'published' AND v.del_flag = false
      JOIN categories c ON c.id = a.category_id AND c.del_flag = false
      WHERE a.del_flag = false AND a.archived_at IS NULL AND a.deleted_at IS NULL${filter}
    `, params),
  ]);
  return { articles: page.rows.map(mapArticle), totalCount: count.rows[0]?.total_count ?? 0 };
}

export async function findPublishedArticleFromDatabase(slug: string): Promise<Article | undefined> {
  const result = await getPool().query<ArticleRow>(
    publishedArticleSelect + " AND a.slug = $1\n" + groupByArticle,
    [slug],
  );
  return result.rows[0] ? mapArticle(result.rows[0]) : undefined;
}

export async function listCategoryArticlesFromDatabase(categorySlug: string): Promise<Article[]> {
  const result = await getPool().query<ArticleRow>(
    publishedArticleSelect + " AND c.slug = $1\n" + groupByArticle,
    [categorySlug],
  );
  return result.rows.map(mapArticle);
}

export async function listTagArticlesFromDatabase(tagSlug: string): Promise<Article[]> {
  const result = await getPool().query<ArticleRow>(
    publishedArticleSelect + " AND t.slug = $1\n" + groupByArticle,
    [tagSlug],
  );
  return result.rows.map(mapArticle);
}

const makeSnippet = (text: string, query: string, index: number) => {
  const start = Math.max(0, index - 42);
  const end = Math.min(text.length, index + query.length + 96);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
};

export async function searchPublishedArticlesFromDatabase(rawQuery: string): Promise<SearchResult[]> {
  const query = rawQuery.trim();
  if (!query) return [];

  const result = await getPool().query<ArticleRow & { title_match: boolean }>(`
    ${publishedArticleSelect.replace("SELECT\n", "SELECT\n      (position(lower($1) in lower(v.title)) > 0) AS title_match,\n")}
      AND (
        position(lower($1) in lower(v.title)) > 0
        OR position(lower($1) in lower(v.summary || ' ' || v.content_text)) > 0
      )
    ${groupByArticle.replace("GROUP BY a.id, v.id, c.id", "GROUP BY a.id, v.id, c.id")}
  `, [query]);

  return result.rows
    .map((row) => {
      const article = mapArticle(row);
      const matchType = row.title_match ? "title" : "body";
      const body = `${article.summary} ${getArticleText(article)}`;
      const index = body.toLocaleLowerCase("zh-CN").indexOf(query.toLocaleLowerCase("zh-CN"));
      return {
        article,
        matchType,
        snippet: matchType === "title" || index < 0 ? article.summary : makeSnippet(body, query, index),
      } satisfies SearchResult;
    })
    .sort((left, right) => {
      if (left.matchType !== right.matchType) return left.matchType === "title" ? -1 : 1;
      return right.article.publishedAt.localeCompare(left.article.publishedAt);
    });
}
