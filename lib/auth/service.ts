import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { hasDatabase, pool } from "@/lib/db";
import {
  createReaderAccount,
  createReaderByAdmin,
  createSession,
  deleteAccount as deleteAccountRecord,
  findSessionByTokenHash,
  findUserByEmail,
  findUserById,
  resetReaderPassword,
  revokeAllSessions,
  revokeSession,
  setUserStatus,
  updateEmail as updateEmailRecord,
  updatePassword as updatePasswordRecord,
  listReaderAccounts,
  type ReaderAccountSummary,
} from "./repository";
import { AuthError } from "./errors";
import { DUMMY_PASSWORD_HASH, generateTemporaryPassword, hashPassword, verifyPassword } from "./password";
import { consumeRateLimits, RATE_LIMIT_RULES } from "./rate-limit";
import type { AuthUser, RequestMeta, Session } from "./types";
import {
  normalizeEmail,
  requireNonBlank,
  requireSamePassword,
  validateDisplayName,
  validateEmail,
  validatePassword,
} from "./validation";

export const SESSION_COOKIE = "wikilog_reader_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
export const publicAuthEnabled = hasDatabase && process.env.AUTH_ENABLED === "true";

const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

const getDatabase = () => {
  if (!pool) throw new AuthError("DATABASE_UNAVAILABLE", "账号功能暂未启用。");
  return pool;
};

const requirePublicAuthEnabled = (): void => {
  if (!publicAuthEnabled) throw new AuthError("DATABASE_UNAVAILABLE", "账号功能暂未启用。");
};

const enforceRateLimits = async (
  action: "register" | "login" | "adminReset",
  email: string,
  ip: string,
): Promise<void> => {
  const database = getDatabase();
  const rules = RATE_LIMIT_RULES[action];
  await consumeRateLimits(database, [
    { bucket: `${action}:account:${normalizeEmail(email)}`, rule: rules.account },
    { bucket: `${action}:ip:${ip}`, rule: rules.ip },
  ]);
};

const enforceIpRateLimit = async (action: "register" | "login", ip: string): Promise<void> => {
  await consumeRateLimits(getDatabase(), [{ bucket: `${action}:ip:${ip}`, rule: RATE_LIMIT_RULES[action].ip }]);
};

const enforceAccountRateLimit = async (action: "register" | "login", email: string): Promise<void> => {
  await consumeRateLimits(getDatabase(), [{ bucket: `${action}:account:${normalizeEmail(email)}`, rule: RATE_LIMIT_RULES[action].account }]);
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";

const createSessionForUser = async (user: AuthUser): Promise<{ token: string; sessionId: string; expiresAt: Date }> => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const sessionId = await createSession(user.id, hashToken(token), expiresAt);
  return { token, sessionId, expiresAt };
};

export async function registerReader(input: {
  displayName: string;
  email: string;
  password: string;
  confirmation: string;
  meta?: RequestMeta;
}): Promise<{ user: AuthUser; token: string; expiresAt: Date }> {
  requirePublicAuthEnabled();
  await enforceIpRateLimit("register", input.meta?.ip ?? "unknown");
  const email = validateEmail(input.email);
  const displayName = validateDisplayName(input.displayName);
  const password = validatePassword(input.password);
  requireSamePassword(password, input.confirmation);
  await enforceAccountRateLimit("register", email);
  let user: AuthUser;
  try {
    user = await createReaderAccount({ email, displayName, passwordHash: await hashPassword(password) });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "注册无法完成，请检查输入后重试。");
    throw error;
  }
  return { user, ...(await createSessionForUser(user)) };
}

export async function login(input: {
  email: string;
  password: string;
  meta?: RequestMeta;
}): Promise<{ user: AuthUser; token: string; expiresAt: Date }> {
  requirePublicAuthEnabled();
  await enforceIpRateLimit("login", input.meta?.ip ?? "unknown");
  const email = validateEmail(input.email);
  if (!input.password) throw new AuthError("INVALID_INPUT", "请输入密码。");
  await enforceAccountRateLimit("login", email);
  const user = await findUserByEmail(email);
  const passwordMatches = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches || user.status !== "active") {
    throw new AuthError("INVALID_CREDENTIALS", "邮箱或密码不正确。");
  }
  return { user, ...(await createSessionForUser(user)) };
}

export async function getCurrentSession(): Promise<Session | undefined> {
  if (!publicAuthEnabled || !pool) return undefined;
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return undefined;
  return findSessionByTokenHash(hashToken(token));
}

