import "server-only";
import { AuthError } from "./errors";

export type RateLimitRule = { maxAttempts: number; windowSeconds: number };

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
};

export const RATE_LIMIT_RULES = {
  register: {
    account: { maxAttempts: numberFromEnv("AUTH_REGISTER_ACCOUNT_LIMIT", 3), windowSeconds: 900 },
    ip: { maxAttempts: numberFromEnv("AUTH_REGISTER_IP_LIMIT", 8), windowSeconds: 900 },
  },
  login: {
    account: { maxAttempts: numberFromEnv("AUTH_LOGIN_ACCOUNT_LIMIT", 8), windowSeconds: 900 },
    ip: { maxAttempts: numberFromEnv("AUTH_LOGIN_IP_LIMIT", 20), windowSeconds: 900 },
  },
  adminReset: {
    account: { maxAttempts: numberFromEnv("AUTH_ADMIN_RESET_ACCOUNT_LIMIT", 5), windowSeconds: 900 },
    ip: { maxAttempts: numberFromEnv("AUTH_ADMIN_RESET_IP_LIMIT", 10), windowSeconds: 900 },
  },
  adminManage: {
    account: { maxAttempts: numberFromEnv("AUTH_ADMIN_MANAGE_ACCOUNT_LIMIT", 10), windowSeconds: 900 },
    ip: { maxAttempts: numberFromEnv("AUTH_ADMIN_MANAGE_IP_LIMIT", 30), windowSeconds: 900 },
  },
} as const;

export type RateLimitDatabase = {
  query: <T = unknown>(text: string, values?: unknown[]) => Promise<{ rows: T[] }>;
};

export async function consumeRateLimit(
  database: RateLimitDatabase,
  bucket: string,
  rule: RateLimitRule,
): Promise<void> {
  const result = await database.query<{ attempts: number; blocked_until: Date | null }>(`
    INSERT INTO auth_rate_limits (bucket, attempts, window_started_at, blocked_until)
    VALUES ($1, 1, now(), NULL)
    ON CONFLICT (bucket) DO UPDATE SET
      attempts = CASE
        WHEN auth_rate_limits.blocked_until IS NOT NULL AND auth_rate_limits.blocked_until > now()
          THEN auth_rate_limits.attempts + 1
        WHEN now() - auth_rate_limits.window_started_at >= make_interval(secs => $2::double precision)
          THEN 1
        ELSE auth_rate_limits.attempts + 1
      END,
      window_started_at = CASE
        WHEN now() - auth_rate_limits.window_started_at >= make_interval(secs => $2::double precision)
          THEN now()
        ELSE auth_rate_limits.window_started_at
      END,
      blocked_until = CASE
        WHEN auth_rate_limits.blocked_until IS NOT NULL AND auth_rate_limits.blocked_until > now()
          THEN auth_rate_limits.blocked_until
        WHEN now() - auth_rate_limits.window_started_at >= make_interval(secs => $2::double precision)
          THEN NULL
        WHEN auth_rate_limits.attempts + 1 > $3
          THEN now() + make_interval(secs => $2::double precision)
        ELSE NULL
      END
    RETURNING attempts, blocked_until
  `, [bucket, rule.windowSeconds, rule.maxAttempts]);

  const row = result.rows[0];
  if (row?.blocked_until && row.blocked_until.getTime() > Date.now()) {
    const retryAfter = Math.max(1, Math.ceil((row.blocked_until.getTime() - Date.now()) / 1000));
    throw new AuthError("RATE_LIMITED", "请求过于频繁，请稍后重试。", retryAfter);
  }
}

export async function consumeRateLimits(
  database: RateLimitDatabase,
  entries: Array<{ bucket: string; rule: RateLimitRule }>,
): Promise<void> {
  for (const entry of entries) await consumeRateLimit(database, entry.bucket, entry.rule);
}
