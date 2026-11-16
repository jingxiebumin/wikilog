import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/errors";

const stubs = vi.hoisted(() => ({
  requireSession: vi.fn(),
  enqueueInitialWikiGeneration: vi.fn(),
  isWikiGenerationEnabled: vi.fn(),
  processWikiGenerationJobs: vi.fn(),
  after: vi.fn(),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: stubs.after };
});
vi.mock("@/lib/auth/service", () => ({ requireSession: stubs.requireSession }));
vi.mock("@/lib/wiki/generation-index", () => ({
  enqueueInitialWikiGeneration: stubs.enqueueInitialWikiGeneration,
  isWikiGenerationEnabled: stubs.isWikiGenerationEnabled,
  processWikiGenerationJobs: stubs.processWikiGenerationJobs,
}));

import { POST } from "@/app/api/admin/wiki/generate/route";

describe("admin Wiki generation trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubs.requireSession.mockResolvedValue({ id: "admin-id", role: "admin", status: "active" });
    stubs.enqueueInitialWikiGeneration.mockResolvedValue(true);
    stubs.isWikiGenerationEnabled.mockReturnValue(false);
  });

  it("keeps the provider and queue untouched while policy-gated generation is disabled", async () => {
    const response = await POST();

    expect(response.status).toBe(503);
    expect(stubs.enqueueInitialWikiGeneration).not.toHaveBeenCalled();
    expect(stubs.after).not.toHaveBeenCalled();
  });

  it("queues the full initial run and schedules processing after the response", async () => {
    stubs.isWikiGenerationEnabled.mockReturnValue(true);
    const response = await POST();

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ queued: true });
    expect(stubs.enqueueInitialWikiGeneration).toHaveBeenCalledWith("admin-id");
    expect(stubs.after).toHaveBeenCalledOnce();
  });

  it("uses the standard admin 404 boundary for readers", async () => {
    stubs.requireSession.mockRejectedValue(new AuthError("FORBIDDEN", "没有访问权限。"));
    const response = await POST();

    expect(response.status).toBe(404);
    expect(stubs.enqueueInitialWikiGeneration).not.toHaveBeenCalled();
  });
});
