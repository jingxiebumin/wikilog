export type QaConfig = {
  enabled: boolean;
  dataPolicyVerified: boolean;
  apiKey: string;
  modelIds: string[];
};

export function readQaConfig(env: NodeJS.ProcessEnv = process.env): QaConfig {
  const apiKey = env.DEEPSEEK_API_KEY?.trim() ?? "";
  const dataPolicyVerified = env.DEEPSEEK_DATA_POLICY_VERIFIED === "true";
  const modelIds = [...new Set((env.DEEPSEEK_TEXT_MODELS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => /^[a-zA-Z0-9._-]{1,64}$/.test(id)))];
  const enabled = env.ADMIN_QA_ENABLED === "true" && dataPolicyVerified && Boolean(apiKey) && modelIds.length > 0;
  return { enabled, dataPolicyVerified, apiKey, modelIds };
}
