export type WikiGenerationConfig = {
  enabled: boolean;
  dataPolicyVerified: boolean;
  apiKey: string;
  modelId: string;
};

export function readWikiGenerationConfig(env: NodeJS.ProcessEnv = process.env): WikiGenerationConfig {
  const apiKey = env.DEEPSEEK_API_KEY?.trim() ?? "";
  const modelId = env.DEEPSEEK_TEXT_MODELS?.split(",").map((value) => value.trim()).find((value) => /^[a-zA-Z0-9._-]{1,64}$/.test(value)) ?? "";
  const dataPolicyVerified = env.DEEPSEEK_DATA_POLICY_VERIFIED === "true";
  return { enabled: false, dataPolicyVerified, apiKey, modelId };
}
