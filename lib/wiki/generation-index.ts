import "server-only";
import { hasDatabase } from "@/lib/db";
import { deepSeekWikiGenerationProvider } from "./deepseek-generation";
import { readWikiGenerationConfig } from "./generation-config";
import { wikiGenerationRepository } from "./generation-repository";
import { createWikiGenerationService } from "./generation";

const config = readWikiGenerationConfig();
const service = createWikiGenerationService({
  repository: wikiGenerationRepository,
  provider: deepSeekWikiGenerationProvider,
  enabled: config.enabled && hasDatabase,
});

export const enqueueInitialWikiGeneration = service.enqueueInitialGeneration;
export const processWikiGenerationJobs = service.processPendingJobs;
export const isWikiGenerationEnabled = () => config.enabled && hasDatabase;
