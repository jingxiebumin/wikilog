import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { consumeRateLimit } from "./rate-limit";

describe("database rate limits", () => {
  let database: PGlite;

  beforeEach(async () => {
    database = new PGlite();
    await database.exec("CREATE TABLE auth_rate_limits (bucket text PRIMARY KEY, attempts integer NOT NULL, window_started_at timestamptz NOT NULL, blocked_until timestamptz)");
  });

  afterEach(async () => database.close());

  it("atomically blocks a bucket after the configured attempts", async () => {
    const rule = { maxAttempts: 2, windowSeconds: 900 };
    await consumeRateLimit(database, "login:ip:test", rule);
    await consumeRateLimit(database, "login:ip:test", rule);
    await expect(consumeRateLimit(database, "login:ip:test", rule)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
