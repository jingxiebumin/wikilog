import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ database: undefined as PGlite | undefined, connectLock: Promise.resolve() }));
vi.mock("@/lib/db", () => ({
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => state.database!.query(...args),
    connect: async () => {
      // PGlite exposes one database connection here; serialize transaction clients to model its
      // supported transaction boundary. This does not prove PostgreSQL cross-connection locking.
      const prior = state.connectLock;
      let unlock: () => void = () => {};
      state.connectLock = new Promise<void>((resolve) => { unlock = resolve; });
      await prior;
      let released = false;
      return {
        query: async (...args: Parameters<PGlite["query"]>) => {
          const query = String(args[0]).trim().toUpperCase();
          const result = await state.database!.query(...args);
          if (query === "COMMIT" || query === "ROLLBACK") unlock();
          return result;
        },
        release: () => { if (!released) { released = true; unlock(); } },
      };
    },
  },
}));

import { qaRepository } from "./repository";
import { createQaService } from "./service";

describe("Q&A repository", () => {
  let database: PGlite;
  let adminId: string;
  let articleVersionId: string;

  async function createSession(): Promise<string> {
    const result = await database.query<{ id: string }>(`
      INSERT INTO qa_sessions (admin_id, created_by, updated_by)
      VALUES ($1, $1, $1) RETURNING id
    `, [adminId]);
    return result.rows[0].id;
  }

  beforeEach(async () => {
    database = new PGlite();
    state.database = database;
    state.connectLock = Promise.resolve();
    for (const file of [
      "0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql",
      "0004_article_sources.sql", "0005_favorites.sql", "0006_reader_status_audit.sql",
      "0007_reader_profile_audit.sql", "0008_personal_center.sql", "0009_article_images.sql", "0010_qa.sql",
    ]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    adminId = admin.rows[0].id;
    const category = await database.query<{ id: string }>(
      "INSERT INTO categories (slug, name, created_by, updated_by) VALUES ('engineering', 'Engineering', $1, $1) RETURNING id",
      [adminId],
    );
    const article = await database.query<{ id: string }>(
      "INSERT INTO articles (slug, category_id, created_by, updated_by) VALUES ('article', $1, $2, $2) RETURNING id",
      [category.rows[0].id, adminId],
    );
    const version = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, cover, read_minutes, published_at, created_by, updated_by)
      VALUES ($1, 1, 'published', 'Article', 'Summary', '数据库事务保证状态变更的一致性。', 'content', 1, '2026-11-15', $2, $2) RETURNING id
    `, [article.rows[0].id, adminId]);
    articleVersionId = version.rows[0].id;
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [article.rows[0].id, articleVersionId]);
  });

  afterEach(async () => {
    state.database = undefined;
    await database.close();
  });

  it("limits successful answers per admin and Shanghai day, while failed attempts release the slot", async () => {
    const sessionId = await createSession();
    for (let index = 0; index < 5; index += 1) {
      const failed = await qaRepository.beginQuestion({ adminId, sessionId, question: `failed ${index}`, day: "2026-11-15" });
      expect(failed.allowed).toBe(true);
      await qaRepository.settleQuestion({ adminId, messageId: failed.messageId, status: "failed" });
    }

    const firstSuccess = await qaRepository.beginQuestion({ adminId, sessionId, question: "success 1", day: "2026-11-15" });
    expect(firstSuccess.allowed).toBe(true);
    await qaRepository.settleQuestion({ adminId, messageId: firstSuccess.messageId, status: "succeeded", answer: "answer", inputTokens: 2, outputTokens: 3 });

    for (let index = 1; index < 5; index += 1) {
      const accepted = await qaRepository.beginQuestion({ adminId, sessionId, question: `success ${index + 1}`, day: "2026-11-15" });
      expect(accepted.allowed).toBe(true);
      await qaRepository.settleQuestion({ adminId, messageId: accepted.messageId, status: "succeeded", answer: "answer", inputTokens: 2, outputTokens: 3 });
    }
    const denied = await qaRepository.beginQuestion({ adminId, sessionId, question: "one too many", day: "2026-11-15" });
    expect(denied.allowed).toBe(true);
    expect(await qaRepository.settleQuestion({
      adminId,
      messageId: denied.messageId,
      status: "succeeded",
      answer: "answer",
      inputTokens: 2,
      outputTokens: 3,
    })).toBe(false);

    const nextDay = await qaRepository.beginQuestion({ adminId, sessionId, question: "next day", day: "2026-11-16" });
    expect(nextDay.allowed).toBe(true);
    await qaRepository.settleQuestion({ adminId, messageId: nextDay.messageId, status: "timed_out" });

    await database.query("DELETE FROM users WHERE id = $1", [adminId]);
    const remaining = await database.query<{ count: string }>("SELECT count(*) FROM qa_sessions");
    expect(Number(remaining.rows[0].count)).toBe(0);
  });

  it("deletes only the owning admin's session and cascades its messages and citations", async () => {
    const sessionId = await createSession();
    const question = await qaRepository.beginQuestion({ adminId, sessionId, question: "question", day: "2026-11-15" });
    await qaRepository.settleQuestion({
      adminId,
      messageId: question.messageId,
      status: "succeeded",
      answer: "answer",
      inputTokens: 2,
      outputTokens: 3,
      citations: [{ articleVersionId, slug: "article", title: "Article", url: "/articles/article", quote: "数据库事务保证状态变更的一致性。" }],
    });
    await qaRepository.deleteSession(adminId, sessionId);

    const messages = await database.query<{ count: string }>("SELECT count(*) FROM qa_messages");
    const citations = await database.query<{ count: string }>("SELECT count(*) FROM qa_citations");
    expect(Number(messages.rows[0].count)).toBe(0);
    expect(Number(citations.rows[0].count)).toBe(0);
  });

  it("returns messages in server-assigned submission order rather than timestamp order", async () => {
    const sessionId = await createSession();
    const first = await qaRepository.beginQuestion({ adminId, sessionId, question: "first", day: "2026-11-15" });
    const second = await qaRepository.beginQuestion({ adminId, sessionId, question: "second", day: "2026-11-15" });
    await qaRepository.settleQuestion({ adminId, messageId: first.messageId, status: "failed" });
    await qaRepository.settleQuestion({ adminId, messageId: second.messageId, status: "failed" });
    await database.query("UPDATE qa_messages SET created_at = now() + interval '1 minute' WHERE id = $1", [first.messageId]);

    const result = await qaRepository.getSession(adminId, sessionId);

    expect(result?.messages.map(({ question }) => question)).toEqual(["first", "second"]);
  });

  it("commits the quota day and processing message before model work", async () => {
    const sessionId = await createSession();

    const reservation = await qaRepository.beginQuestion({ adminId, sessionId, question: "processing", day: "2026-11-15" });
    const state = await database.query<{ status: string }>(`
      SELECT status FROM qa_messages WHERE id = $1
    `, [reservation.messageId]);

    expect(state.rows[0]).toEqual({ status: "processing" });
    expect(reservation).not.toHaveProperty("sources");
    await qaRepository.settleQuestion({ adminId, messageId: reservation.messageId, status: "failed" });
  });

  it("returns only matching current article versions with bounded text excerpts", async () => {
    const category = await database.query<{ id: string }>("SELECT id FROM categories WHERE slug = 'engineering'");
    const irrelevantArticle = await database.query<{ id: string }>(`
      INSERT INTO articles (slug, category_id, created_by, updated_by)
      VALUES ('unrelated', $1, $2, $2) RETURNING id
    `, [category.rows[0].id, adminId]);
    const irrelevantVersion = await database.query<{ id: string }>(`
      INSERT INTO article_versions (article_id, version_number, status, title, summary, content_text, cover, read_minutes, published_at, created_by, updated_by)
      VALUES ($1, 1, 'published', '索引', '摘要', $2, 'content', 1, CURRENT_DATE, $3, $3) RETURNING id
    `, [irrelevantArticle.rows[0].id, "索引".repeat(2000), adminId]);
    await database.query("UPDATE articles SET current_published_version_id = $2 WHERE id = $1", [irrelevantArticle.rows[0].id, irrelevantVersion.rows[0].id]);

    const related = await qaRepository.searchPublishedSources("数据库事务有什么作用？", 5);

    expect(related).toHaveLength(1);
    expect(related[0]).toMatchObject({ articleVersionId, contentText: "数据库事务保证状态变更的一致性。" });
    expect(related[0].contentText.length).toBeLessThanOrEqual(1600);
    await expect(qaRepository.findPublishedSources([irrelevantVersion.rows[0].id], "事务", 5)).resolves.toEqual([]);
    await expect(qaRepository.findPublishedSources([articleVersionId], "事务", 5)).resolves.toMatchObject([
      { articleVersionId, contentText: "数据库事务保证状态变更的一致性。" },
    ]);
  });

  it("does not cap submitted calls by the number of in-flight requests", async () => {
    const sessionId = await createSession();
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      qaRepository.beginQuestion({ adminId, sessionId, question: `pending ${index}`, day: "2026-11-15" }),
    ));

    expect(attempts.every(({ allowed }) => allowed)).toBe(true);
    for (const attempt of attempts) {
      await qaRepository.settleQuestion({ adminId, messageId: attempt.messageId, status: "failed" });
    }
  });

  it("atomically limits successful answers even when more than five calls are already in flight", async () => {
    const sessionId = await createSession();
    const attempts = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      qaRepository.beginQuestion({ adminId, sessionId, question: `pending ${index}`, day: "2026-11-15" }),
    ));
    const outcomes = [];
    for (const attempt of attempts) {
      outcomes.push(await qaRepository.settleQuestion({
        adminId,
        messageId: attempt.messageId,
        status: "succeeded",
        answer: "answer",
        inputTokens: 2,
        outputTokens: 3,
      }));
    }

    const quota = await database.query<{ successful_count: number }>(
      "SELECT successful_count FROM qa_daily_quotas WHERE admin_id = $1 AND quota_day = '2026-11-15'", [adminId],
    );
    const statuses = await database.query<{ status: string; answer: string | null }>(
      "SELECT status, answer FROM qa_messages ORDER BY submission_sequence",
    );

    expect(outcomes.filter(Boolean)).toHaveLength(5);
    expect(quota.rows[0].successful_count).toBe(5);
    expect(statuses.rows.filter(({ status }) => status === "succeeded")).toHaveLength(5);
    expect(statuses.rows.filter(({ status }) => status === "refused")).toHaveLength(3);
    expect(statuses.rows.filter(({ answer }) => answer === "今日成功回答次数已用完。")).toHaveLength(3);
  });

  it("counts a successful answer on its Shanghai completion day", async () => {
    const sessionId = await createSession();
    const attempt = await qaRepository.beginQuestion({
      adminId,
      sessionId,
      question: "submitted before midnight",
      day: "2026-11-15",
    });

    await qaRepository.settleQuestion({
      adminId,
      messageId: attempt.messageId,
      status: "succeeded",
      answer: "answer",
      inputTokens: 2,
      outputTokens: 3,
      quotaDay: "2026-11-16",
    });

    const counts = await database.query<{ quota_day: string; successful_count: number }>(`
      SELECT quota_day::text, successful_count FROM qa_daily_quotas
      WHERE admin_id = $1 ORDER BY quota_day
    `, [adminId]);
    expect(counts.rows).toEqual([{ quota_day: "2026-11-16", successful_count: 1 }]);
  });

  it("adds the shared audit columns to every Q&A business table", async () => {
    const columns = await database.query<{ table_name: string; column_name: string }>(`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN (
        'qa_sessions', 'qa_daily_quotas', 'qa_messages', 'qa_citations'
      )
    `);
    const columnsByTable = new Map<string, Set<string>>();
    for (const { table_name: tableName, column_name: columnName } of columns.rows) {
      const tableColumns = columnsByTable.get(tableName) ?? new Set<string>();
      tableColumns.add(columnName);
      columnsByTable.set(tableName, tableColumns);
    }
    for (const table of ["qa_sessions", "qa_daily_quotas", "qa_messages", "qa_citations"]) {
      expect([...columnsByTable.get(table)!]).toEqual(expect.arrayContaining([
        "created_at", "created_by", "updated_at", "updated_by", "del_flag",
      ]));
    }
  });

  it("reclaims crashed processing questions after 180 seconds without expiring a 125-second active request", async () => {
    const sessionId = await createSession();
    const crashed = await qaRepository.beginQuestion({ adminId, sessionId, question: "crashed", day: "2026-11-15" });
    const active = await qaRepository.beginQuestion({ adminId, sessionId, question: "still active", day: "2026-11-15" });
    await database.query("UPDATE qa_messages SET updated_at = now() - interval '181 seconds' WHERE id = $1", [crashed.messageId]);
    await database.query("UPDATE qa_messages SET updated_at = now() - interval '125 seconds' WHERE id = $1", [active.messageId]);

    const next = await qaRepository.beginQuestion({ adminId, sessionId, question: "next", day: "2026-11-15" });
    const rows = await database.query<{ id: string; status: string }>(`
      SELECT id, status FROM qa_messages WHERE id = ANY($1::uuid[])
    `, [[crashed.messageId, active.messageId, next.messageId]]);

    expect(Object.fromEntries(rows.rows.map(({ id, status }) => [id, status]))).toEqual({
      [crashed.messageId]: "timed_out",
      [active.messageId]: "processing",
      [next.messageId]: "processing",
    });
    await qaRepository.settleQuestion({ adminId, messageId: active.messageId, status: "failed" });
    await qaRepository.settleQuestion({ adminId, messageId: next.messageId, status: "failed" });
  });

  it("processes concurrent submissions through the ordered repository flow and allows at most five successes", async () => {
    const sessionId = await createSession();
    const providerCalls: string[] = [];
    const service = createQaService({
      repository: qaRepository,
      wikiSearch: async () => [],
      enabled: true,
      modelId: "test-model",
      provider: {
        async complete({ question }) {
          providerCalls.push(question);
          if (question.includes("request-1")) {
            throw new Error("provider unavailable");
          }
          return {
            answer: "数据库事务保证状态变更的一致性。",
            refused: false,
            evidenceSupported: true,
            citations: [{ sourceId: articleVersionId, quote: "数据库事务保证状态变更的一致性。" }],
            inputTokens: 2,
            outputTokens: 1,
          };
        },
      },
    });
    const session = {
      id: adminId,
      email: "admin@example.test",
      displayName: "Admin",
      role: "admin" as const,
      status: "active" as const,
      passwordResetRequired: false,
      sessionId: "auth-session",
      expiresAt: new Date("2026-11-15T12:00:00Z"),
    };

    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) =>
      service.ask(session, { sessionId, question: `事务保证什么 request-${index + 1}` }),
    ));

    const quota = await database.query<{ successful_count: number }>("SELECT successful_count FROM qa_daily_quotas WHERE admin_id = $1", [adminId]);
    expect(providerCalls).toHaveLength(8);
    const calledSequence = providerCalls.map((question) => Number(question.match(/request-(\d+)/)?.[1]));
    expect(calledSequence).toEqual([...calledSequence].sort((left, right) => left - right));
    expect(quota.rows[0]).toEqual({ successful_count: 5 });
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(7);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(quota.rows[0].successful_count).toBe(5);
    const messages = await database.query<{ submission_sequence: number; status: string }>(`
      SELECT submission_sequence, status FROM qa_messages WHERE session_id = $1 ORDER BY submission_sequence
    `, [sessionId]);
    expect(messages.rows.map(({ submission_sequence }) => submission_sequence)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(messages.rows[0].status).toBe("failed");
    expect(messages.rows.filter(({ status }) => status === "succeeded")).toHaveLength(5);
    expect(messages.rows.filter(({ status }) => status === "refused")).toHaveLength(2);
  });

  it("does not hold a database transaction while a provider call is pending", async () => {
    const sessionId = await createSession();
    let markStarted: () => void = () => {};
    let finishProvider: () => void = () => {};
    const providerStarted = new Promise<void>((resolve) => { markStarted = resolve; });
    const providerFinished = new Promise<void>((resolve) => { finishProvider = resolve; });
    const service = createQaService({
      repository: qaRepository,
      wikiSearch: async () => [],
      enabled: true,
      modelId: "test-model",
      provider: {
        async complete() {
          markStarted();
          await providerFinished;
          return {
            answer: "数据库事务保证状态变更的一致性。",
            refused: false,
            evidenceSupported: true,
            citations: [{ sourceId: articleVersionId, quote: "数据库事务保证状态变更的一致性。" }],
            inputTokens: 2,
            outputTokens: 1,
          };
        },
      },
    });
    const admin = {
      id: adminId, email: "admin@example.test", displayName: "Admin", role: "admin" as const,
      status: "active" as const, passwordResetRequired: false, sessionId: "session", expiresAt: new Date(),
    };

    const pending = service.ask(admin, { sessionId, question: "事务保证什么？" });
    await providerStarted;
    const otherSession = await createSession();
    const otherRequest = await qaRepository.beginQuestion({ adminId, sessionId: otherSession, question: "another request", day: "2026-11-15" });
    expect(otherRequest.allowed).toBe(true);
    await qaRepository.settleQuestion({ adminId, messageId: otherRequest.messageId, status: "failed" });
    finishProvider();

    await expect(pending).resolves.toMatchObject({ status: "succeeded" });
  });
});
