import "server-only";
import { AuthError } from "@/lib/auth/errors";
import type { Session } from "@/lib/auth/types";

export type QaCitation = {
  articleVersionId: string;
  slug: string;
  title: string;
  url: string;
  quote: string;
};

export type QaSource = Omit<QaCitation, "quote"> & { contentText: string };

export type QaSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: QaMessage[];
};

export type QaMessage = {
  id: string;
  question: string;
  answer: string | null;
  status: "queued" | "processing" | "succeeded" | "refused" | "failed" | "timed_out";
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  citations: QaCitation[];
  createdAt: string;
};

export type QaRepository = {
  getSession(adminId: string, sessionId: string): Promise<QaSession | undefined>;
  listSessions(adminId: string): Promise<Omit<QaSession, "messages">[]>;
  deleteSession(adminId: string, sessionId: string): Promise<void>;
  listPublishedSources(): Promise<QaSource[]>;
  waitForTurn(input: { adminId: string; sessionId: string; submissionSequence: number; timeoutMs?: number }): Promise<boolean>;
  beginQuestion(input: { adminId: string; sessionId?: string; question: string; day: string }): Promise<{ messageId: string; sessionId: string; allowed: boolean; waitExpired?: boolean; waitedMs?: number; submissionSequence?: number; sources?: QaSource[] }>;
  settleQuestion(input: {
    adminId: string;
    messageId: string;
    status: "succeeded" | "refused" | "failed" | "timed_out";
    answer?: string;
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
    quotaDay?: string;
    citations?: QaCitation[];
  }): Promise<boolean>;
};

export type QaProviderResult = {
  answer: string;
  refused: boolean;
  evidenceSupported: boolean;
  citations: Array<{ sourceId: string; quote: string }>;
  inputTokens: number;
  outputTokens: number;
};

export type QaProvider = {
  complete(input: { modelId: string; question: string; sources: QaSource[]; maxOutputTokens: number }): Promise<QaProviderResult>;
};

const requireAdmin = (session: Session | undefined): Session => {
  if (!session) throw new AuthError("UNAUTHENTICATED", "请先登录。");
  if (session.role !== "admin" || session.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
  return session;
};

const requireEnabled = (enabled: boolean) => {
  if (!enabled) throw new AuthError("DATABASE_UNAVAILABLE", "问答功能尚未开放。");
};

const shanghaiDay = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function createQaService(input: {
  repository: QaRepository;
  provider: QaProvider;
  enabled: boolean;
  modelId?: string;
  modelIds?: string[];
}) {
  const { repository, provider, enabled, modelId = "deepseek-chat", modelIds = [modelId] } = input;

  return {
    async listSessions(session: Session | undefined) {
      requireEnabled(enabled);
      const admin = requireAdmin(session);
      return repository.listSessions(admin.id);
    },

    async ask(session: Session | undefined, input: { sessionId?: string; question: string; modelId?: string }) {
      requireEnabled(enabled);
      const admin = requireAdmin(session);
      if (typeof input.question !== "string" || !input.question.trim() || Array.from(input.question).length > 2000) {
        throw new AuthError("INVALID_INPUT", "问题不能为空且不能超过 2,000 个字符。");
      }
      const selectedModel = input.modelId ?? modelId;
      if (!modelIds.includes(selectedModel)) throw new AuthError("INVALID_INPUT", "请选择可用的问答模型。");
      const day = shanghaiDay();
      const reservation = await repository.beginQuestion({ adminId: admin.id, sessionId: input.sessionId, question: input.question.trim(), day });
      if (!reservation.allowed) {
        if (reservation.waitExpired) throw new AuthError("MODEL_UNAVAILABLE", "问答队列繁忙，请稍后主动重试。");
        throw new AuthError("RATE_LIMITED", "今日成功回答次数已用完。");
      }
      const sources = reservation.sources ?? await repository.listPublishedSources();
      const inOrder = await repository.waitForTurn({
        adminId: admin.id,
        sessionId: reservation.sessionId,
        submissionSequence: reservation.submissionSequence ?? 1,
        timeoutMs: Math.max(0, 65_000 - (reservation.waitedMs ?? 0)),
      });
      if (!inOrder) {
        await repository.settleQuestion({ adminId: admin.id, messageId: reservation.messageId, status: "timed_out" });
        throw new AuthError("MODEL_UNAVAILABLE", "问答队列等待超时，请稍后主动重试。");
      }
      if (sources.length === 0) {
        const answer = "当前没有可供问答的已发布文章。";
        await repository.settleQuestion({ adminId: admin.id, messageId: reservation.messageId, status: "refused", answer, modelId: selectedModel });
        return { messageId: reservation.messageId, sessionId: reservation.sessionId, status: "refused" as const, answer, citations: [] };
      }
      let result: QaProviderResult;
      try {
        result = await provider.complete({ modelId: selectedModel, question: input.question.trim(), sources, maxOutputTokens: 1000 });
      } catch (error) {
        const status = error instanceof Error && error.name === "TimeoutError" ? "timed_out" : "failed";
        try {
          await repository.settleQuestion({ adminId: admin.id, messageId: reservation.messageId, status });
        } catch {
          // Preserve a generic error even if storing the failure also fails.
        }
        throw new AuthError("MODEL_UNAVAILABLE", status === "timed_out" ? "问答请求超时，请主动重试。" : "问答暂时无法完成，请稍后重试。");
      }
      const byId = new Map(sources.map((source) => [source.articleVersionId, source]));
      const citations = result.citations.flatMap(({ sourceId, quote }) => {
        const source = byId.get(sourceId);
        const normalizedQuote = quote.trim();
        return source && normalizedQuote && source.contentText.includes(normalizedQuote)
          ? [{ articleVersionId: source.articleVersionId, slug: source.slug, title: source.title, url: source.url, quote: normalizedQuote }]
          : [];
      });
      const answerText = result.answer.trim();
      const refused = result.refused || !result.evidenceSupported || citations.length === 0
        || !answerText || Array.from(answerText).length > 800;
      const answer = refused ? "现有已发布文章证据不足，无法回答。" : answerText;
      const status = refused ? "refused" : "succeeded";
      const successCounted = await repository.settleQuestion({
        adminId: admin.id,
        messageId: reservation.messageId,
        status,
        answer,
        modelId: selectedModel,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        quotaDay: shanghaiDay(),
        citations: refused ? [] : citations,
      });
      const quotaRefused = status === "succeeded" && !successCounted;
      return {
        messageId: reservation.messageId,
        sessionId: reservation.sessionId,
        status: quotaRefused ? "refused" as const : status,
        answer: quotaRefused ? "今日成功回答次数已用完。" : answer,
        citations: quotaRefused ? [] : refused ? [] : citations,
      };
    },

    async getSession(session: Session | undefined, sessionId: string) {
      requireEnabled(enabled);
      const admin = requireAdmin(session);
      const result = await repository.getSession(admin.id, sessionId);
      if (!result) throw new AuthError("NOT_FOUND", "问答会话不存在。");
      return result;
    },

    async deleteSession(session: Session | undefined, sessionId: string) {
      requireEnabled(enabled);
      const admin = requireAdmin(session);
      const result = await repository.getSession(admin.id, sessionId);
      if (!result) throw new AuthError("NOT_FOUND", "问答会话不存在。");
      await repository.deleteSession(admin.id, sessionId);
    },
  };
}
