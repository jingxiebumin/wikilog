import { describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/auth/types";
import { createQaService, type QaProvider, type QaRepository, type QaSource } from "./service";

const admin = (role: "admin" | "reader" = "admin"): Session => ({
  id: "00000000-0000-4000-8000-000000000001",
  email: `${role}@example.test`,
  displayName: role,
  role,
  status: "active",
  passwordResetRequired: false,
  sessionId: "session-id",
  expiresAt: new Date("2026-11-15T12:00:00Z"),
});

const dependencies = (overrides: Partial<Parameters<typeof createQaService>[0]> = {}) => {
  const listPublishedSources = vi.fn<() => Promise<QaSource[]>>(async () => []);
  const complete = vi.fn<QaProvider["complete"]>(async () => ({ answer: "回答", refused: false, evidenceSupported: true, citations: [], inputTokens: 0, outputTokens: 0 }));
  const repository: QaRepository = {
    getSession: vi.fn(async () => undefined),
    listSessions: vi.fn(async () => []),
    deleteSession: vi.fn(async () => undefined),
    listPublishedSources,
    waitForTurn: vi.fn(async () => true),
    beginQuestion: vi.fn(async () => ({ messageId: "message-id", sessionId: "qa-session-id", allowed: true })),
    settleQuestion: vi.fn(async () => true),
  };
  const provider: QaProvider = {
    complete,
  };
  return {
    repository,
    provider,
    listPublishedSources,
    complete,
    service: createQaService({ repository, provider, enabled: true, ...overrides }),
  };
};

describe("admin article Q&A service", () => {
  it("keeps Q&A unavailable unless both the feature and data-policy gates are enabled", async () => {
    const { service, provider } = dependencies({ enabled: false });

    await expect(service.listSessions(admin())).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("rejects anonymous and reader sessions before creating or calling anything", async () => {
    const { service, provider } = dependencies();

    await expect(service.listSessions(undefined)).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    await expect(service.listSessions(admin("reader"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("rejects questions over 2,000 characters before repository or provider work", async () => {
    const { service, provider, repository } = dependencies();

    await expect(service.ask(admin(), { sessionId: "qa-session-id", question: "问".repeat(2001) }))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repository.beginQuestion).not.toHaveBeenCalled();
    expect(provider.complete).not.toHaveBeenCalled();
  });

  it("counts Unicode characters instead of UTF-16 code units", async () => {
    const { service, repository } = dependencies();

    await service.ask(admin(), { sessionId: "qa-session-id", question: "🙂".repeat(1001) });

    expect(repository.beginQuestion).toHaveBeenCalledWith(expect.objectContaining({ question: "🙂".repeat(1001) }));
  });

  it("shares one 65-second queue-wait budget across quota and session ordering", async () => {
    const { service, repository } = dependencies();
    vi.mocked(repository.beginQuestion).mockResolvedValue({
      messageId: "message-id",
      sessionId: "qa-session-id",
      allowed: true,
      waitedMs: 50_000,
      submissionSequence: 2,
      sources: [],
    });

    await service.ask(admin(), { sessionId: "qa-session-id", question: "问题" });

    expect(repository.waitForTurn).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 15_000 }));
  });

  it("returns the session created with the first valid question", async () => {
    const { service, repository, complete, listPublishedSources } = dependencies();
    const source = {
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "数据库事务保证状态变更的一致性。",
    };
    listPublishedSources.mockResolvedValue([source]);
    complete.mockResolvedValue({
      answer: "事务确保状态变更一致。",
      refused: false,
      evidenceSupported: true,
      citations: [{ sourceId: source.articleVersionId, quote: "数据库事务保证状态变更的一致性。" }],
      inputTokens: 20,
      outputTokens: 10,
    });

    const result = await service.ask(admin(), { question: "事务有什么作用？" });

    expect(repository.beginQuestion).toHaveBeenCalledWith(expect.objectContaining({ sessionId: undefined }));
    expect(result).toMatchObject({ sessionId: "qa-session-id", status: "succeeded" });
  });

  it("rejects a reader before loading any Q&A data", async () => {
    const { service, repository } = dependencies();

    await expect(service.listSessions(admin("reader"))).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.listSessions).not.toHaveBeenCalled();
  });

  it("stores only verified citations bound to the published article version", async () => {
    const { service, complete, listPublishedSources, repository } = dependencies();
    const source = {
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "数据库事务保证状态变更的一致性。",
    };
    listPublishedSources.mockResolvedValue([source]);
    complete.mockResolvedValue({
      answer: "数据库事务保证状态变更的一致性。",
      refused: false,
      evidenceSupported: true,
      citations: [
        { sourceId: "published-version-id", quote: "数据库事务保证状态变更的一致性。" },
        { sourceId: "model-invented-id", quote: "外部知识" },
        { sourceId: "published-version-id", quote: "不存在于原文的说法" },
      ],
      inputTokens: 23,
      outputTokens: 11,
    });

    const result = await service.ask(admin(), { sessionId: "qa-session-id", question: "事务保证什么？" });

    expect(result).toMatchObject({ status: "succeeded", citations: [{ articleVersionId: "published-version-id", url: source.url }] });
    expect(repository.settleQuestion).toHaveBeenCalledWith(expect.objectContaining({
      status: "succeeded",
      inputTokens: 23,
      outputTokens: 11,
      citations: [{
        articleVersionId: source.articleVersionId,
        slug: source.slug,
        title: source.title,
        url: source.url,
        quote: "数据库事务保证状态变更的一致性。",
      }],
    }));
  });

  it("accepts a supported paraphrase without requiring shared keywords", async () => {
    const { service, complete, listPublishedSources } = dependencies();
    listPublishedSources.mockResolvedValue([{
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "数据库事务保证状态变更的一致性。",
    }]);
    complete.mockResolvedValue({
      answer: "文章指出，事务可以确保状态变更保持一致。",
      refused: false,
      evidenceSupported: true,
      citations: [{ sourceId: "published-version-id", quote: "数据库事务保证状态变更的一致性。" }],
      inputTokens: 20,
      outputTokens: 10,
    });

    const result = await service.ask(admin(), { sessionId: "qa-session-id", question: "为什么需要事务？" });

    expect(result).toMatchObject({
      status: "succeeded",
      answer: "文章指出，事务可以确保状态变更保持一致。",
      citations: [{ quote: "数据库事务保证状态变更的一致性。" }],
    });
  });

  it("turns a response with no verifiable source into a refusal", async () => {
    const { service, complete, listPublishedSources, repository } = dependencies();
    listPublishedSources.mockResolvedValue([{
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "文章原文内容。",
    }]);
    complete.mockResolvedValue({
      answer: "这是模型编造的回答。",
      refused: false,
      evidenceSupported: true,
      citations: [{ sourceId: "unknown-version", quote: "看起来像引用的内容" }],
      inputTokens: 20,
      outputTokens: 10,
    });

    const result = await service.ask(admin(), { sessionId: "qa-session-id", question: "问题" });

    expect(result).toMatchObject({ status: "refused", citations: [] });
    expect(repository.settleQuestion).toHaveBeenCalledWith(expect.objectContaining({ status: "refused", citations: [] }));
  });

  it("allows an evidence-supported paraphrase for a broad question", async () => {
    const { service, complete, listPublishedSources, repository } = dependencies();
    listPublishedSources.mockResolvedValue([{
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "数据库事务保证状态变更的一致性。",
    }]);
    complete.mockResolvedValue({
      answer: "文章说明事务可以让状态变更保持一致。",
      refused: false,
      evidenceSupported: true,
      citations: [{ sourceId: "published-version-id", quote: "数据库事务保证状态变更的一致性。" }],
      inputTokens: 20,
      outputTokens: 10,
    });

    const result = await service.ask(admin(), { sessionId: "qa-session-id", question: "文章讲什么？" });

    expect(result).toMatchObject({ status: "succeeded", citations: [{ quote: "数据库事务保证状态变更的一致性。" }] });
    expect(repository.settleQuestion).toHaveBeenCalledWith(expect.objectContaining({ status: "succeeded" }));
  });

  it("refuses an answer longer than the specified target", async () => {
    const { service, complete, listPublishedSources, repository } = dependencies();
    listPublishedSources.mockResolvedValue([{
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "数据库事务保证状态变更的一致性。",
    }]);
    complete.mockResolvedValue({
      answer: "答".repeat(801),
      refused: false,
      evidenceSupported: true,
      citations: [{ sourceId: "published-version-id", quote: "数据库事务保证状态变更的一致性。" }],
      inputTokens: 20,
      outputTokens: 10,
    });

    const result = await service.ask(admin(), { sessionId: "qa-session-id", question: "事务保证什么？" });

    expect(result).toMatchObject({ status: "refused", citations: [] });
    expect(repository.settleQuestion).toHaveBeenCalledWith(expect.objectContaining({ status: "refused", citations: [] }));
  });

  it("refuses a model answer that is not supported by its cited source", async () => {
    const { service, complete, listPublishedSources, repository } = dependencies();
    listPublishedSources.mockResolvedValue([{
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "数据库事务保证状态变更的一致性。",
    }]);
    complete.mockResolvedValue({
      answer: "文章说明海洋气候由火山活动控制。",
      refused: false,
      evidenceSupported: false,
      citations: [{ sourceId: "published-version-id", quote: "数据库事务保证状态变更的一致性。" }],
      inputTokens: 20,
      outputTokens: 10,
    });

    const result = await service.ask(admin(), { sessionId: "qa-session-id", question: "文章讲什么？" });

    expect(result).toMatchObject({ status: "refused", citations: [] });
    expect(repository.settleQuestion).toHaveBeenCalledWith(expect.objectContaining({ status: "refused", citations: [] }));
  });

  it("reports provider failures as a safe model-unavailable error and records timeout state", async () => {
    const { service, complete, listPublishedSources, repository } = dependencies();
    listPublishedSources.mockResolvedValue([{
      articleVersionId: "published-version-id",
      slug: "published-article",
      title: "已发布文章",
      url: "/articles/published-article?version=published-version-id",
      contentText: "可验证原文摘录。",
    }]);
    const timeout = new Error("secret provider response");
    timeout.name = "TimeoutError";
    complete.mockRejectedValue(timeout);

    await expect(service.ask(admin(), { sessionId: "qa-session-id", question: "问题" }))
      .rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", message: "问答请求超时，请主动重试。" });
    expect(repository.settleQuestion).toHaveBeenCalledWith(expect.objectContaining({ status: "timed_out" }));
  });
});
