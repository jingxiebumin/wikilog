import "server-only";
import type { Pool, PoolClient, QueryResultRow } from "pg";
import { pool } from "@/lib/db";
import type { AuthUser, Session, UserRole, UserStatus } from "./types";

type Database = Pick<Pool, "query" | "connect">;

type UserRow = QueryResultRow & {
  id: string;
  email: string;
  display_name: string;
  password_hash: string | null;
  role: UserRole;
  status: UserStatus;
  password_reset_required: boolean;
};

const getDatabase = (): Database => {
  if (!pool) throw new Error("Database repository used without DATABASE_URL.");
  return pool;
};

const mapUser = (row: UserRow): AuthUser => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name,
  role: row.role,
  status: row.status,
  passwordResetRequired: row.password_reset_required,
});

export type UserWithPassword = AuthUser & { passwordHash: string | null };

export type ReaderAccountSummary = Pick<AuthUser, "id" | "email" | "displayName" | "status" | "passwordResetRequired">;

const mapUserWithPassword = (row: UserRow): UserWithPassword => ({
  ...mapUser(row),
  passwordHash: row.password_hash,
});

const userSelect = `
  SELECT id, email, display_name, password_hash, role, status, password_reset_required
  FROM users
`;

export async function findUserByEmail(email: string): Promise<UserWithPassword | undefined> {
  const result = await getDatabase().query<UserRow>(`${userSelect} WHERE lower(email) = lower($1) AND del_flag = false`, [email]);
  return result.rows[0] ? mapUserWithPassword(result.rows[0]) : undefined;
}

export async function findUserById(id: string): Promise<UserWithPassword | undefined> {
  const result = await getDatabase().query<UserRow>(`${userSelect} WHERE id = $1 AND del_flag = false`, [id]);
  return result.rows[0] ? mapUserWithPassword(result.rows[0]) : undefined;
}

export async function listReaderAccounts(): Promise<ReaderAccountSummary[]> {
  const result = await getDatabase().query<UserRow>(`
    ${userSelect}
    WHERE role = 'reader'
    ORDER BY created_at DESC
  `);
  return result.rows.map(mapUser);
}

export async function createReaderAccount(input: {
  email: string;
  displayName: string;
  passwordHash: string;
}): Promise<AuthUser> {
  const result = await getDatabase().query<UserRow>(`
    INSERT INTO users (email, display_name, password_hash, role, status, password_reset_required)
    VALUES ($1, $2, $3, 'reader', 'active', false)
    RETURNING id, email, display_name, password_hash, role, status, password_reset_required
  `, [input.email, input.displayName, input.passwordHash]);
  return mapUser(result.rows[0]);
}

export async function updateEmail(userId: string, email: string): Promise<AuthUser> {
  const result = await getDatabase().query<UserRow>(`
    UPDATE users
    SET email = $2, updated_at = now(), updated_by = $1
    WHERE id = $1 AND status = 'active' AND del_flag = false
    RETURNING id, email, display_name, password_hash, role, status, password_reset_required
  `, [userId, email]);
  return mapUser(result.rows[0]);
}

