import type { Session } from "@/lib/auth/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  listPublishedWikiPages: vi.fn(),
  findPublishedWikiPage: vi.fn(),
  searchPublishedWikiPages: vi.fn(),
  listAdminWikiPages: vi.fn(),
  getWikiPageHistory: vi.fn(),
  saveWikiPageDraft: vi.fn(),
  publishWikiPageVersion: vi.fn(),
  mergeWikiPages: vi.fn(),
}));

const rateLimit = vi.hoisted(() => ({ enforce: vi.fn() }));

vi.mock("./repository", () => repository);
vi.mock("@/lib/auth/admin-manage-rate-limit", () => ({ enforceAdminManageRateLimit: rateLimit.enforce }));

describe("Wiki service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("allows public readers to list, open, and search published pages", async () => {
    const { createWikiService } = await import("./service");
    const service = createWikiService(repository);

    await service.listPublishedPages();
    await service.getPublishedPage("database-transactions");
    await service.searchPublishedPages("事务", 3);

    expect(repository.listPublishedWikiPages).toHaveBeenCalledOnce();
    expect(repository.findPublishedWikiPage).toHaveBeenCalledWith("database-transactions");
    expect(repository.searchPublishedWikiPages).toHaveBeenCalledWith("事务", 3);
  });

  it("allows an active admin to manage Wiki pages as their own actor", async () => {
    const { createWikiService } = await import("./service");
    const service = createWikiService(repository);
    const admin = { id: "admin-id", role: "admin", status: "active", passwordResetRequired: false } as Session;
    const meta = { ip: "127.0.0.1" };

    await service.listAdminPages(admin);
    await service.savePageDraft(admin, {
      slug: "database-transactions", title: "事务", body: "正文。",
      sourceArticleVersionIds: ["source-version"], relatedSlugs: [],
    }, meta);
    await service.publishPageVersion(admin, "page-id", "version-id", meta);
    await service.mergePages(admin, "source-topic", "target-topic", meta);

    expect(repository.listAdminWikiPages).toHaveBeenCalledOnce();
    expect(repository.saveWikiPageDraft).toHaveBeenCalledWith(expect.anything(), "admin-id");
    expect(repository.publishWikiPageVersion).toHaveBeenCalledWith("page-id", "version-id", "admin-id");
    expect(repository.mergeWikiPages).toHaveBeenCalledWith("source-topic", "target-topic", "admin-id");
    expect(rateLimit.enforce).toHaveBeenNthCalledWith(1, "wiki:database-transactions", "127.0.0.1");
    expect(rateLimit.enforce).toHaveBeenNthCalledWith(2, "wiki:page-id", "127.0.0.1");
    expect(rateLimit.enforce).toHaveBeenNthCalledWith(3, "wiki:target-topic", "127.0.0.1");
  });

  it.each([
    { role: "reader", status: "active", passwordResetRequired: false },
    { role: "admin", status: "disabled", passwordResetRequired: false },
    { role: "admin", status: "active", passwordResetRequired: true },
  ])("rejects management actions for an unavailable account", async (sessionValues) => {
    const { createWikiService } = await import("./service");
    const service = createWikiService(repository);
    const session = { id: "blocked-id", ...sessionValues } as Session;

    await expect(service.listAdminPages(session)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(service.savePageDraft(session, {
      slug: "database-transactions", title: "事务", body: "正文。",
      sourceArticleVersionIds: ["source-version"], relatedSlugs: [],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(repository.listAdminWikiPages).not.toHaveBeenCalled();
    expect(repository.saveWikiPageDraft).not.toHaveBeenCalled();
  });
});
