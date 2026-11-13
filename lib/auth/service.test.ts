import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./types";

const databaseMocks = vi.hoisted(() => ({
  clientQuery: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  hasDatabase: true,
  pool: {
    query: databaseMocks.query,
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

  it("rejects reader attempts to change account status", async () => {
    const auth = await import("./service");
    const operator = { role: "reader", status: "active" } as Session;
    await expect(auth.adminSetReaderStatus({
      operator,
      targetUserId: "00000000-0000-4000-8000-000000000001",
      status: "active",
      reason: "人工复核",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rate limits admin reader status changes by target reader and IP", async () => {
    databaseMocks.query
      .mockResolvedValueOnce({ rows: [{ attempts: 1, blocked_until: null }] })
      .mockResolvedValueOnce({ rows: [{ attempts: 31, blocked_until: new Date(Date.now() + 60_000) }] });
    const auth = await import("./service");

    await expect(auth.adminSetReaderStatus({
      operator: { role: "admin", status: "active", id: "admin-id" } as Session,
      targetUserId: "reader-id",
      status: "disabled",
      reason: "滥用处理",
      meta: { ip: "203.0.113.5" },
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });

    expect(databaseMocks.query).toHaveBeenCalledTimes(2);
    expect(databaseMocks.query.mock.calls[0][1][0]).toBe("adminManage:reader:reader-id");
    expect(databaseMocks.query.mock.calls[1][1][0]).toBe("adminManage:ip:203.0.113.5");
    expect(databaseMocks.connect).not.toHaveBeenCalled();
  });

  it("rate limits admin reader profile edits by target reader and IP", async () => {
    databaseMocks.query
      .mockResolvedValueOnce({ rows: [{ attempts: 1, blocked_until: null }] })
      .mockResolvedValueOnce({ rows: [{ attempts: 31, blocked_until: new Date(Date.now() + 60_000) }] });
    const auth = await import("./service");

    await expect(auth.adminEditReader({
      operator: { role: "admin", status: "active", id: "admin-id" } as Session,
      targetUserId: "reader-id",
      email: "reader@example.test",
      displayName: "Reader",
      reason: "资料修正",
      meta: { ip: "203.0.113.5" },
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });

    expect(databaseMocks.query).toHaveBeenCalledTimes(2);
    expect(databaseMocks.query.mock.calls[0][1][0]).toBe("adminManage:reader:reader-id");
    expect(databaseMocks.query.mock.calls[1][1][0]).toBe("adminManage:ip:203.0.113.5");
    expect(databaseMocks.connect).not.toHaveBeenCalled();
  });

  it("rejects reader attempts to edit another reader's profile", async () => {
    const auth = await import("./service");
    const operator = { role: "reader", status: "active" } as Session;
    await expect(auth.adminEditReader({
      operator,
      targetUserId: "00000000-0000-4000-8000-000000000001",
      email: "target@example.test",
      displayName: "Target",
      reason: "资料修正",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rate limits the legacy admin disable endpoint through the same account buckets", async () => {
    databaseMocks.query.mockResolvedValue({ rows: [{ attempts: 11, blocked_until: new Date(Date.now() + 60_000) }] });
    const auth = await import("./service");

    await expect(auth.adminDisableReader({
      operator: { role: "admin", status: "active", id: "admin-id" } as Session,
      targetUserId: "reader-id",
      meta: { ip: "203.0.113.5" },
    })).rejects.toMatchObject({ code: "RATE_LIMITED" });
    expect(databaseMocks.connect).not.toHaveBeenCalled();
  });
});
