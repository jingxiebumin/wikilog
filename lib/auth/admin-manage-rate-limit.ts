import "server-only";
import { AuthError } from "./errors";
import { consumeRateLimits, RATE_LIMIT_RULES } from "./rate-limit";
import { pool } from "@/lib/db";

export async function enforceAdminManageRateLimit(subject: string, ip: string): Promise<void> {
  if (!pool) throw new AuthError("DATABASE_UNAVAILABLE", "管理功能暂未启用。");
  const rules = RATE_LIMIT_RULES.adminManage;
  await consumeRateLimits(pool, [
    { bucket: `adminManage:${subject}`, rule: rules.account },
    { bucket: `adminManage:ip:${ip}`, rule: rules.ip },
  ]);
}
