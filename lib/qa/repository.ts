import "server-only";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import type { QaCitation, QaMessage, QaRepository, QaSession, QaSource } from "./service";

type Db = NonNullable<typeof pool>;
type MessageRow = QueryResultRow & {
  id: string;
  question: string;
  answer: string | null;
  status: QaMessage["status"];
  model_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: Date;
};

const database = (): Db => {
  if (!pool) throw new Error("Database is unavailable.");
  return pool;
};

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const MAX_ARTICLE_CONTEXT_CHARACTERS = 1600;

function searchTerms(query: string): string[] {
  const normalized = query.toLocaleLowerCase("zh-CN")
    .replace(/什么|哪些|如何|怎么|为什么|是否|能否|请|介绍|说明|描述|解释|文章|内容|什么|的|是|和|与|吗|呢|？|\?/gu, "");
  const terms = new Set<string>();
  for (const token of normalized.match(/[\p{Script=Han}]+|[a-z0-9_]+/giu) ?? []) {
    if (/^[\p{Script=Han}]+$/u.test(token)) {
      const chars = Array.from(token);
      if (chars.length === 1) terms.add(chars[0]);
      for (let index = 0; index < chars.length - 1; index += 1) terms.add(chars.slice(index, index + 2).join(""));
    } else {
      terms.add(token);
    }
  }
  return [...terms].slice(0, 12);
}

function sourceSearchQuery(onlyIds: boolean) {
  return `
    SELECT v.id AS "articleVersionId", a.slug, v.title,
      '/articles/' || a.slug || '?version=' || v.id AS url,
      substring(v.content_text FROM greatest(position(lower(matched_source.term) IN lower(v.content_text)) - 400, 1) FOR ${MAX_ARTICLE_CONTEXT_CHARACTERS}) AS "contentText"
    FROM articles a
    JOIN article_versions v ON v.id = a.current_published_version_id AND v.article_id = a.id
    JOIN categories c ON c.id = a.category_id AND c.del_flag = false
    CROSS JOIN LATERAL (
      SELECT term, count(*) OVER () AS relevance
      FROM unnest($1::text[]) AS terms(term)
      WHERE position(lower(term) IN lower(v.content_text)) > 0
      ORDER BY position(lower(term) IN lower(v.title)) DESC, length(term) DESC
      LIMIT 1
    ) matched_source
    WHERE v.status = 'published' AND v.del_flag = false
      AND a.archived_at IS NULL AND a.deleted_at IS NULL AND a.del_flag = false
      AND ${onlyIds ? "v.id = ANY($2::uuid[])" : "true"}
    ORDER BY position(lower(matched_source.term) IN lower(v.title)) DESC,
      matched_source.relevance DESC, v.published_at DESC, v.created_at DESC
    LIMIT $${onlyIds ? 3 : 2}
  `;
}

async function findRelevantPublishedSources(query: string, limit: number, articleVersionIds?: string[]): Promise<QaSource[]> {
  const terms = searchTerms(query);
  if (terms.length === 0 || (articleVersionIds && articleVersionIds.length === 0)) return [];
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 5));
  const result = articleVersionIds
    ? await database().query<QueryResultRow & QaSource>(sourceSearchQuery(true), [terms, [...new Set(articleVersionIds)], boundedLimit])
    : await database().query<QueryResultRow & QaSource>(sourceSearchQuery(false), [terms, boundedLimit]);
  return result.rows;
}

async function expireStaleQuestions(client: PoolClient, adminId: string): Promise<void> {
  await client.query(`
    UPDATE qa_messages SET status = 'timed_out', updated_at = now(), updated_by = $1
    WHERE admin_id = $1 AND status = 'processing'
      AND updated_at < now() - interval '180 seconds' AND del_flag = false
  `, [adminId]);
  await client.query(`
    UPDATE qa_messages SET status = 'timed_out', updated_at = now(), updated_by = $1
    WHERE admin_id = $1 AND status = 'queued'
      AND created_at < now() - interval '90 seconds' AND del_flag = false
  `, [adminId]);
}