export async function requireSession(options?: { admin?: boolean; allowPasswordReset?: boolean }): Promise<Session> {
  const session = await getCurrentSession();
  if (!session) throw new AuthError("UNAUTHENTICATED", "请先登录。");
  if (options?.admin && session.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  if (!options?.allowPasswordReset && session.passwordResetRequired) {
    throw new AuthError("FORBIDDEN", "首次登录必须先修改临时密码。");
  }
  return session;
}

export async function logoutCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || !publicAuthEnabled || !pool) return;
  const session = await findSessionByTokenHash(hashToken(token));
  if (session) await revokeSession(session.sessionId);
}

export async function changeEmail(input: {
  userId: string;
  currentPassword: string;
  email: string;
}): Promise<AuthUser> {
  const email = validateEmail(input.email);
  const user = await findUserById(input.userId);
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthError("INVALID_CREDENTIALS", "当前密码不正确。");
  }
  try {
    return await updateEmailRecord(input.userId, email);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "该邮箱已被使用。");
    throw error;
  }
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  password: string;
  confirmation: string;
}): Promise<void> {
  const password = validatePassword(input.password);
  requireSamePassword(password, input.confirmation);
  const user = await findUserById(input.userId);
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthError("INVALID_CREDENTIALS", "当前密码不正确。");
  }
  await updatePasswordRecord(input.userId, await hashPassword(password), true);
  await revokeAllSessions(input.userId);
}

export async function deleteAccount(input: {
  userId: string;
  role: "reader" | "admin";
  currentPassword: string;
  confirmation: string;
}): Promise<void> {
  if (input.role !== "reader") throw new AuthError("FORBIDDEN", "管理员账号需要通过人工维护流程管理。");
  if (input.confirmation !== "DELETE") throw new AuthError("CONFIRMATION_REQUIRED", "请输入 DELETE 确认删除账号。");
  const user = await findUserById(input.userId);
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthError("INVALID_CREDENTIALS", "当前密码不正确。");
  }
  await deleteAccountRecord(input.userId);
}

export async function adminCreateReader(input: {
  operator: Session;
  displayName: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  if (input.operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  const email = validateEmail(input.email);
  const displayName = validateDisplayName(input.displayName);
  const password = validatePassword(input.password);
  try {
    return await createReaderByAdmin({ email, displayName, passwordHash: await hashPassword(password), forcePasswordChange: true });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "该邮箱已被使用。");
    throw error;
  }
}

export async function adminListReaders(operator: Session): Promise<ReaderAccountSummary[]> {
  if (operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  return listReaderAccounts();
}

export async function adminDisableReader(input: { operator: Session; targetUserId: string }): Promise<void> {
  if (input.operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  const changed = await setUserStatus(input.targetUserId, "disabled", input.operator.id, "管理员禁用读者账号");
  if (!changed) throw new AuthError("NOT_FOUND", "读者账号不存在或已不可用。");
}

export async function adminSetReaderStatus(input: {
  operator: Session;
  targetUserId: string;
  status: "active" | "disabled";
  reason: string;
}): Promise<void> {
  if (input.operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  const reason = requireNonBlank(input.reason, "操作原因");
  const changed = await setUserStatus(input.targetUserId, input.status, input.operator.id, reason);
  if (!changed) throw new AuthError("NOT_FOUND", "读者账号不存在或已不可用。");
}

export async function adminResetReader(input: {
  operator: Session;
  targetUserId: string;
  reason: string;
  identityConfirmed: boolean;
  meta?: RequestMeta;
}): Promise<{ temporaryPassword: string }> {
  if (input.operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  if (!input.identityConfirmed) throw new AuthError("CONFIRMATION_REQUIRED", "管理员必须先完成线下身份确认。");
  const reason = requireNonBlank(input.reason, "重置原因");
  const target = await findUserById(input.targetUserId);
  const emailForLimit = target?.email ?? input.targetUserId;
  await enforceRateLimits("adminReset", emailForLimit, input.meta?.ip ?? "unknown");
  const temporaryPassword = generateTemporaryPassword();
  try {
    await resetReaderPassword({
      operatorUserId: input.operator.id,
      targetUserId: input.targetUserId,
      passwordHash: await hashPassword(temporaryPassword),
      reason,
    });
  } catch {
    try {
      await import("./repository").then(({ recordFailedAdminReset }) => recordFailedAdminReset({
        operatorUserId: input.operator.id,
        targetUserId: input.targetUserId,
        reason,
      }));
    } catch {
      // Preserve the original failure; never expose or persist the temporary password.
    }
    throw new AuthError("NOT_FOUND", "无法完成密码重置。");
  }
  return { temporaryPassword };
}
