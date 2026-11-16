import { afterEach, describe, expect, it, vi } from "vitest";
import { readQaConfig } from "./config";

afterEach(() => vi.unstubAllEnvs());

describe("Q&A runtime configuration", () => {
  it("keeps Q&A disabled by default", () => {
    vi.stubEnv("ADMIN_QA_ENABLED", "");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "");

    expect(readQaConfig()).toMatchObject({ enabled: false, dataPolicyVerified: false, modelIds: [] });
  });

  it("requires an explicit data-policy verification flag and server credentials", () => {
    vi.stubEnv("ADMIN_QA_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "false");
    vi.stubEnv("DEEPSEEK_API_KEY", "secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    expect(readQaConfig().enabled).toBe(false);

    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "true");
    expect(readQaConfig()).toMatchObject({ enabled: true, modelIds: ["deepseek-chat"] });
  });
});
