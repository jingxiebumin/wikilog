import { afterEach, describe, expect, it, vi } from "vitest";
import { readWikiGenerationConfig } from "./generation-config";

describe("Wiki generation config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps generation disabled unless the owner and data policy enable it with credentials", () => {
    vi.stubEnv("WIKI_AI_GENERATION_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "false");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    expect(readWikiGenerationConfig().enabled).toBe(false);

    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "true");
    expect(readWikiGenerationConfig().enabled).toBe(false);
  });

  it("requires an explicit feature flag, API key, and valid model", () => {
    const safeEnvironment = { ...process.env, DEEPSEEK_DATA_POLICY_VERIFIED: "true" };
    expect(readWikiGenerationConfig(safeEnvironment).enabled).toBe(false);
    expect(readWikiGenerationConfig({
      ...safeEnvironment,
      WIKI_AI_GENERATION_ENABLED: "true",
      DEEPSEEK_API_KEY: "key",
      DEEPSEEK_TEXT_MODELS: "unsafe model",
    }).enabled).toBe(false);
  });
});
