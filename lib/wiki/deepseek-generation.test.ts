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

  it("never sends Wiki content to DeepSeek before generation has been approved", async () => {
    vi.stubEnv("WIKI_AI_GENERATION_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "true");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    const fetchStub = vi.spyOn(globalThis, "fetch");

    await expect(deepSeekWikiGenerationProvider.generate({
      kind: "initial",
      articles: [{ id: "article", versionId: "article-version", slug: "transactions", title: "事务", contentText: "正文" }],
      affectedPages: [],
    })).rejects.toThrow("Wiki AI 生成未启用。");
    expect(fetchStub).not.toHaveBeenCalled();
    fetchStub.mockRestore();
  });
});
