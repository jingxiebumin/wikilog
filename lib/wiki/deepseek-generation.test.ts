import { afterEach, describe, expect, it, vi } from "vitest";
import { deepSeekWikiGenerationProvider } from "./deepseek-generation";

describe("DeepSeek Wiki generation provider", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not make a network request before both feature and policy gates pass", async () => {
    vi.stubEnv("WIKI_AI_GENERATION_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "false");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    const fetchStub = vi.spyOn(globalThis, "fetch");

    await expect(deepSeekWikiGenerationProvider.generate({ kind: "initial", articles: [], affectedPages: [] }))
      .rejects.toThrow("Wiki AI 生成未启用。");
    expect(fetchStub).not.toHaveBeenCalled();
    fetchStub.mockRestore();
  });

  it("parses generated pages and records provider token usage without exposing credentials", async () => {
    vi.stubEnv("WIKI_AI_GENERATION_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "true");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    const fetchStub = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        pages: [{
          slug: "database-transactions", title: "数据库事务", body: "事务保证原子性。",
          sourceArticleVersionIds: ["article-version"], relatedSlugs: [],
        }],
      }) } }],
      usage: { prompt_tokens: 50, completion_tokens: 20 },
    }), { status: 200, headers: { "content-type": "application/json" } }));

    await expect(deepSeekWikiGenerationProvider.generate({
      kind: "initial",
      articles: [{ id: "article", versionId: "article-version", slug: "transactions", title: "事务", contentText: "正文" }],
      affectedPages: [],
    })).resolves.toMatchObject({
      pages: [{ slug: "database-transactions", sourceArticleVersionIds: ["article-version"] }],
      inputTokens: 50,
      outputTokens: 20,
    });
    expect(fetchStub.mock.calls[0]?.[1]?.headers).toMatchObject({ authorization: "Bearer test-secret" });
    fetchStub.mockRestore();
  });
});