export async function updatePassword(
  userId: string,
  passwordHash: string,
  clearResetRequirement: boolean,
): Promise<void> {
  const database = getDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      UPDATE users
      SET password_hash = $2,
          password_reset_required = CASE WHEN $3 THEN false ELSE password_reset_required END,
          updated_at = now(), updated_by = $1
      WHERE id = $1 AND status = 'active' AND del_flag = false
    `, [userId, passwordHash, clearResetRequirement]);
    if (clearResetRequirement) {
      await client.query(`
        UPDATE admin_password_resets
        SET used_at = COALESCE(used_at, now())
        WHERE target_user_id = $1 AND used_at IS NULL AND result = 'success'
      `, [userId]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<string> {
  const result = await getDatabase().query<{ id: string }>(`
    INSERT INTO reader_sessions (user_id, token_hash, expires_at)
    VALUES ($1, $2, $3)
    RETURNING id
  `, [userId, tokenHash, expiresAt]);
  return result.rows[0].id;
}

export async function findSessionByTokenHash(tokenHash: string): Promise<Session | undefined> {
  const result = await getDatabase().query<UserRow & { session_id: string; expires_at: Date }>(`
    SELECT s.id AS session_id, s.expires_at,
      u.id, u.email, u.display_name, u.password_hash, u.role, u.status, u.password_reset_required
    FROM reader_sessions s
    JOIN users u ON u.id = s.user_id AND u.del_flag = false
    WHERE s.token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > now()
      AND u.status = 'active'
  `, [tokenHash]);
  const row = result.rows[0];
  return row ? { ...mapUser(row), sessionId: row.session_id, expiresAt: row.expires_at } : undefined;
}

export async function revokeSession(sessionId: string): Promise<void> {
  await getDatabase().query("UPDATE reader_sessions SET revoked_at = now() WHERE id = $1", [sessionId]);
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await getDatabase().query("UPDATE reader_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
}

export async function deleteAccount(userId: string): Promise<void> {
  const database = getDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const deleted = await client.query("DELETE FROM users WHERE id = $1 AND role = 'reader' AND del_flag = false", [userId]);
    if (deleted.rowCount !== 1) throw new Error("Reader account is no longer available.");
    await client.query("UPDATE reader_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createReaderByAdmin(input: {
  email: string;
  displayName: string;
  passwordHash: string;
  forcePasswordChange: boolean;
}): Promise<AuthUser> {
  const result = await getDatabase().query<UserRow>(`
    INSERT INTO users (email, display_name, password_hash, role, status, password_reset_required)
    VALUES ($1, $2, $3, 'reader', 'active', $4)
    RETURNING id, email, display_name, password_hash, role, status, password_reset_required
  `, [input.email, input.displayName, input.passwordHash, input.forcePasswordChange]);
  return mapUser(result.rows[0]);
}

export async function setUserStatus(
  userId: string,
  status: "active" | "disabled",
  operatorId: string,
  reason: string,
): Promise<boolean> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<{ email: string; status: "active" | "disabled" }>(`
      SELECT email, status FROM users
      WHERE id = $1 AND role = 'reader' AND del_flag = false
      FOR UPDATE
    `, [userId]);
    const row = target.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return false;
    }
    if (row.status === status) {
      await client.query("COMMIT");
      return true;
    }
    await client.query(`
      UPDATE users SET status = $2, updated_at = now(), updated_by = $3
      WHERE id = $1
    `, [userId, status, operatorId]);
    if (status === "disabled") {
      await client.query("UPDATE reader_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
    }
    await client.query(`
      INSERT INTO admin_reader_status_changes (
        operator_user_id, target_user_id, target_email, previous_status, new_status, reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [operatorId, userId, row.email, row.status, status, reason]);
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateReaderProfile(input: {
  targetUserId: string;
  operatorUserId: string;
  email: string;
  displayName: string;
  reason: string;
}): Promise<ReaderAccountSummary | undefined> {
  const client = await getDatabase().connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ email: string; display_name: string }>(`
      SELECT email, display_name FROM users
      WHERE id = $1 AND role = 'reader' AND del_flag = false
      FOR UPDATE
    `, [input.targetUserId]);
    const previous = current.rows[0];
    if (!previous) {
      await client.query("ROLLBACK");
      return undefined;
    }
    const emailChanged = previous.email.toLowerCase() !== input.email.toLowerCase();
    const updated = await client.query<UserRow>(`
      UPDATE users SET email = $2, display_name = $3, updated_at = now(), updated_by = $4
      WHERE id = $1
      RETURNING id, email, display_name, password_hash, role, status, password_reset_required
    `, [input.targetUserId, input.email, input.displayName, input.operatorUserId]);
    if (emailChanged) {
      await client.query("UPDATE reader_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [input.targetUserId]);
    }
    await client.query(`
      INSERT INTO admin_reader_profile_changes (
        operator_user_id, target_user_id, previous_email, new_email,
        previous_display_name, new_display_name, reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [input.operatorUserId, input.targetUserId, previous.email, input.email, previous.display_name, input.displayName, input.reason]);
    await client.query("COMMIT");
    return mapUser(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resetReaderPassword(input: {
  operatorUserId: string;
  targetUserId: string;
  passwordHash: string;
  reason: string;
}): Promise<void> {
  const database = getDatabase();
  const client: PoolClient = await database.connect();
  try {
    await client.query("BEGIN");
    const target = await client.query<{ id: string }>(`
      UPDATE users
      SET password_hash = $3, password_reset_required = true, updated_at = now(), updated_by = $1
      WHERE id = $2 AND role = 'reader' AND status = 'active' AND del_flag = false
      RETURNING id
    `, [input.operatorUserId, input.targetUserId, input.passwordHash]);
    if (!target.rows[0]) throw new Error("Target reader account was not found or is disabled.");
    await client.query("UPDATE reader_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [input.targetUserId]);
    await client.query(`
      INSERT INTO admin_password_resets (operator_user_id, target_user_id, target_email, reason, result)
      SELECT $1, $2, email, $3, 'success' FROM users WHERE id = $2
    `, [input.operatorUserId, input.targetUserId, input.reason]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function recordFailedAdminReset(input: {
  operatorUserId: string;
  targetUserId: string;
  reason: string;
}): Promise<void> {
  await getDatabase().query(`
    INSERT INTO admin_password_resets (operator_user_id, target_user_id, target_email, reason, result)
    SELECT $1, $2, COALESCE(email, $2::text), $3, 'failed' FROM users WHERE id = $2
  `, [input.operatorUserId, input.targetUserId, input.reason]);
}
