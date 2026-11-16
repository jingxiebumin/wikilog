import { afterEach, describe, expect, it, vi } from "vitest";
import { deepSeekProvider } from "./deepseek";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("DeepSeek provider", () => {
  it("makes one server-side request and returns parsed answer with token usage", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "server-secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        answer: "事务具备原子性。",
        refused: false,
        evidence_supported: true,
        citations: [{ sourceId: "version-id", quote: "事务具备原子性。" }],
      }) } }],
      usage: { prompt_tokens: 31, completion_tokens: 9 },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await deepSeekProvider.complete({
      modelId: "deepseek-chat",
      question: "事务有什么特性？",
      sources: [{ articleVersionId: "version-id", slug: "db", title: "数据库", url: "/articles/db", contentText: "事务具备原子性。" }],
      maxOutputTokens: 1200,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.deepseek.com/chat/completions", expect.objectContaining({
      headers: expect.objectContaining({ authorization: "Bearer server-secret" }),
      signal: expect.any(AbortSignal),
    }));
    expect(JSON.stringify(result)).not.toContain("server-secret");
    expect(result).toMatchObject({ inputTokens: 31, outputTokens: 9, citations: [{ sourceId: "version-id" }] });
  });

  it("does not expose provider response bodies or retry provider errors", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "server-secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("server-secret provider detail", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deepSeekProvider.complete({
      modelId: "deepseek-chat",
      question: "问题",
      sources: [],
      maxOutputTokens: 1200,
    })).rejects.toThrow("问答服务暂时不可用。");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
