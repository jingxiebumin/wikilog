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
  getOwnProfile as getOwnProfileRecord,
  getOwnAvatarKey as getOwnAvatarKeyRecord,
  resetReaderPassword,
  restoreReaderAccount,
  revokeAllSessions,
  revokeSession,
  setUserStatus,
  updateEmail as updateEmailRecord,
  updateOwnProfile as updateOwnProfileRecord,
  updateOwnAvatar as updateOwnAvatarRecord,
  updateReaderProfile,
  updatePassword as updatePasswordRecord,
  listReaderAccounts,
  softDeleteReaderAccount,
  type ReaderAccountSummary,
} from "./repository";
import { AuthError } from "./errors";
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from "./password";
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

const enforceAdminManageRateLimits = async (targetUserId: string, ip: string): Promise<void> => {
  const rules = RATE_LIMIT_RULES.adminManage;
  await consumeRateLimits(getDatabase(), [
    { bucket: `adminManage:reader:${targetUserId}`, rule: rules.account },
    { bucket: `adminManage:ip:${ip}`, rule: rules.ip },
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
    const updated = await updateEmailRecord(input.userId, email);
    await revokeAllSessions(input.userId);
    return updated;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "该邮箱已被使用。");
    throw error;
  }
}

export async function changePassword(input: {
  userId: string;
  sessionId: string;
  displayName?: string;
  currentPassword: string;
  password: string;
  confirmation: string;
}): Promise<{ rotatedSession?: { token: string; expiresAt: Date } }> {
  const password = validatePassword(input.password);
  requireSamePassword(password, input.confirmation);
  const user = await findUserById(input.userId);
  if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AuthError("INVALID_CREDENTIALS", "当前密码不正确。");
  }
  const mustRotateSession = user.passwordResetRequired;
  const displayName = mustRotateSession && !user.displayName ? validateDisplayName(input.displayName ?? "") : undefined;
  await updatePasswordRecord(input.userId, await hashPassword(password), mustRotateSession, mustRotateSession ? undefined : input.sessionId, displayName);
  if (mustRotateSession) {
    return { rotatedSession: await createSessionForUser({ ...user, passwordResetRequired: false }) };
  }
  return {};
}

export async function getOwnProfile(userId: string) {
  const profile = await getOwnProfileRecord(userId);
  if (!profile) throw new AuthError("NOT_FOUND", "账号资料不存在。");
  return profile;
}

export async function updateOwnProfile(input: {
  userId: string;
  displayName: string;
  phone: string;
  gender: string;
  introduction: string;
}) {
  const displayName = validateDisplayName(input.displayName);
  const phone = input.phone.trim();
  if (phone && !(/^[1][3-9]\d{9}$/.test(phone) || /^\+[1-9]\d{6,14}$/.test(phone))) {
    throw new AuthError("INVALID_INPUT", "请输入有效的手机号。");
  }
  const gender = input.gender.trim();
  if (gender && !["male", "female", "other", "undisclosed"].includes(gender)) {
    throw new AuthError("INVALID_INPUT", "请选择有效的性别选项。");
  }
  const introduction = input.introduction.trim();
  if (Array.from(introduction).length > 500) {
    throw new AuthError("INVALID_INPUT", "个人介绍不能超过 500 个字符。");
  }
  const profile = await updateOwnProfileRecord({
    userId: input.userId,
    displayName,
    phone: phone || null,
    gender: gender ? gender as "male" | "female" | "other" | "undisclosed" : null,
    introduction: introduction || null,
  });
  if (!profile) throw new AuthError("NOT_FOUND", "账号资料不存在。");
  return profile;
}

export async function getOwnAvatarKey(userId: string): Promise<string> {
  const key = await getOwnAvatarKeyRecord(userId);
  if (!key) throw new AuthError("NOT_FOUND", "头像不存在。");
  return key;
}

