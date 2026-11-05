import { Pool } from "pg";
import { config } from "dotenv";
import { articles, categories, getArticleText, tagCatalog } from "../lib/content";

config({ path: ".env.local" });
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required. Copy .env.example to .env.local or export DATABASE_URL.");
}

const pool = new Pool({ connectionString, max: 2, application_name: "wikilog-seed" });
const labels = new Map(tagCatalog.map((tag) => [tag.slug, tag.name]));
for (const article of articles) {
  for (const slug of article.tags) {
    if (!labels.has(slug)) labels.set(slug, slug.replaceAll("-", " "));
  }
}

try {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const categoryIds = new Map<string, string>();
    for (const category of categories) {
      const result = await client.query<{ id: string }>(`
        INSERT INTO categories (slug, name, description, tone)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          tone = EXCLUDED.tone,
          updated_at = now()
        RETURNING id
      `, [category.slug, category.name, category.description, category.tone]);
      categoryIds.set(category.slug, result.rows[0].id);
    }

    const tagIds = new Map<string, string>();
    for (const [slug, name] of labels) {
      const result = await client.query<{ id: string }>(`
        INSERT INTO tags (slug, name)
        VALUES ($1, $2)
        ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
        RETURNING id
      `, [slug, name]);
      tagIds.set(slug, result.rows[0].id);
    }

    for (const article of articles) {
      const categoryId = categoryIds.get(article.category);
      if (!categoryId) throw new Error(`Missing category for article: ${article.slug}`);

      const articleResult = await client.query<{ id: string }>(`
        INSERT INTO articles (slug, category_id)
        VALUES ($1, $2)
        ON CONFLICT (slug) DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = now()
        RETURNING id
      `, [article.slug, categoryId]);
      const articleId = articleResult.rows[0].id;

      const versionResult = await client.query<{ id: string }>(`
        INSERT INTO article_versions (
          article_id, version_number, status, title, summary, content, content_text,
          cover, read_minutes, published_at
        )
        VALUES ($1, 1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9::date)
        ON CONFLICT (article_id, version_number) DO UPDATE SET
          status = EXCLUDED.status,
          title = EXCLUDED.title,
          summary = EXCLUDED.summary,
          content = EXCLUDED.content,
          content_text = EXCLUDED.content_text,
          cover = EXCLUDED.cover,
          read_minutes = EXCLUDED.read_minutes,
          published_at = EXCLUDED.published_at,
          updated_at = now()
        RETURNING id
      `, [
        articleId,
        article.status,
        article.title,
        article.summary,
        JSON.stringify(article.body),
        `${article.summary} ${getArticleText(article)}`,
        article.cover,
        article.readMinutes,
        article.status === "published" ? article.publishedAt : null,
      ]);
      const versionId = versionResult.rows[0].id;

      await client.query("DELETE FROM article_version_tags WHERE article_version_id = $1", [versionId]);
      for (const slug of article.tags) {
        const tagId = tagIds.get(slug);
        if (!tagId) throw new Error(`Missing tag ${slug} for article ${article.slug}`);
        await client.query(`
          INSERT INTO article_version_tags (article_version_id, tag_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [versionId, tagId]);
      }

      await client.query(`
        UPDATE articles
        SET current_published_version_id = $2, updated_at = now()
        WHERE id = $1
      `, [articleId, article.status === "published" ? versionId : null]);
    }

    await client.query("COMMIT");
    process.stdout.write(`Seeded ${categories.length} categories, ${labels.size} tags, ${articles.length} articles.\n`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
