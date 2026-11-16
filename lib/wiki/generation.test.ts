import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWikiGenerationService, type WikiGenerationProvider, type WikiGenerationRepository } from "./generation";

const article = (slug: string, versionId: string) => ({
  id: `article-${slug}`,
  versionId,
  slug,
  title: slug,
  contentText: `${slug} article body`,
});

const job = {
  id: "job-1",
  kind: "initial" as const,
  articleVersionId: null,
  actorId: "admin-1",
};

const candidate = {
  slug: "database-transactions",
  title: "数据库事务",
  body: "事务保证一组数据库变更的一致性。",
  sourceArticleVersionIds: ["version-1"],
  relatedSlugs: [],
};

describe("Wiki generation service", () => {
  let repository: WikiGenerationRepository;
  let generate: ReturnType<typeof vi.fn<WikiGenerationProvider["generate"]>>;

  beforeEach(() => {
    repository = {
      enqueueInitialJob: vi.fn(),
      claimNextJob: vi.fn(),
      loadCurrentPublishedArticles: vi.fn(),
      loadAffectedPages: vi.fn(),
      completeJobWithDrafts: vi.fn(),
      failJob: vi.fn(),
    };
    generate = vi.fn<WikiGenerationProvider["generate"]>();
  });

  it("does not claim queued work or call the provider until both switches enable generation", async () => {
    repository.claimNextJob = vi.fn().mockResolvedValue(job);
    const service = createWikiGenerationService({ repository, provider: { generate }, enabled: false });

    await service.processPendingJobs();

    expect(repository.claimNextJob).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });

  it("gives initial generation every current published article and saves only reviewable drafts", async () => {
    const articles = [article("transactions", "version-1"), article("indexes", "version-2")];
    repository.claimNextJob = vi.fn().mockResolvedValue(job);
    repository.loadCurrentPublishedArticles = vi.fn().mockResolvedValue(articles);
    repository.loadAffectedPages = vi.fn().mockResolvedValue([]);
    generate.mockResolvedValue({ pages: [candidate], inputTokens: 40, outputTokens: 12 });
    const service = createWikiGenerationService({ repository, provider: { generate }, enabled: true });

    await service.processPendingJobs();

    expect(generate).toHaveBeenCalledWith({ kind: "initial", articles, affectedPages: [] });
    expect(repository.completeJobWithDrafts).toHaveBeenCalledWith(job, [candidate], { inputTokens: 40, outputTokens: 12 });
  });

  it("does not save candidates when generation fails and records a retryable failure", async () => {
    repository.claimNextJob = vi.fn().mockResolvedValue(job);
    repository.loadCurrentPublishedArticles = vi.fn().mockResolvedValue([article("transactions", "version-1")]);
    repository.loadAffectedPages = vi.fn().mockResolvedValue([]);
    generate.mockRejectedValue(new Error("provider failed"));
    const service = createWikiGenerationService({ repository, provider: { generate }, enabled: true });

    await service.processPendingJobs();

    expect(repository.completeJobWithDrafts).not.toHaveBeenCalled();
    expect(repository.failJob).toHaveBeenCalledWith("job-1", "provider_failed");
    expect(repository.completeJobWithDrafts).not.toHaveBeenCalled();
  });

  it("rejects provider candidates that cite an article version outside the job input", async () => {
    repository.claimNextJob = vi.fn().mockResolvedValue(job);
    repository.loadCurrentPublishedArticles = vi.fn().mockResolvedValue([article("transactions", "version-1")]);
    repository.loadAffectedPages = vi.fn().mockResolvedValue([]);
    generate.mockResolvedValue({
      pages: [{ ...candidate, sourceArticleVersionIds: ["unrelated-version"] }],
      inputTokens: 40,
      outputTokens: 12,
    });
    const service = createWikiGenerationService({ repository, provider: { generate }, enabled: true });

    await service.processPendingJobs();

    expect(repository.completeJobWithDrafts).not.toHaveBeenCalled();
    expect(repository.failJob).toHaveBeenCalledWith("job-1", "invalid_candidate");
  });

  it("allows an update to retain current sources already attached to an affected page", async () => {
    const updateJob = { ...job, kind: "update" as const, articleVersionId: "version-1" };
    const articles = [article("transactions", "version-1")];
    const affectedPages = [{
      slug: "database-transactions",
      title: "数据库事务",
      body: "已有整理。",
      sourceArticleVersionIds: ["version-1", "current-supporting-version"],
    }];
    repository.claimNextJob = vi.fn().mockResolvedValue(updateJob);
    repository.loadCurrentPublishedArticles = vi.fn().mockResolvedValue(articles);
    repository.loadAffectedPages = vi.fn().mockResolvedValue(affectedPages);
    generate.mockResolvedValue({
      pages: [{ ...candidate, sourceArticleVersionIds: affectedPages[0].sourceArticleVersionIds }],
      inputTokens: 40,
      outputTokens: 12,
    });
    const service = createWikiGenerationService({ repository, provider: { generate }, enabled: true });

    await service.processPendingJobs();

    expect(repository.completeJobWithDrafts).toHaveBeenCalledWith(
      updateJob,
      [expect.objectContaining({ sourceArticleVersionIds: affectedPages[0].sourceArticleVersionIds })],
      { inputTokens: 40, outputTokens: 12 },
    );
    expect(repository.failJob).not.toHaveBeenCalled();
  });
});
