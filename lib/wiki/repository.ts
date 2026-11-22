import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import type { WikiGenerationJob, WikiGenerationCandidate } from "./generation";

type Database = NonNullable<typeof pool>;
type WikiPageRow = QueryResultRow & {
  id: string;
  slug: string;
  state: "active" | "merged";
  current_published_version_id: string | null;
  redirect_to_slug: string | null;
  version_id: string;
  version_number: number;
  title: string;
  body: string;
};

export type WikiPageSource = {
  articleVersionId: string;
  articleSlug: string;
  articleTitle: string;
};

export type PublishedWikiPage = {
  id: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  title: string;
  body: string;
  sources: WikiPageSource[];
  relatedPages: Array<{ slug: string; title: string }>;
  redirectTo?: string;
};

export type WikiPageVersion = {
  id: string;
  versionNumber: number;
  status: "draft" | "published" | "archived";
  title: string;
  body: string;
  createdAt: string;
  sources: WikiPageSource[];
  relatedSlugs: string[];
  mergeSourceSlug?: string;
};

export type SaveWikiPageDraftInput = {
  slug: string;
  title: string;
  body: string;
  sourceArticleVersionIds: string[];
  relatedSlugs: string[];
};

const database = (): Database => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

const validPublishedSource = (versionAlias: string) => `
  EXISTS (
    SELECT 1
    FROM wiki_page_version_sources source
    JOIN article_versions article_version
      ON article_version.id = source.article_version_id
      AND article_version.status = 'published'
      AND article_version.del_flag = false
    JOIN articles article
      ON article.id = article_version.article_id
      AND article.current_published_version_id = article_version.id
      AND article.del_flag = false
      AND article.archived_at IS NULL
      AND article.deleted_at IS NULL
    WHERE source.page_version_id = ${versionAlias}.id
      AND source.del_flag = false
  )
`;

function mapPublicPage(row: WikiPageRow): PublishedWikiPage {
  return {
    id: row.id,
    slug: row.slug,
    versionId: row.version_id,
    versionNumber: row.version_number,
    title: row.title,
    body: row.body,
    sources: [],
    relatedPages: [],
  };
}

async function publicPageBySlug(slug: string): Promise<PublishedWikiPage | undefined> {
  const result = await database().query<WikiPageRow>(`
    SELECT page.id, page.slug, page.state, page.current_published_version_id,
      redirect.slug AS redirect_to_slug, page_version.id AS version_id,
      page_version.version_number, page_version.title, page_version.body
    FROM wiki_pages page
    LEFT JOIN wiki_pages redirect ON redirect.id = page.redirect_to_page_id
    JOIN wiki_page_versions page_version
      ON page_version.id = page.current_published_version_id
      AND page_version.page_id = page.id
      AND page_version.status = 'published'
      AND page_version.del_flag = false
    WHERE page.slug = $1 AND page.state = 'active' AND page.del_flag = false
      AND ${validPublishedSource("page_version")}
  `, [slug]);
  const row = result.rows[0];
  if (!row) {
    const merged = await database().query<{ id: string; slug: string; redirect_to_slug: string }>(`
      SELECT page.id, page.slug, target.slug AS redirect_to_slug
      FROM wiki_pages page
      JOIN wiki_pages target ON target.id = page.redirect_to_page_id AND target.state = 'active' AND target.del_flag = false
      WHERE page.slug = $1 AND page.state = 'merged' AND page.del_flag = false
    `, [slug]);
    const redirect = merged.rows[0];
    return redirect ? {
      id: redirect.id,
      slug: redirect.slug,
      versionId: "",
      versionNumber: 0,
      title: "",
      body: "",
      sources: [],
      relatedPages: [],
      redirectTo: `/wiki/${redirect.redirect_to_slug}`,
    } : undefined;
  }

  const page = mapPublicPage(row);
  const [sources, relations] = await Promise.all([
    database().query<WikiPageSource & QueryResultRow>(`
      SELECT article_version.id AS "articleVersionId", article.public_id AS "articleSlug",
        article_version.title AS "articleTitle"
      FROM wiki_page_version_sources source
      JOIN article_versions article_version ON article_version.id = source.article_version_id
        AND article_version.status = 'published' AND article_version.del_flag = false
      JOIN articles article ON article.id = article_version.article_id
        AND article.current_published_version_id = article_version.id
        AND article.del_flag = false AND article.archived_at IS NULL AND article.deleted_at IS NULL
      WHERE source.page_version_id = $1 AND source.del_flag = false
      ORDER BY article_version.title, article_version.id
    `, [page.versionId]),
    database().query<{ slug: string; title: string } & QueryResultRow>(`
      SELECT target.slug, target_version.title
      FROM wiki_page_version_relations relation
      JOIN wiki_pages target ON target.id = relation.related_page_id
        AND target.state = 'active' AND target.del_flag = false
      JOIN wiki_page_versions target_version ON target_version.id = target.current_published_version_id
        AND target_version.page_id = target.id AND target_version.status = 'published' AND target_version.del_flag = false
      WHERE relation.page_version_id = $1 AND relation.del_flag = false
        AND ${validPublishedSource("target_version")}
      ORDER BY target_version.title, target.slug
    `, [page.versionId]),
  ]);
  page.sources = sources.rows;
  page.relatedPages = relations.rows;
  return page;
}

