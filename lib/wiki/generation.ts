import type { SaveWikiPageDraftInput } from "./repository";

export type WikiGenerationArticle = {
  id: string;
  versionId: string;
  slug: string;
  title: string;
  contentText: string;
};

export type WikiGenerationJob = {
  id: string;
  kind: "initial" | "update";
  articleVersionId: string | null;
  actorId: string;
};

export type WikiGenerationCandidate = SaveWikiPageDraftInput;

export type WikiGenerationRepository = {
  enqueueInitialJob(actorId: string): Promise<void>;
  claimNextJob(): Promise<WikiGenerationJob | undefined>;
  loadCurrentPublishedArticles(versionId?: string): Promise<WikiGenerationArticle[]>;
  loadAffectedPages(versionId: string): Promise<Array<{ slug: string; title: string; body: string; sourceArticleVersionIds: string[] }>>;
  completeJobWithDrafts(
    job: WikiGenerationJob,
    candidates: WikiGenerationCandidate[],
    usage: { inputTokens: number; outputTokens: number },
  ): Promise<void>;
  failJob(jobId: string, reason: "provider_failed" | "invalid_candidate" | "no_published_articles"): Promise<void>;
};

export type WikiGenerationResult = {
  pages: WikiGenerationCandidate[];
  inputTokens: number;
  outputTokens: number;
};

export type WikiGenerationProvider = {
  generate(input: {
    kind: WikiGenerationJob["kind"];
    articles: WikiGenerationArticle[];
    affectedPages: Array<{ slug: string; title: string; body: string; sourceArticleVersionIds: string[] }>;
  }): Promise<WikiGenerationResult>;
};

function candidatesAreGrounded(
  pages: WikiGenerationCandidate[],
  articles: WikiGenerationArticle[],
  affectedPages: Array<{ slug: string; title: string; body: string; sourceArticleVersionIds: string[] }>,
) {
  if (pages.length === 0 || pages.length > 100) return false;
  const allowedSources = new Set([
    ...articles.map(({ versionId }) => versionId),
    ...affectedPages.flatMap(({ sourceArticleVersionIds }) => sourceArticleVersionIds),
  ]);
  const allowedRelations = new Set([...pages.map(({ slug }) => slug), ...affectedPages.map(({ slug }) => slug)]);
  const slugs = new Set<string>();

  for (const page of pages) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug) || slugs.has(page.slug)) return false;
    if (!page.title.trim() || !page.body.trim() || page.body.length > 20_000) return false;
    if (page.sourceArticleVersionIds.length === 0 || page.sourceArticleVersionIds.some((id) => !allowedSources.has(id))) return false;
    if (page.relatedSlugs.some((slug) => slug === page.slug || !allowedRelations.has(slug))) return false;
    slugs.add(page.slug);
  }
  return true;
}

export function createWikiGenerationService(input: {
  repository: WikiGenerationRepository;
  provider: WikiGenerationProvider;
  enabled: boolean;
}) {
  const { repository, provider, enabled } = input;

  return {
    async enqueueInitialGeneration(actorId: string) {
      if (!enabled) return false;
      await repository.enqueueInitialJob(actorId);
      return true;
    },

    async processPendingJobs(maxJobs = 1) {
      if (!enabled) return 0;
      const limit = Math.max(1, Math.min(10, Math.floor(maxJobs)));
      let processed = 0;
      for (; processed < limit; processed += 1) {
        const job = await repository.claimNextJob();
        if (!job) break;
        const articles = await repository.loadCurrentPublishedArticles(
          job.kind === "update" ? job.articleVersionId ?? undefined : undefined,
        );
        if (articles.length === 0) {
          await repository.failJob(job.id, "no_published_articles");
          continue;
        }
        const affectedPages = job.kind === "update" && job.articleVersionId
          ? await repository.loadAffectedPages(job.articleVersionId)
          : [];
        let result: WikiGenerationResult;
        try {
          result = await provider.generate({ kind: job.kind, articles, affectedPages });
        } catch {
          await repository.failJob(job.id, "provider_failed");
          continue;
        }
        if (!candidatesAreGrounded(result.pages, articles, affectedPages)) {
          await repository.failJob(job.id, "invalid_candidate");
          continue;
        }
        await repository.completeJobWithDrafts(job, result.pages, {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        });
      }
      return processed;
    },
  };
}
