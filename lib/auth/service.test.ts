import { beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  connect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  hasDatabase: true,
  pool: {
    query: vi.fn(),
    connect: databaseMocks.connect,
  },
}));

describe("account launch gates", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("AUTH_ENABLED", "false");
    databaseMocks.connect.mockResolvedValue({
      query: databaseMocks.clientQuery,
      release: vi.fn(),
    });
  });

  it("keeps public registration and login closed until authentication is enabled", async () => {
    const auth = await import("./service");
    await expect(auth.registerReader({
      displayName: "Reader",
      email: "reader@example.test",
      password: "long-enough-password",
      confirmation: "long-enough-password",
    })).rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });
    await expect(auth.login({ email: "admin@example.test", password: "long-enough-password" }))
      .rejects.toMatchObject({ code: "DATABASE_UNAVAILABLE" });

  });
});