export async function listPublishedWikiPages(): Promise<PublishedWikiPage[]> {
  const result = await database().query<{ slug: string } & QueryResultRow>(`
    SELECT page.slug
    FROM wiki_pages page
    JOIN wiki_page_versions page_version ON page_version.id = page.current_published_version_id
      AND page_version.page_id = page.id AND page_version.status = 'published' AND page_version.del_flag = false
    WHERE page.state = 'active' AND page.del_flag = false AND ${validPublishedSource("page_version")}
    ORDER BY page_version.title, page.slug
  `);
  const pages = await Promise.all(result.rows.map(({ slug }) => publicPageBySlug(slug)));
  return pages.filter((page): page is PublishedWikiPage => page !== undefined);
}

export async function findPublishedWikiPage(slug: string): Promise<PublishedWikiPage | undefined> {
  return publicPageBySlug(slug);
}

export async function searchPublishedWikiPages(query: string, limit = 5): Promise<PublishedWikiPage[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 20));
  const result = await database().query<{ slug: string } & QueryResultRow>(`
    SELECT page.slug
    FROM wiki_pages page
    JOIN wiki_page_versions page_version ON page_version.id = page.current_published_version_id
      AND page_version.page_id = page.id AND page_version.status = 'published' AND page_version.del_flag = false
    WHERE page.state = 'active' AND page.del_flag = false AND ${validPublishedSource("page_version")}
      AND position(lower($1) IN lower(page_version.title || ' ' || page_version.body)) > 0
    ORDER BY (position(lower($1) IN lower(page_version.title)) > 0) DESC, page_version.title, page.slug
    LIMIT $2
  `, [normalizedQuery, boundedLimit]);
  const pages = await Promise.all(result.rows.map(({ slug }) => publicPageBySlug(slug)));
  return pages.filter((page): page is PublishedWikiPage => page !== undefined);
}

async function validateSources(client: PoolClient, articleVersionIds: string[]) {
  const distinctIds = [...new Set(articleVersionIds)];
  if (distinctIds.length === 0) throw new Error("Wiki 页面至少需要一个有效文章来源。");
  const valid = await client.query<{ id: string }>(`
    SELECT version.id
    FROM article_versions version
    JOIN articles article ON article.id = version.article_id
      AND article.current_published_version_id = version.id
      AND article.del_flag = false AND article.archived_at IS NULL AND article.deleted_at IS NULL
    WHERE version.id = ANY($1::uuid[]) AND version.status = 'published' AND version.del_flag = false
  `, [distinctIds]);
  if (valid.rowCount !== distinctIds.length) throw new Error("来源文章版本当前不可用。");
  return distinctIds;
}

