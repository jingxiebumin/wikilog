import "server-only";
import type { QaProvider, QaProviderResult } from "./service";
import { readQaConfig } from "./config";

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

type ModelAnswer = {
  answer?: unknown;
  refused?: unknown;
  evidence_supported?: unknown;
  citations?: unknown;
};

const parseModelAnswer = (content: string): ModelAnswer => {
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    return parsed as ModelAnswer;
  } catch {
    throw new Error("问答服务返回了无法识别的内容。");
  }
};

export const deepSeekProvider: QaProvider = {
  async complete(input): Promise<QaProviderResult> {
    const config = readQaConfig();
    if (!config.apiKey || !config.modelIds.includes(input.modelId)) {
      throw new Error("问答服务配置无效。");
    }
    let response: Response;
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: input.modelId,
          max_tokens: input.maxOutputTokens,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "你是文章问答助手。Wiki 页面只用于整理主题和定位内容，文章原文才是事实依据。只根据给定文章原文回答，可以简洁转述或归纳，但每项事实都必须得到引用原文支持；证据不足时拒答。输出 JSON 对象：answer 是不超过约 800 个中文字的直接回答；refused 为布尔值；evidence_supported 只有在引用原文确实支持回答中的每项事实时才为 true；citations 为数组，每项包含 sourceId（文章版本 ID）和 quote（逐字摘录且能支持回答的原文片段）。不要输出 URL，不要使用给定原文之外的知识。",
            },
            {
              role: "user",
              content: JSON.stringify({
                question: input.question,
                wikiPages: input.wikiPages.map(({ slug, title, body }) => ({ slug, title, body })),
                sources: input.sources.map(({ articleVersionId, title, contentText }) => ({ id: articleVersionId, title, text: contentText })),
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
        const timeout = new Error("问答请求超时。");
        timeout.name = "TimeoutError";
        throw timeout;
      }
      throw new Error("问答服务暂时不可用。");
    }
    if (!response.ok) throw new Error("问答服务暂时不可用。");
    const payload = await response.json() as DeepSeekResponse;
    const content = payload.choices?.[0]?.message?.content;
    const usage = payload.usage;
    if (!content || usage?.prompt_tokens === undefined || usage.completion_tokens === undefined) {
      throw new Error("问答服务返回的数据不完整。");
    }
    const modelAnswer = parseModelAnswer(content);
    const citations = Array.isArray(modelAnswer.citations) ? modelAnswer.citations.flatMap((citation) => {
      if (!citation || typeof citation !== "object") return [];
      const item = citation as { sourceId?: unknown; quote?: unknown };
      return typeof item.sourceId === "string" && typeof item.quote === "string"
        ? [{ sourceId: item.sourceId, quote: item.quote }]
        : [];
    }) : [];
    return {
      answer: typeof modelAnswer.answer === "string" ? modelAnswer.answer : "",
      refused: modelAnswer.refused === true,
      evidenceSupported: modelAnswer.evidence_supported === true,
      citations,
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    };
  },
};
