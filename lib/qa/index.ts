import "server-only";
import { hasDatabase } from "@/lib/db";
import { readQaConfig } from "./config";
import { deepSeekProvider } from "./deepseek";
import { qaRepository } from "./repository";
import { createQaService } from "./service";

const config = readQaConfig();

const service = createQaService({
  repository: qaRepository,
  provider: deepSeekProvider,
  enabled: config.enabled && hasDatabase,
  modelId: config.modelIds[0],
  modelIds: config.modelIds,
});

export const listAdminQaSessions = service.listSessions;
export const getAdminQaSession = service.getSession;
export const deleteAdminQaSession = service.deleteSession;
export const askAdminQaQuestion = service.ask;

export function getAdminQaSettings() {
  return {
    enabled: config.enabled && hasDatabase,
    models: config.enabled && hasDatabase ? config.modelIds : [],
    canSelectModel: config.enabled && hasDatabase && config.modelIds.length > 1,
  };
}
