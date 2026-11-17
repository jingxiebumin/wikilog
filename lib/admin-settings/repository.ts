import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";

type Database = NonNullable<typeof pool>;
export type TaxonomyType = "category" | "tag";
export type TaxonomyItem = { id: string; slug: string; name: string };

const database = (): Database => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

function tableFor(type: TaxonomyType) {
  return type === "category" ? "categories" : "tags";
}

export async function listTaxonomy(): Promise<{ categories: TaxonomyItem[]; tags: TaxonomyItem[] }> {
  const db = database();
  const [categories, tags] = await Promise.all([
    db.query<TaxonomyItem & QueryResultRow>(
      "SELECT id, slug, name FROM categories WHERE del_flag = false ORDER BY name, slug",
    ),
    db.query<TaxonomyItem & QueryResultRow>(
      "SELECT id, slug, name FROM tags WHERE del_flag = false ORDER BY name, slug",
    ),
  ]);
  return { categories: categories.rows, tags: tags.rows };
}

export async function createTaxonomyItem(type: TaxonomyType, slug: string, name: string, actorId: string): Promise<TaxonomyItem> {
  const table = tableFor(type);
  const result = await database().query<TaxonomyItem & QueryResultRow>(`
    INSERT INTO ${table} (slug, name, created_by, updated_by)
    VALUES ($1, $2, $3, $3)
    RETURNING id, slug, name
  `, [slug, name, actorId]);
  return result.rows[0];
}

export async function renameTaxonomyItem(type: TaxonomyType, id: string, name: string, actorId: string): Promise<TaxonomyItem | undefined> {
  const table = tableFor(type);
  const result = await database().query<TaxonomyItem & QueryResultRow>(`
    UPDATE ${table}
    SET name = $2, updated_at = now(), updated_by = $3
    WHERE id = $1 AND del_flag = false
    RETURNING id, slug, name
  `, [id, name, actorId]);
  return result.rows[0];
}

async function itemIsUsed(client: PoolClient, type: TaxonomyType, id: string): Promise<boolean> {
  const result = type === "category"
    ? await client.query<{ used: boolean } & QueryResultRow>(
      "SELECT EXISTS (SELECT 1 FROM articles WHERE category_id = $1) AS used", [id],
    )
    : await client.query<{ used: boolean } & QueryResultRow>(
      "SELECT EXISTS (SELECT 1 FROM article_version_tags WHERE tag_id = $1) AS used", [id],
    );
  return result.rows[0]?.used ?? false;
}

export async function deleteTaxonomyItem(type: TaxonomyType, id: string, actorId: string): Promise<"deleted" | "in-use" | "missing"> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const table = tableFor(type);
    const locked = await client.query<{ id: string } & QueryResultRow>(
      `SELECT id FROM ${table} WHERE id = $1 AND del_flag = false FOR UPDATE`, [id],
    );
    if (!locked.rows[0]) {
      await client.query("ROLLBACK");
      return "missing";
    }
    if (await itemIsUsed(client, type, id)) {
      await client.query("ROLLBACK");
      return "in-use";
    }
    await client.query(`
      UPDATE ${table} SET del_flag = true, updated_at = now(), updated_by = $2 WHERE id = $1
    `, [id, actorId]);
    await client.query("COMMIT");
    return "deleted";
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
