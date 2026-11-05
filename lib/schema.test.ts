import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("initial PostgreSQL schema", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    const migration = await readFile(path.join(process.cwd(), "db/migrations/0001_initial.sql"), "utf8");
    await database.exec(migration);
  });

  afterEach(async () => {
    await database.close();
  });

  it("exposes only the article version explicitly selected as published", async () => {
    const category = await database.query<{ id: string }>(`
      INSERT INTO categories (slug, name, tone)
      VALUES ('engineering', '工程实践', 'coral')
      RETURNING id
    `);
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, category_id)
      VALUES ('database-boundary', $1)
      RETURNING id
    `, [category.rows[0].id]);
    const published = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, cover, read_minutes, published_at)
      VALUES ($1, 1, 'published', '公开版本', '摘要', 'boundary', 3, '2026-10-01')
      RETURNING id
    `, [article.rows[0].id]);
    await database.query(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, cover, read_minutes)
      VALUES ($1, 2, 'draft', '待发布版本', '草稿摘要', 'boundary', 4)
    `, [article.rows[0].id]);
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [
      article.rows[0].id,
      published.rows[0].id,
    ]);

    const visible = await database.query<{ title: string }>(`
      SELECT v.title
      FROM articles a
      JOIN article_versions v ON v.id = a.current_published_version_id AND v.article_id = a.id
      WHERE v.status = 'published'
        AND a.archived_at IS NULL
        AND a.deleted_at IS NULL
    `);

    expect(visible.rows).toEqual([{ title: "公开版本" }]);
  });

  it("enforces case-insensitive email uniqueness", async () => {
    await database.query("INSERT INTO users (email, display_name) VALUES ('reader@example.test', 'Reader')");

    await expect(database.query(
      "INSERT INTO users (email, display_name) VALUES ('READER@example.test', 'Another')",
    )).rejects.toThrow();
  });
});
