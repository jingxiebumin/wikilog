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

  it("migrates existing article routes to numeric string ids without changing internal article keys", async () => {
    const category = await database.query<{ id: string }>("INSERT INTO categories (slug, name) VALUES ('legacy', 'Legacy') RETURNING id");
    const article = await database.query<{ id: string }>("INSERT INTO articles (slug, category_id) VALUES ('old-route', $1) RETURNING id", [category.rows[0].id]);
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0002_audit_fields.sql"), "utf8"));
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0004_article_sources.sql"), "utf8"));
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0010_qa.sql"), "utf8"));
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0014_current_article_management.sql"), "utf8"));
    const migrated = await database.query<{ id: string; slug: string; public_id: string }>("SELECT id, slug, public_id FROM articles");
    expect(migrated.rows[0].id).toBe(article.rows[0].id);
    expect(migrated.rows[0].slug).toMatch(/^\d+$/);
    expect(migrated.rows[0].public_id).toBe(migrated.rows[0].slug);
    const next = await database.query<{ id: string }>("INSERT INTO articles (slug, category_id) VALUES ('new-route', $1) RETURNING public_id AS id", [category.rows[0].id]);
    expect(next.rows[0].id).toMatch(/^\d+$/);
    expect(next.rows[0].id).not.toBe(migrated.rows[0].public_id);
  });

  it("removes archived article bodies while preserving citation references during migration", async () => {
    const category = await database.query<{ id: string }>("INSERT INTO categories (slug, name) VALUES ('history', 'History') RETURNING id");
    const article = await database.query<{ id: string }>("INSERT INTO articles (slug, category_id) VALUES ('history', $1) RETURNING id", [category.rows[0].id]);
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0002_audit_fields.sql"), "utf8"));
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0004_article_sources.sql"), "utf8"));
    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0010_qa.sql"), "utf8"));
    const versions = await database.query<{ id: string; version_number: number }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content, content_text, cover, read_minutes, published_at, source_mdx)
      VALUES
        ($1, 1, 'published', 'Current', 'Current summary', '[{"type":"paragraph","text":"Current body"}]', 'Current body', 'content', 1, CURRENT_DATE, 'Current source'),
        ($1, 2, 'archived', 'Old', 'Old summary', '[{"type":"paragraph","text":"Old body"}]', 'Old body', 'content', 1, CURRENT_DATE, 'Old source')
      RETURNING id, version_number
    `, [article.rows[0].id]);
    const currentId = versions.rows.find(({ version_number }) => version_number === 1)!.id;
    const archivedId = versions.rows.find(({ version_number }) => version_number === 2)!.id;
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [article.rows[0].id, currentId]);
    const admin = await database.query<{ id: string }>("INSERT INTO users (email, display_name, role, status) VALUES ('admin@example.test', 'Admin', 'admin', 'active') RETURNING id");
    const session = await database.query<{ id: string }>("INSERT INTO qa_sessions (admin_id) VALUES ($1) RETURNING id", [admin.rows[0].id]);
    const message = await database.query<{ id: string }>("INSERT INTO qa_messages (session_id, admin_id, quota_day, submission_sequence, question, status) VALUES ($1, $2, CURRENT_DATE, 1, 'Question', 'succeeded') RETURNING id", [session.rows[0].id, admin.rows[0].id]);
    await database.query("INSERT INTO qa_citations (message_id, article_version_id, slug, title, url, quote) VALUES ($1, $2, 'history', 'Old', '/articles/history?version=old-id', 'Old body')", [message.rows[0].id, archivedId]);

    await database.exec(await readFile(path.join(process.cwd(), "db/migrations/0014_current_article_management.sql"), "utf8"));

    await expect(database.query<{ content: unknown; content_text: string; source_mdx: string }>(
      "SELECT content, content_text, source_mdx FROM article_versions WHERE id = $1", [archivedId],
    )).resolves.toMatchObject({ rows: [{ content: [], content_text: "", source_mdx: "" }] });
    await expect(database.query<{ article_version_id: string; url: string; quote: string }>(
      "SELECT article_version_id, url, quote FROM qa_citations WHERE message_id = $1", [message.rows[0].id],
    )).resolves.toMatchObject({ rows: [{ article_version_id: archivedId, url: expect.stringMatching(/^\/articles\/\d+$/), quote: "Old body" }] });
  });
});
