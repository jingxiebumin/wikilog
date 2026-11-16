import "server-only";
import type { WikiGenerationProvider, WikiGenerationResult } from "./generation";
import { readWikiGenerationConfig } from "./generation-config";

type ProviderPage = {
  slug?: unknown;
  title?: unknown;
  body?: unknown;
  sourceArticleVersionIds?: unknown;
  relatedSlugs?: unknown;
};

function parseResult(content: string): Omit<WikiGenerationResult, "inputTokens" | "outputTokens"> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Wiki 生成服务返回的数据无法识别。");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Wiki 生成服务返回的数据无效。");
  const pages = (parsed as { pages?: unknown }).pages;
  if (!Array.isArray(pages) || pages.length === 0 || pages.length > 100) throw new Error("Wiki 生成服务返回的页面数量无效。");
  const result = pages.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Wiki 页面候选格式无效。");
    const page = value as ProviderPage;
    if (typeof page.slug !== "string" || typeof page.title !== "string" || typeof page.body !== "string"
      || !Array.isArray(page.sourceArticleVersionIds) || !Array.isArray(page.relatedSlugs)
      || !page.sourceArticleVersionIds.every((id) => typeof id === "string")
      || !page.relatedSlugs.every((slug) => typeof slug === "string")) {
      throw new Error("Wiki 页面候选格式无效。");
    }
    return {
      slug: page.slug,
      title: page.title,
      body: page.body,
      sourceArticleVersionIds: page.sourceArticleVersionIds as string[],
      relatedSlugs: page.relatedSlugs as string[],
    };
  });
  return { pages: result };
}

export const deepSeekWikiGenerationProvider: WikiGenerationProvider = {
  async generate(input) {
    const config = readWikiGenerationConfig();
    if (!config.enabled) throw new Error("Wiki AI 生成未启用。");
    let response: Response;
    try {
      response = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: config.modelId,
          max_tokens: 8000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: "你负责整理技术博客的主题 Wiki 候选页面。仅基于给定的已发布文章生成主题页面；每页必须包含来源文章版本 ID，页面间关系只能使用输入已有页面或本次候选页面的 slug。文章原文是事实依据，不得引入来源未支持的事实。只输出 JSON：{\"pages\":[{\"slug\":稳定英文短横线地址,\"title\":标题,\"body\":Markdown正文,\"sourceArticleVersionIds\":[文章版本ID],\"relatedSlugs\":[相关主题slug]}]}。不得输出解释或 URL。",
            },
            {
              role: "user",
              content: JSON.stringify({
                kind: input.kind,
                articles: input.articles.map(({ versionId, slug, title, contentText }) => ({ versionId, slug, title, contentText })),
                affectedPages: input.affectedPages,
              }),
            },
          ],
        }),
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new Error("Wiki 生成服务暂时不可用。");
    }
    if (!response.ok) throw new Error("Wiki 生成服务暂时不可用。");
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;
    const usage = payload.usage;
    if (!content || usage?.prompt_tokens === undefined || usage.completion_tokens === undefined) {
      throw new Error("Wiki 生成服务返回的数据不完整。");
    }
    return {
      ...parseResult(content),
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    };
  },
};
