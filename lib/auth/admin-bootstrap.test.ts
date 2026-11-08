import { beforeEach, describe, expect, it, vi } from "vitest";

const pgMocks = vi.hoisted(() => ({
  connect: vi.fn(),
  end: vi.fn(),
  Pool: vi.fn(),
  query: vi.fn(),
}));

vi.mock("pg", () => ({
  Pool: pgMocks.Pool,
}));

describe("admin bootstrap", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://example.test/wikilog");
    pgMocks.Pool.mockImplementation(function (this: { connect: typeof pgMocks.connect; end: typeof pgMocks.end }) {
      this.connect = pgMocks.connect;
      this.end = pgMocks.end;
    });
    pgMocks.connect.mockResolvedValue({
      query: pgMocks.query,
      release: vi.fn(),
    });
    pgMocks.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{
        id: "00000000-0000-4000-8000-000000000001",
        email: "admin@example.test",
        display_name: "管理员",
        role: "admin",
        status: "active",
        password_reset_required: false,
      }] });
  });

  it("initializes through the CLI-only module without loading Next server guards", async () => {
    const { initializeAdminAccount } = await import("./admin-bootstrap");
    const administrator = await initializeAdminAccount({
      email: " Admin@Example.Test ",
      displayName: "管理员",
      password: "long-enough-password",
    });

    expect(administrator).toMatchObject({
      email: "admin@example.test",
      role: "admin",
      status: "active",
    });
    expect(pgMocks.Pool).toHaveBeenCalledWith(expect.objectContaining({
      connectionString: "postgresql://example.test/wikilog",
      application_name: "wikilog-admin-bootstrap",
    }));
    expect(pgMocks.query).toHaveBeenNthCalledWith(4,
      expect.stringContaining("INSERT INTO users"),
      ["admin@example.test", "管理员", expect.stringMatching(/^scrypt\$/)],
    );
    expect(pgMocks.end).toHaveBeenCalledOnce();
  });
});