export async function updateOwnAvatar(userId: string, avatarKey: string): Promise<string> {
  const key = await updateOwnAvatarRecord(userId, avatarKey);
  if (!key) throw new AuthError("NOT_FOUND", "账号资料不存在。");
  return key;
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
  email: string;
  meta?: RequestMeta;
}): Promise<AuthUser> {
  if (input.operator.role !== "admin" || input.operator.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
  const email = validateEmail(input.email);
  await enforceAdminManageRateLimits(email, input.meta?.ip ?? "unknown");
  try {
    return await createReaderByAdmin({
      email,
      displayName: "",
      passwordHash: await hashPassword("123456"),
      forcePasswordChange: true,
      operatorUserId: input.operator.id,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "该邮箱已被使用。");
    throw error;
  }
}

export async function adminListReaders(operator: Session, input: { includeDeleted?: boolean; search?: string } = {}): Promise<ReaderAccountSummary[]> {
  if (operator.role !== "admin" || operator.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
  return listReaderAccounts(input);
}

export async function adminDisableReader(input: { operator: Session; targetUserId: string; meta?: RequestMeta }): Promise<void> {
  if (input.operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  await enforceAdminManageRateLimits(input.targetUserId, input.meta?.ip ?? "unknown");
  const changed = await setUserStatus(input.targetUserId, "disabled", input.operator.id, "管理员禁用读者账号");
  if (!changed) throw new AuthError("NOT_FOUND", "读者账号不存在或已不可用。");
}

export async function adminSetReaderStatus(input: {
  operator: Session;
  targetUserId: string;
  status: "active" | "disabled";
  reason: string;
  meta?: RequestMeta;
}): Promise<void> {
  if (input.operator.role !== "admin") throw new AuthError("FORBIDDEN", "没有访问权限。");
  const reason = requireNonBlank(input.reason, "操作原因");
  await enforceAdminManageRateLimits(input.targetUserId, input.meta?.ip ?? "unknown");
  const changed = await setUserStatus(input.targetUserId, input.status, input.operator.id, reason);
  if (!changed) throw new AuthError("NOT_FOUND", "读者账号不存在或已不可用。");
}

export async function adminEditReader(input: {
  operator: Session;
  targetUserId: string;
  email: string;
  displayName: string;
  phone?: string;
  gender?: string;
  reason?: string;
  meta?: RequestMeta;
}): Promise<ReaderAccountSummary> {
  if (input.operator.role !== "admin" || input.operator.status !== "active") {
    throw new AuthError("FORBIDDEN", "没有访问权限。");
  }
  const email = validateEmail(input.email);
  const displayName = validateDisplayName(input.displayName);
  const phone = input.phone?.trim() ?? "";
  if (phone && !(/^[1][3-9]\d{9}$/.test(phone) || /^\+[1-9]\d{6,14}$/.test(phone))) {
    throw new AuthError("INVALID_INPUT", "请输入有效的手机号。");
  }
  const gender = input.gender?.trim() ?? "";
  if (gender && !["male", "female", "other", "undisclosed"].includes(gender)) {
    throw new AuthError("INVALID_INPUT", "请选择有效的性别选项。");
  }
  await enforceAdminManageRateLimits(input.targetUserId, input.meta?.ip ?? "unknown");
  try {
    const reader = await updateReaderProfile({
      targetUserId: input.targetUserId,
      operatorUserId: input.operator.id,
      email,
      displayName,
      phone: phone || null,
      gender: gender ? gender as "male" | "female" | "other" | "undisclosed" : null,
    });
    if (!reader) throw new AuthError("NOT_FOUND", "读者账号不存在。");
    return reader;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "该邮箱已被使用。");
    throw error;
  }
}

export async function adminResetReader(input: {
  operator: Session;
  targetUserId: string;
  meta?: RequestMeta;
}): Promise<void> {
  if (input.operator.role !== "admin" || input.operator.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
  await enforceAdminManageRateLimits(input.targetUserId, input.meta?.ip ?? "unknown");
  try {
    await resetReaderPassword({
      operatorUserId: input.operator.id,
      targetUserId: input.targetUserId,
      passwordHash: await hashPassword("123456"),
    });
  } catch {
    throw new AuthError("NOT_FOUND", "无法完成密码重置。");
  }
}

export async function adminSoftDeleteReader(input: {
  operator: Session;
  targetUserId: string;
  reason: string;
  meta?: RequestMeta;
}): Promise<void> {
  if (input.operator.role !== "admin" || input.operator.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
  const reason = input.reason.trim();
  if (reason.length > 500) throw new AuthError("INVALID_INPUT", "删除原因不能超过 500 个字符。");
  await enforceAdminManageRateLimits(input.targetUserId, input.meta?.ip ?? "unknown");
  const deleted = await softDeleteReaderAccount(input.targetUserId, input.operator.id, reason || null);
  if (!deleted) throw new AuthError("NOT_FOUND", "读者账号不存在或已删除。");
}

export async function adminRestoreReader(input: {
  operator: Session;
  targetUserId: string;
  meta?: RequestMeta;
}): Promise<void> {
  if (input.operator.role !== "admin" || input.operator.status !== "active") throw new AuthError("FORBIDDEN", "没有访问权限。");
  await enforceAdminManageRateLimits(input.targetUserId, input.meta?.ip ?? "unknown");
  try {
    const restored = await restoreReaderAccount(input.targetUserId, input.operator.id);
    if (!restored) throw new AuthError("NOT_FOUND", "已删除读者账号不存在。");
  } catch (error) {
    if (isUniqueViolation(error)) throw new AuthError("CONFLICT", "该邮箱已被其他有效账号使用，无法恢复。");
    throw error;
  }
}