async function insertDraft(
  client: PoolClient,
  input: SaveWikiPageDraftInput,
  actorId: string,
  mergeSourcePageId?: string,
) {
  const sourceIds = await validateSources(client, input.sourceArticleVersionIds);
  const pageResult = await client.query<{ id: string }>(`
    INSERT INTO wiki_pages (slug, created_by, updated_by)
    VALUES ($1, $2, $2)
    ON CONFLICT (slug) DO UPDATE SET updated_at = now(), updated_by = EXCLUDED.updated_by
      WHERE wiki_pages.state = 'active' AND wiki_pages.del_flag = false
    RETURNING id
  `, [input.slug, actorId]);
  const pageId = pageResult.rows[0]?.id;
  if (!pageId) throw new Error("Wiki 页面不存在或已合并。");

  const locked = await client.query<{ id: string }>("SELECT id FROM wiki_pages WHERE id = $1 FOR UPDATE", [pageId]);
  if (!locked.rows[0]) throw new Error("Wiki 页面不存在。");
  const existingDraft = await client.query<{ id: string }>(`
    SELECT id FROM wiki_page_versions
    WHERE page_id = $1 AND status = 'draft' AND del_flag = false
    FOR UPDATE
  `, [pageId]);
  const version = existingDraft.rows[0]
    ? await client.query<{ id: string }>(`
      UPDATE wiki_page_versions SET title = $2, body = $3,
        merge_source_page_id = COALESCE($4, merge_source_page_id),
        updated_at = now(), updated_by = $5 WHERE id = $1 RETURNING id
    `, [existingDraft.rows[0].id, input.title.trim(), input.body.trim(), mergeSourcePageId ?? null, actorId])
    : await client.query<{ id: string }>(`
      INSERT INTO wiki_page_versions (
        page_id, version_number, status, title, body, merge_source_page_id, created_by, updated_by
      ) VALUES (
        $1, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM wiki_page_versions WHERE page_id = $1),
        'draft', $2, $3, $4, $5, $5
      ) RETURNING id
    `, [pageId, input.title.trim(), input.body.trim(), mergeSourcePageId ?? null, actorId]);

  await client.query("DELETE FROM wiki_page_version_sources WHERE page_version_id = $1", [version.rows[0].id]);
  await client.query("DELETE FROM wiki_page_version_relations WHERE page_version_id = $1", [version.rows[0].id]);

  for (const articleVersionId of sourceIds) {
    await client.query(`
      INSERT INTO wiki_page_version_sources (page_version_id, article_version_id, created_by, updated_by)
      VALUES ($1, $2, $3, $3)
    `, [version.rows[0].id, articleVersionId, actorId]);
  }

  const relationSlugs = [...new Set(input.relatedSlugs)];
  if (relationSlugs.includes(input.slug)) throw new Error("Wiki 页面不能关联自身。");
  if (relationSlugs.length > 0) {
    const related = await client.query<{ id: string; slug: string }>(`
      SELECT page.id, page.slug FROM wiki_pages page
      JOIN wiki_page_versions version ON version.id = page.current_published_version_id
        AND version.page_id = page.id AND version.status = 'published' AND version.del_flag = false
      WHERE page.slug = ANY($1::text[]) AND page.state = 'active' AND page.del_flag = false
        AND ${validPublishedSource("version")}
    `, [relationSlugs]);
    if (related.rowCount !== relationSlugs.length) throw new Error("相关 Wiki 页面当前不可用。");
    for (const target of related.rows) {
      await client.query(`
        INSERT INTO wiki_page_version_relations (page_version_id, related_page_id, created_by, updated_by)
        VALUES ($1, $2, $3, $3)
      `, [version.rows[0].id, target.id, actorId]);
    }
  }
  return { pageId, versionId: version.rows[0].id, slug: input.slug };
}

