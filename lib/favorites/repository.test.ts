import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ database: undefined as PGlite | undefined }));

vi.mock("@/lib/db", () => ({
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => state.database!.query(...args),
  },
}));

import { addFavorite, hasFavorite, listFavoritesForUser, removeFavorite } from "./repository";

describe("favorite repository", () => {
  let database: PGlite;
  let readerId: string;
  let otherReaderId: string;
  let articleId: string;

  beforeEach(async () => {
    database = new PGlite();
    state.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0004_article_sources.sql", "0005_favorites.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const users = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active'),
        ('other@example.test', 'Other', 'hash', 'reader', 'active') RETURNING id
    `);
    [readerId, otherReaderId] = users.rows.map(({ id }) => id);
    const category = await database.query<{ id: string }>("INSERT INTO categories (slug, name) VALUES ('engineering', 'Engineering') RETURNING id");
    const article = await database.query<{ id: string }>("INSERT INTO articles (slug, category_id) VALUES ('favorite-me', $1) RETURNING id", [category.rows[0].id]);
    articleId = article.rows[0].id;
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, cover, read_minutes, published_at)
      VALUES ($1, 1, 'published', 'Favorite me', 'Summary', 'content', 1, '2026-11-01') RETURNING id
    `, [articleId]);
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [articleId, version.rows[0].id]);
  });

  afterEach(async () => {
    state.database = undefined;
    await database.close();
  });

  it("adds a favorite idempotently, hides it while unavailable, and restores it with its original time", async () => {
    expect(await addFavorite(readerId, "favorite-me")).toBe(true);
    const firstTimestamp = await database.query<{ created_at: string }>("SELECT created_at::text FROM favorites WHERE user_id = $1", [readerId]);
    expect(await addFavorite(readerId, "favorite-me")).toBe(false);
    expect(await listFavoritesForUser(readerId)).toHaveLength(1);
    expect(await hasFavorite(readerId, "favorite-me")).toBe(true);

    await database.query("UPDATE articles SET archived_at = now() WHERE id = $1", [articleId]);
    expect(await listFavoritesForUser(readerId)).toHaveLength(0);
    expect(await addFavorite(readerId, "favorite-me")).toBe(false);
    await database.query("UPDATE articles SET archived_at = NULL WHERE id = $1", [articleId]);
    expect(await listFavoritesForUser(readerId)).toHaveLength(1);
    const restoredTimestamp = await database.query<{ created_at: string }>("SELECT created_at::text FROM favorites WHERE user_id = $1", [readerId]);
    expect(restoredTimestamp.rows[0].created_at).toBe(firstTimestamp.rows[0].created_at);
  });

  it("does not expose another reader's favorite and cascades on account deletion", async () => {
    await addFavorite(readerId, "favorite-me");
    expect(await listFavoritesForUser(otherReaderId)).toEqual([]);
    await removeFavorite(otherReaderId, "favorite-me");
    expect(await listFavoritesForUser(readerId)).toHaveLength(1);
    await database.query("DELETE FROM users WHERE id = $1", [readerId]);
    const remaining = await database.query("SELECT id FROM favorites WHERE user_id = $1", [readerId]);
    expect(remaining.rows).toEqual([]);
  });
});
