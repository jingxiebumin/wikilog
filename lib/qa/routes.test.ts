import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: undefined as "admin" | "reader" | undefined }));

vi.mock("@/lib/auth/service", async () => {
  const { AuthError } = await import("@/lib/auth/errors");
  return {
    SESSION_COOKIE: "wikilog_session",
    requireSession: async () => {
      if (!state.role) throw new AuthError("UNAUTHENTICATED", "请先登录。");
      if (state.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
      return {
        id: "admin-id",
        email: "admin@example.test",
        displayName: "Admin",
        role: "admin",
        status: "active",
        passwordResetRequired: false,
        sessionId: "session-id",
        expiresAt: new Date("2026-11-15T12:00:00Z"),
      };
    },
  };
});

describe("admin Q&A API access", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    state.role = undefined;
  });

  it("hides sessions from anonymous and reader identities", async () => {
    vi.stubEnv("ADMIN_QA_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "false");
    vi.stubEnv("DEEPSEEK_API_KEY", "secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    const route = await import("@/app/api/admin/qa/sessions/route");

    state.role = undefined;
    expect((await route.GET()).status).toBe(404);
    state.role = "reader";
    expect((await route.GET()).status).toBe(404);
  });

  it("keeps sessions closed for admins until the data-policy gate is verified", async () => {
    vi.stubEnv("ADMIN_QA_ENABLED", "true");
    vi.stubEnv("DEEPSEEK_DATA_POLICY_VERIFIED", "false");
    vi.stubEnv("DEEPSEEK_API_KEY", "secret");
    vi.stubEnv("DEEPSEEK_TEXT_MODELS", "deepseek-chat");
    state.role = "admin";
    const route = await import("@/app/api/admin/qa/sessions/route");

    const response = await route.GET();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: "问答功能尚未开放。" });
  });
});