export async function saveWikiPageDraft(input: SaveWikiPageDraftInput, actorId: string) {
  const slug = input.slug.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Wiki 页面地址格式无效。");
  if (!input.title.trim() || !input.body.trim()) throw new Error("Wiki 页面标题和正文不能为空。");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const result = await insertDraft(client, { ...input, slug }, actorId);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveWikiPageDraftsBatch(inputs: SaveWikiPageDraftInput[], actorId: string) {
  if (inputs.length === 0) throw new Error("Wiki 草稿不能为空。");
  const normalized = inputs.map((input) => {
    const slug = input.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Wiki 页面地址格式无效。");
    if (!input.title.trim() || !input.body.trim()) throw new Error("Wiki 页面标题和正文不能为空。");
    return { ...input, slug };
  });
  if (new Set(normalized.map(({ slug }) => slug)).size !== normalized.length) {
    throw new Error("候选 Wiki 页面不能包含重复地址。");
  }

  const client = await database().connect();
  try {
    await client.query("BEGIN");
    for (const input of normalized) {
      await client.query(`
        INSERT INTO wiki_pages (slug, created_by, updated_by)
        VALUES ($1, $2, $2)
        ON CONFLICT (slug) DO NOTHING
      `, [input.slug, actorId]);
    }
    const results: Array<{ pageId: string; versionId: string; slug: string }> = [];
    for (const input of normalized) {
      results.push(await insertDraft(client, input, actorId));
    }
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function persistGeneratedWikiDrafts(
  job: WikiGenerationJob,
  inputs: WikiGenerationCandidate[],
  usage: { inputTokens: number; outputTokens: number },
) {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<{ status: string }>(`
      SELECT status FROM wiki_generation_jobs WHERE id = $1 FOR UPDATE
    `, [job.id]);
    if (locked.rows[0]?.status !== "running") {
      await client.query("COMMIT");
      return;
    }
    for (const input of inputs) {
      const slug = input.slug.trim();
      await client.query(`
        INSERT INTO wiki_pages (slug, created_by, updated_by)
        VALUES ($1, $2, $2)
        ON CONFLICT (slug) DO NOTHING
      `, [slug, job.actorId]);
    }
    for (const input of inputs) {
      const slug = input.slug.trim();
      await insertDraft(client, { ...input, slug }, job.actorId);
    }
    await client.query(`
      UPDATE wiki_generation_jobs SET status = 'succeeded', input_tokens = $2,
        output_tokens = $3, failure_code = NULL, updated_at = now()
      WHERE id = $1
    `, [job.id, usage.inputTokens, usage.outputTokens]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function synchronizePublishedRelations(
  client: PoolClient,
  pageId: string,
  oldRelatedPageIds: string[],
  newRelatedPageIds: string[],
  actorId: string,
) {
  for (const relatedPageId of new Set(oldRelatedPageIds)) {
    const current = await client.query<{ version_id: string }>(`
      SELECT current_published_version_id AS version_id FROM wiki_pages
      WHERE id = $1 AND state = 'active' AND del_flag = false
    `, [relatedPageId]);
    if (current.rows[0]?.version_id) {
      await client.query(`
        DELETE FROM wiki_page_version_relations
        WHERE page_version_id = $1 AND related_page_id = $2
      `, [current.rows[0].version_id, pageId]);
    }
  }
  for (const relatedPageId of new Set(newRelatedPageIds)) {
    const current = await client.query<{ version_id: string }>(`
      SELECT page.current_published_version_id AS version_id
      FROM wiki_pages page
      JOIN wiki_page_versions version ON version.id = page.current_published_version_id
        AND version.status = 'published' AND version.del_flag = false
      WHERE page.id = $1 AND page.state = 'active' AND page.del_flag = false
        AND ${validPublishedSource("version")}
    `, [relatedPageId]);
    if (current.rows[0]?.version_id) {
      await client.query(`
        INSERT INTO wiki_page_version_relations (page_version_id, related_page_id, created_by, updated_by)
        VALUES ($1, $2, $3, $3) ON CONFLICT (page_version_id, related_page_id) DO NOTHING
      `, [current.rows[0].version_id, pageId, actorId]);
    }
  }
}

async function repointPublishedRelations(client: PoolClient, sourcePageId: string, targetPageId: string, actorId: string) {
  const referrers = await client.query<{ page_version_id: string }>(`
    SELECT relation.page_version_id
    FROM wiki_page_version_relations relation
    JOIN wiki_page_versions version ON version.id = relation.page_version_id AND version.status = 'published'
    JOIN wiki_pages page ON page.id = version.page_id AND page.current_published_version_id = version.id
    WHERE relation.related_page_id = $1 AND page.id <> $2
    FOR UPDATE OF version
  `, [sourcePageId, targetPageId]);
  for (const { page_version_id: versionId } of referrers.rows) {
    await client.query(`DELETE FROM wiki_page_version_relations WHERE page_version_id = $1 AND related_page_id = $2`, [versionId, sourcePageId]);
    await client.query(`
      INSERT INTO wiki_page_version_relations (page_version_id, related_page_id, created_by, updated_by)
      VALUES ($1, $2, $3, $3) ON CONFLICT (page_version_id, related_page_id) DO NOTHING
    `, [versionId, targetPageId, actorId]);
  }
}

export async function publishWikiPageVersion(pageId: string, versionId: string, actorId: string): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const page = await client.query<{ id: string; state: "active" | "merged"; current_published_version_id: string | null }>(`
      SELECT id, state, current_published_version_id FROM wiki_pages WHERE id = $1 AND del_flag = false FOR UPDATE
    `, [pageId]);
    if (page.rows[0]?.state !== "active") throw new Error("Wiki 页面不存在或已合并。");
    const version = await client.query<{ id: string; merge_source_page_id: string | null }>(`
      SELECT id, merge_source_page_id FROM wiki_page_versions
      WHERE id = $1 AND page_id = $2 AND status = 'draft' AND del_flag = false FOR UPDATE
    `, [versionId, pageId]);
    if (!version.rows[0]) throw new Error("Wiki 草稿不存在或状态已变化。");
    const previousRelated = page.rows[0].current_published_version_id
      ? await client.query<{ related_page_id: string }>(`
        SELECT related_page_id FROM wiki_page_version_relations WHERE page_version_id = $1 AND del_flag = false
      `, [page.rows[0].current_published_version_id])
      : { rows: [] as Array<{ related_page_id: string }> };
    const nextRelated = await client.query<{ related_page_id: string }>(`
      SELECT related_page_id FROM wiki_page_version_relations WHERE page_version_id = $1 AND del_flag = false
    `, [versionId]);
    await validateSources(client, (await client.query<{ article_version_id: string }>(`
      SELECT article_version_id FROM wiki_page_version_sources
      WHERE page_version_id = $1 AND del_flag = false
    `, [versionId])).rows.map(({ article_version_id }) => article_version_id));
    const invalidRelations = await client.query<{ invalid: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM wiki_page_version_relations relation
        JOIN wiki_pages target ON target.id = relation.related_page_id
        LEFT JOIN wiki_page_versions target_version ON target_version.id = target.current_published_version_id
          AND target_version.page_id = target.id AND target_version.status = 'published' AND target_version.del_flag = false
        WHERE relation.page_version_id = $1 AND relation.del_flag = false
          AND (target.state <> 'active' OR target.del_flag OR target_version.id IS NULL
            OR NOT ${validPublishedSource("target_version")})
      ) AS invalid
    `, [versionId]);
    if (invalidRelations.rows[0]?.invalid) throw new Error("相关 Wiki 页面当前不可用。");

    await client.query(`
      UPDATE wiki_page_versions SET status = 'published', updated_at = now(), updated_by = $2 WHERE id = $1
    `, [versionId, actorId]);
    await client.query(`
      UPDATE wiki_pages SET current_published_version_id = $2, updated_at = now(), updated_by = $3 WHERE id = $1
    `, [pageId, versionId, actorId]);
    if (page.rows[0].current_published_version_id && page.rows[0].current_published_version_id !== versionId) {
      await client.query("DELETE FROM wiki_page_versions WHERE id = $1", [page.rows[0].current_published_version_id]);
    }
    await synchronizePublishedRelations(
      client,
      pageId,
      previousRelated.rows.map(({ related_page_id }) => related_page_id),
      nextRelated.rows.map(({ related_page_id }) => related_page_id),
      actorId,
    );
    if (version.rows[0].merge_source_page_id) {
      const sourcePageId = version.rows[0].merge_source_page_id;
      const source = await client.query(`
        UPDATE wiki_pages SET state = 'merged', redirect_to_page_id = $2, updated_at = now(), updated_by = $3
        WHERE id = $1 AND state = 'active' AND del_flag = false
      `, [sourcePageId, pageId, actorId]);
      if (source.rowCount !== 1) throw new Error("待合并 Wiki 页面已不可用。");
      await repointPublishedRelations(client, sourcePageId, pageId, actorId);
      await client.query("DELETE FROM wiki_page_versions WHERE page_id = $1", [sourcePageId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function mergeWikiPages(sourceSlug: string, targetSlug: string, actorId: string) {
  if (sourceSlug === targetSlug) throw new Error("不能将 Wiki 页面合并到自身。");
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    const slugs = [sourceSlug, targetSlug].sort();
    const pages = await client.query<{ id: string; slug: string }>(`
      SELECT id, slug FROM wiki_pages
      WHERE slug = ANY($1::text[]) AND state = 'active' AND del_flag = false
      ORDER BY id FOR UPDATE
    `, [slugs]);
    if (pages.rowCount !== 2) throw new Error("Wiki 页面不存在或已合并。");
    const bySlug = new Map(pages.rows.map((page) => [page.slug, page.id]));
    const source = await client.query<{
      version_id: string; title: string; body: string;
    } & QueryResultRow>(`
      SELECT version.id AS version_id, version.title, version.body
      FROM wiki_pages page
      JOIN wiki_page_versions version ON version.id = page.current_published_version_id
        AND version.page_id = page.id AND version.status = 'published' AND version.del_flag = false
      WHERE page.id = $1 AND ${validPublishedSource("version")}
    `, [bySlug.get(sourceSlug)]);
    const target = await client.query<{
      version_id: string; title: string; body: string;
    } & QueryResultRow>(`
      SELECT version.id AS version_id, version.title, version.body
      FROM wiki_pages page
      JOIN wiki_page_versions version ON version.id = page.current_published_version_id
        AND version.page_id = page.id AND version.status = 'published' AND version.del_flag = false
      WHERE page.id = $1 AND ${validPublishedSource("version")}
    `, [bySlug.get(targetSlug)]);
    if (!source.rows[0] || !target.rows[0]) throw new Error("合并要求两个 Wiki 页面均有有效已发布版本。");

    const sourceIds = await client.query<{ article_version_id: string }>(`
      SELECT candidate.article_version_id
      FROM (
        SELECT article_version_id FROM wiki_page_version_sources WHERE page_version_id = $1 AND del_flag = false
        UNION
        SELECT article_version_id FROM wiki_page_version_sources WHERE page_version_id = $2 AND del_flag = false
      ) candidate
      JOIN article_versions version ON version.id = candidate.article_version_id
        AND version.status = 'published' AND version.del_flag = false
      JOIN articles article ON article.id = version.article_id
        AND article.current_published_version_id = version.id
        AND article.del_flag = false AND article.archived_at IS NULL AND article.deleted_at IS NULL
    `, [source.rows[0].version_id, target.rows[0].version_id]);
    const related = await client.query<{ slug: string }>(`
      SELECT DISTINCT other.slug
      FROM wiki_page_version_relations relation
      JOIN wiki_pages other ON other.id = relation.related_page_id AND other.state = 'active' AND other.del_flag = false
      WHERE relation.page_version_id = ANY($1::uuid[]) AND other.id NOT IN ($2::uuid, $3::uuid)
    `, [[source.rows[0].version_id, target.rows[0].version_id], bySlug.get(sourceSlug), bySlug.get(targetSlug)]);
    const draft = await insertDraft(client, {
      slug: targetSlug,
      title: target.rows[0].title,
      body: target.rows[0].body,
      sourceArticleVersionIds: sourceIds.rows.map(({ article_version_id }) => article_version_id),
      relatedSlugs: related.rows.map(({ slug }) => slug),
    }, actorId, bySlug.get(sourceSlug));
    await client.query("COMMIT");
    return draft;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getWikiPageHistory(slug: string): Promise<WikiPageVersion[]> {
  const result = await database().query<{
    id: string; version_number: number; status: WikiPageVersion["status"];
    title: string; body: string; created_at: Date; merge_source_slug: string | null;
  } & QueryResultRow>(`
    SELECT version.id, version.version_number, version.status, version.title, version.body,
      version.created_at, merge_source.slug AS merge_source_slug
    FROM wiki_page_versions version
    JOIN wiki_pages page ON page.id = version.page_id
    LEFT JOIN wiki_pages merge_source ON merge_source.id = version.merge_source_page_id
    WHERE page.slug = $1 AND page.del_flag = false AND version.del_flag = false
    ORDER BY version.version_number DESC
  `, [slug]);
  const versions = await Promise.all(result.rows.map(async (version) => {
    const [sources, relations] = await Promise.all([
      database().query<WikiPageSource & QueryResultRow>(`
        SELECT article_version.id AS "articleVersionId", article.public_id AS "articleSlug", article_version.title AS "articleTitle"
        FROM wiki_page_version_sources source
        JOIN article_versions article_version ON article_version.id = source.article_version_id
        JOIN articles article ON article.id = article_version.article_id
        WHERE source.page_version_id = $1 AND source.del_flag = false
        ORDER BY article_version.title
      `, [version.id]),
      database().query<{ slug: string } & QueryResultRow>(`
        SELECT page.slug FROM wiki_page_version_relations relation
        JOIN wiki_pages page ON page.id = relation.related_page_id
        WHERE relation.page_version_id = $1 AND relation.del_flag = false ORDER BY page.slug
      `, [version.id]),
    ]);
    return {
      id: version.id,
      versionNumber: version.version_number,
      status: version.status,
      title: version.title,
      body: version.body,
      createdAt: version.created_at.toISOString(),
      sources: sources.rows,
      relatedSlugs: relations.rows.map(({ slug: relationSlug }) => relationSlug),
      ...(version.merge_source_slug ? { mergeSourceSlug: version.merge_source_slug } : {}),
    };
  }));
  return versions;
}

export async function listAdminWikiPages() {
  const pages = await database().query<{
    id: string; slug: string; state: "active" | "merged"; redirect_to_slug: string | null;
    current_version_id: string | null; current_title: string | null; current_status: string | null;
  } & QueryResultRow>(`
    SELECT page.id, page.slug, page.state, redirect.slug AS redirect_to_slug,
      version.id AS current_version_id, version.title AS current_title, version.status AS current_status
    FROM wiki_pages page
    LEFT JOIN wiki_pages redirect ON redirect.id = page.redirect_to_page_id
    LEFT JOIN wiki_page_versions version ON version.id = page.current_published_version_id AND version.page_id = page.id
    WHERE page.del_flag = false
    ORDER BY page.updated_at DESC, page.slug
  `);
  return Promise.all(pages.rows.map(async (page) => ({
    id: page.id,
    slug: page.slug,
    state: page.state,
    ...(page.redirect_to_slug ? { redirectTo: page.redirect_to_slug } : {}),
    current: page.current_version_id ? {
      id: page.current_version_id,
      title: page.current_title,
      status: page.current_status,
    } : undefined,
    versions: await getWikiPageHistory(page.slug),
  })));
}
