import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  role: undefined as "admin" | "reader" | undefined,
  pages: [] as unknown[],
  history: [] as unknown[],
  savedDraft: undefined as unknown,
  published: undefined as unknown,
  merged: undefined as unknown,
  metadata: undefined as unknown,
}));

vi.mock("@/lib/auth/service", async () => {
  const { AuthError } = await import("@/lib/auth/errors");
  return {
    requireSession: async () => {
      if (!state.role) throw new AuthError("UNAUTHENTICATED", "请先登录。");
      if (state.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
      return {
        id: "admin-id", email: "admin@example.test", displayName: "Admin", role: "admin",
        status: "active", passwordResetRequired: false, sessionId: "session-id",
        expiresAt: new Date("2026-11-15T12:00:00Z"),
      };
    },
  };
});

vi.mock("@/lib/wiki/service", () => ({
  listAdminWikiPages: vi.fn(async () => state.pages),
  getAdminWikiPageHistory: vi.fn(async () => state.history),
  saveAdminWikiPageDraft: vi.fn(async (_session, input, meta) => { state.savedDraft = input; state.metadata = meta; return { pageId: "page-id", versionId: "draft-id" }; }),
  publishAdminWikiPageVersion: vi.fn(async (_session, pageId, versionId, meta) => { state.published = { pageId, versionId }; state.metadata = meta; }),
  mergeAdminWikiPages: vi.fn(async (_session, sourceSlug, targetSlug, meta) => { state.merged = { sourceSlug, targetSlug }; state.metadata = meta; return { pageId: "target-id", versionId: "merge-draft-id" }; }),
}));

describe("admin Wiki routes", () => {
  beforeEach(() => {
    vi.resetModules();
    state.role = "admin";
    state.pages = [{ id: "page-id", slug: "transactions", versions: [] }];
    state.history = [{ id: "draft-id", status: "draft", title: "事务" }];
    state.savedDraft = undefined;
    state.published = undefined;
    state.merged = undefined;
    state.metadata = undefined;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("hides Wiki management from anonymous users and readers", async () => {
    const route = await import("@/app/api/admin/wiki/route");
    state.role = undefined;
    expect((await route.GET()).status).toBe(404);
    state.role = "reader";
    expect((await route.GET()).status).toBe(404);
    expect((await route.POST(jsonRequest({ slug: "transactions", title: "事务", body: "正文" }))).status).toBe(404);
  });

  it("lets an admin list pages and create a reviewable draft", async () => {
    const route = await import("@/app/api/admin/wiki/route");
    const list = await route.GET();
    expect(list.status).toBe(200);
    await expect(list.json()).resolves.toMatchObject({ pages: [{ slug: "transactions" }] });

    const create = await route.POST(jsonRequest({
      slug: "database-transactions", title: "数据库事务", body: "事务保证一组变更的原子性。",
      sourceArticleVersionIds: ["article-version-id"], relatedSlugs: [],
    }, { "x-forwarded-for": "203.0.113.8" }));
    expect(create.status).toBe(201);
    await expect(create.json()).resolves.toMatchObject({ draft: { pageId: "page-id", versionId: "draft-id" } });
    expect(state.savedDraft).toMatchObject({ slug: "database-transactions", sourceArticleVersionIds: ["article-version-id"] });
    expect(state.metadata).toEqual({ ip: "203.0.113.8" });
  });

  it("rejects incomplete draft input before calling the service", async () => {
    const route = await import("@/app/api/admin/wiki/route");
    const response = await route.POST(jsonRequest({ slug: "database-transactions", title: "", body: "正文" }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
    expect(state.savedDraft).toBeUndefined();
  });

  it("publishes a selected version and creates a merge draft without redirecting immediately", async () => {
    const publishRoute = await import("@/app/api/admin/wiki/pages/[pageId]/versions/[versionId]/publish/route");
    const published = await publishRoute.POST(new Request("http://localhost/api/admin/wiki/pages/page-id/versions/draft-id/publish", { method: "POST", headers: { "x-real-ip": "203.0.113.9" } }), {
      params: Promise.resolve({ pageId: "page-id", versionId: "draft-id" }),
    });
    expect(published.status).toBe(200);
    expect(state.published).toEqual({ pageId: "page-id", versionId: "draft-id" });
    expect(state.metadata).toEqual({ ip: "203.0.113.9" });

    const mergeRoute = await import("@/app/api/admin/wiki/merge/route");
    const merged = await mergeRoute.POST(jsonRequest({ sourceSlug: "old-topic", targetSlug: "new-topic" }, { "x-forwarded-for": "203.0.113.10" }));
    expect(merged.status).toBe(201);
    await expect(merged.json()).resolves.toMatchObject({ draft: { versionId: "merge-draft-id" } });
    expect(state.merged).toEqual({ sourceSlug: "old-topic", targetSlug: "new-topic" });
    expect(state.metadata).toEqual({ ip: "203.0.113.10" });
  });
});

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/admin/wiki", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
