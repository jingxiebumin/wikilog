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

  it("adds audit fields to every business table and backfills deleted articles", async () => {
    const category = await database.query<{ id: string }>(`
      INSERT INTO categories (slug, name, tone)
      VALUES ('legacy', '旧分类', 'blue')
      RETURNING id
    `);
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, category_id, deleted_at)
      VALUES ('legacy-deleted', $1, now())
      RETURNING id
    `, [category.rows[0].id]);
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, cover, read_minutes)
      VALUES ($1, 1, 'draft', '旧草稿', '摘要', 'boundary', 3)
      RETURNING id
    `, [article.rows[0].id]);
    const tag = await database.query<{ id: string }>(`
      INSERT INTO tags (slug, name)
      VALUES ('legacy-tag', '旧标签')
      RETURNING id
    `);
    const association = await database.query<{ created_at: string }>(`
      INSERT INTO article_version_tags (article_version_id, tag_id)
      VALUES ($1, $2)
      RETURNING created_at::text
    `, [version.rows[0].id, tag.rows[0].id]);

    const auditMigration = await readFile(path.join(process.cwd(), "db/migrations/0002_audit_fields.sql"), "utf8");
    await database.exec(auditMigration);

    const businessTables = ["users", "categories", "tags", "articles", "article_versions", "article_version_tags"];
    const columns = await database.query<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'categories', 'tags', 'articles', 'article_versions', 'article_version_tags')
    `);
    const columnsByTable = new Map<string, Set<string>>();
    for (const { table_name: tableName, column_name: columnName } of columns.rows) {
      const tableColumns = columnsByTable.get(tableName) ?? new Set<string>();
      tableColumns.add(columnName);
      columnsByTable.set(tableName, tableColumns);
    }
    for (const table of businessTables) {
      expect([...columnsByTable.get(table)!]).toEqual(expect.arrayContaining([
        "created_at", "created_by", "updated_at", "updated_by", "del_flag",
      ]));
    }

    const deletedArticle = await database.query<{ del_flag: boolean }>(
      "SELECT del_flag FROM articles WHERE id = $1",
      [article.rows[0].id],
    );
    const linkTimestamps = await database.query<{ preserved: boolean }>(`
      SELECT created_at = updated_at AS preserved
      FROM article_version_tags
      WHERE article_version_id = $1 AND tag_id = $2
    `, [version.rows[0].id, tag.rows[0].id]);

    expect(deletedArticle.rows[0].del_flag).toBe(true);
    expect(linkTimestamps.rows[0].preserved).toBe(true);
    expect(association.rows[0].created_at).toBeTruthy();
  });

  it("adds source MDX storage without changing existing article versions", async () => {
    const category = await database.query<{ id: string }>(`
      INSERT INTO categories (slug, name, tone) VALUES ('source-test', 'Source test', 'blue') RETURNING id
    `);
    const article = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, category_id) VALUES ('source-test', $1) RETURNING id
    `, [category.rows[0].id]);
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, cover, read_minutes)
      VALUES ($1, 1, 'draft', 'Legacy draft', 'Summary', 'content', 1) RETURNING id
    `, [article.rows[0].id]);
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0002_audit_fields.sql"), "utf8"));
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0004_article_sources.sql"), "utf8"));
    const source = await database.query<{ source_mdx: string }>("SELECT source_mdx FROM article_versions WHERE id = $1", [version.rows[0].id]);
    expect(source.rows[0].source_mdx).toBe("");
  });
});