async function expireStaleQuestionsForAdmin(adminId: string): Promise<void> {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await expireStaleQuestions(client, adminId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function citationsForMessage(messageId: string): Promise<QaCitation[]> {
  const result = await database().query<QueryResultRow & QaCitation>(`
    SELECT article_version_id AS "articleVersionId", slug, title, url, quote
    FROM qa_citations WHERE message_id = $1 AND del_flag = false ORDER BY created_at, id
  `, [messageId]);
  return result.rows;
}

async function messagesForSession(sessionId: string): Promise<QaMessage[]> {
  const result = await database().query<MessageRow>(`
    SELECT id, question, answer, status, model_id, input_tokens, output_tokens, created_at
    FROM qa_messages WHERE session_id = $1 AND del_flag = false ORDER BY submission_sequence
  `, [sessionId]);
  return Promise.all(result.rows.map(async (row) => ({
    id: row.id,
    question: row.question,
    answer: row.answer,
    status: row.status,
    modelId: row.model_id,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    citations: await citationsForMessage(row.id),
    createdAt: row.created_at.toISOString(),
  })));
}

export const qaRepository: QaRepository = {
  async getSession(adminId, sessionId): Promise<QaSession | undefined> {
    await expireStaleQuestionsForAdmin(adminId);
    const result = await database().query<QueryResultRow & {
      id: string; title: string; created_at: Date; updated_at: Date;
    }>(`
      SELECT id, title, created_at, updated_at FROM qa_sessions
      WHERE id = $1 AND admin_id = $2 AND del_flag = false
    `, [sessionId, adminId]);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      messages: await messagesForSession(row.id),
    };
  },

  async listSessions(adminId) {
    const result = await database().query<QueryResultRow & {
      id: string; title: string; created_at: Date; updated_at: Date;
    }>(`
      SELECT id, title, created_at, updated_at FROM qa_sessions
      WHERE admin_id = $1 AND del_flag = false
      ORDER BY updated_at DESC, id
    `, [adminId]);
    return result.rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }));
  },

  async deleteSession(adminId, sessionId) {
    await database().query("DELETE FROM qa_sessions WHERE id = $1 AND admin_id = $2", [sessionId, adminId]);
  },

  async searchPublishedSources(query, limit) {
    return findRelevantPublishedSources(query, limit);
  },

  async findPublishedSources(articleVersionIds, query, limit) {
    return findRelevantPublishedSources(query, limit, articleVersionIds);
  },

  async beginQuestion({ adminId, sessionId, question, day }) {
    const startedAt = Date.now();
    const client = await database().connect();
    let queuedMessageId = "";
    let submissionSequence = 0;
    let activeSessionId = sessionId ?? "";
    try {
      await client.query("BEGIN");
      if (!activeSessionId) {
        const created = await client.query<{ id: string }>(`
          INSERT INTO qa_sessions (admin_id, created_by, updated_by)
          SELECT id, id, id FROM users
          WHERE id = $1 AND role = 'admin' AND status = 'active' AND del_flag = false
          RETURNING id
        `, [adminId]);
        if (!created.rows[0]) throw new Error("Admin account is not available.");
        activeSessionId = created.rows[0].id;
      }
      const session = await client.query<{ id: string; submission_sequence: string }>(`
        UPDATE qa_sessions SET next_submission_sequence = next_submission_sequence + 1
        WHERE id = $1 AND admin_id = $2 AND del_flag = false
        RETURNING id, next_submission_sequence - 1 AS submission_sequence
      `, [activeSessionId, adminId]);
      if (!session.rows[0]) throw new Error("Q&A session is not available.");
      submissionSequence = Number(session.rows[0].submission_sequence);
      const message = await client.query<{ id: string }>(`
        INSERT INTO qa_messages (session_id, admin_id, quota_day, submission_sequence, question, status, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, 'queued', $2, $2) RETURNING id
      `, [activeSessionId, adminId, day, submissionSequence, question]);
      queuedMessageId = message.rows[0].id;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const quotaClient = await database().connect();
    try {
      await quotaClient.query("BEGIN");
      await expireStaleQuestions(quotaClient, adminId);
      const activated = await quotaClient.query(`
        UPDATE qa_messages SET status = 'processing', updated_at = now(), updated_by = $2
        WHERE id = $1 AND status = 'queued'
      `, [queuedMessageId, adminId]);
      if (activated.rowCount !== 1) throw new Error("Q&A queue entry is no longer available.");
      await quotaClient.query("COMMIT");
      return {
        messageId: queuedMessageId,
          sessionId: activeSessionId,
        allowed: true,
        waitedMs: Date.now() - startedAt,
        submissionSequence,
      };
    } catch (error) {
      await quotaClient.query("ROLLBACK");
      throw error;
    } finally {
      quotaClient.release();
    }
  },

  async waitForTurn({ adminId, sessionId, submissionSequence, timeoutMs = 65_000 }) {
    const startedAt = Date.now();
    for (;;) {
      await expireStaleQuestionsForAdmin(adminId);
      const earlier = await database().query<{ pending: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM qa_messages
          WHERE admin_id = $1 AND session_id = $2
            AND submission_sequence < $3 AND status IN ('queued', 'processing') AND del_flag = false
        ) AS pending
      `, [adminId, sessionId, submissionSequence]);
      if (!earlier.rows[0]?.pending) return true;
      if (Date.now() - startedAt >= timeoutMs) return false;
      await pause(100);
    }
  },

  async settleQuestion(input): Promise<boolean> {
    const client = await database().connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ session_id: string; question: string; quota_day: string }>(`
        SELECT session_id, question, quota_day FROM qa_messages
        WHERE id = $1 AND admin_id = $2 AND status = 'processing' FOR UPDATE
      `, [input.messageId, input.adminId]);
      const row = current.rows[0];
      if (!row) throw new Error("Q&A question is no longer processing.");
      let status = input.status;
      let answer = input.answer ?? null;
      let successCounted = false;
      if (status === "succeeded") {
        const quotaDay = input.quotaDay ?? row.quota_day;
        await client.query(`
          INSERT INTO qa_daily_quotas (admin_id, quota_day, created_by, updated_by)
          VALUES ($1, $2, $1, $1)
          ON CONFLICT (admin_id, quota_day) DO NOTHING
        `, [input.adminId, quotaDay]);
        const counted = await client.query(`
          UPDATE qa_daily_quotas SET successful_count = successful_count + 1,
            updated_at = now(), updated_by = $3
          WHERE admin_id = $1 AND quota_day = $2 AND successful_count < 5
          RETURNING successful_count
        `, [input.adminId, quotaDay, input.adminId]);
        successCounted = counted.rowCount === 1;
        if (!successCounted) {
          status = "refused";
          answer = "今日成功回答次数已用完。";
        }
      }
      await client.query(`
        UPDATE qa_messages SET status = $3, answer = $4, model_id = $5,
          input_tokens = $6, output_tokens = $7, updated_at = now(), updated_by = $8
        WHERE id = $1 AND admin_id = $2 AND status = 'processing'
      `, [input.messageId, input.adminId, status, answer, input.modelId ?? null,
        input.inputTokens ?? null, input.outputTokens ?? null, input.adminId]);
      for (const citation of status === "succeeded" ? input.citations ?? [] : []) {
        await client.query(`
          INSERT INTO qa_citations (message_id, article_version_id, slug, title, url, quote, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        `, [input.messageId, citation.articleVersionId, citation.slug, citation.title, citation.url, citation.quote, input.adminId]);
      }
      await client.query(`
        UPDATE qa_sessions SET updated_at = now(), updated_by = $3,
          title = CASE WHEN title = '新问答' THEN left($2, 80) ELSE title END
        WHERE id = $1
      `, [row.session_id, row.question, input.adminId]);
      await client.query("COMMIT");
      return successCounted;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};
