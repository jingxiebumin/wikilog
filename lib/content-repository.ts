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
};

const publishedArticleSelect = `
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
    v.content
  FROM articles a
  JOIN article_versions v
    ON v.id = a.current_published_version_id
    AND v.article_id = a.id
  JOIN categories c ON c.id = a.category_id
  LEFT JOIN article_version_tags avt ON avt.article_version_id = v.id
  LEFT JOIN tags t ON t.id = avt.tag_id
  WHERE v.status = 'published'
    AND a.archived_at IS NULL
    AND a.deleted_at IS NULL
`;

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
});

const getPool = () => {
  if (!pool) throw new Error("Database repository used without DATABASE_URL.");
  return pool;
};

export async function listCategoriesFromDatabase(): Promise<Category[]> {
  const result = await getPool().query<Category>(`
    SELECT slug, name, description, tone
    FROM categories
    ORDER BY name
  `);
  return result.rows;
}

export async function findCategoryFromDatabase(slug: string): Promise<Category | undefined> {
  const result = await getPool().query<Category>(`
    SELECT slug, name, description, tone
    FROM categories
    WHERE slug = $1
  `, [slug]);
  return result.rows[0];
}

export async function listTagsFromDatabase() {
  const result = await getPool().query<{ slug: string; name: string }>(`
    SELECT DISTINCT t.slug, t.name
    FROM tags t
    JOIN article_version_tags avt ON avt.tag_id = t.id
    JOIN article_versions v ON v.id = avt.article_version_id
    JOIN articles a ON a.id = v.article_id
    WHERE v.status = 'published'
      AND a.current_published_version_id = v.id
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
    JOIN article_version_tags avt ON avt.tag_id = t.id
    JOIN article_versions v ON v.id = avt.article_version_id
    JOIN articles a ON a.id = v.article_id
    WHERE t.slug = $1
      AND v.status = 'published'
      AND a.current_published_version_id = v.id
      AND a.archived_at IS NULL
      AND a.deleted_at IS NULL
  `, [slug]);
  return result.rows[0];
}

export async function listPublishedArticlesFromDatabase(): Promise<Article[]> {
  const result = await getPool().query<ArticleRow>(publishedArticleSelect + groupByArticle);
  return result.rows.map(mapArticle);
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
