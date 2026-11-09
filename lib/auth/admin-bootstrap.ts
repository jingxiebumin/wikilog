import { Pool } from "pg";
import type { PoolClient } from "pg";
import { hashPassword } from "./password-core";

export type BootstrapAdmin = {
  id: string;
  email: string;
  displayName: string;
  role: "admin";
  status: "active";
  passwordResetRequired: boolean;
};

const normalizeEmail = (email: string): string => email.trim().toLocaleLowerCase("en-US");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateEmail = (email: string): string => {
  const normalized = normalizeEmail(email);
  if (normalized.length > 320 || !emailPattern.test(normalized)) {
    throw new Error("请输入有效的邮箱地址。");
  }
  return normalized;
};

const validateDisplayName = (displayName: string): string => {
  const value = displayName.trim();
  if (value.length < 1 || value.length > 80) throw new Error("昵称长度需为 1 到 80 个字符。");
  return value;
};

const validatePassword = (password: string): string => {
  if (password.length < 9 || password.length > 200) throw new Error("密码长度需为 9 到 200 个字符。");
  return password;
};

export async function initializeAdminAccount(input: {
  email: string;
  displayName: string;
  password: string;
}): Promise<BootstrapAdmin> {
  const email = validateEmail(input.email);
  const displayName = validateDisplayName(input.displayName);
  const password = validatePassword(input.password);
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required. Copy .env.example to .env.local or export DATABASE_URL.");

  const pool = new Pool({ connectionString, max: 1, application_name: "wikilog-admin-bootstrap" });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('wikilog-admin-bootstrap'))");
    const existing = await client.query<{ id: string }>("SELECT id FROM users WHERE role = 'admin' AND del_flag = false LIMIT 1");
    if (existing.rows[0]) throw new Error("管理员账号已经初始化。");

    const result = await client.query<{
      id: string;
      email: string;
      display_name: string;
      role: "admin";
      status: "active";
      password_reset_required: boolean;
    }>(`
      INSERT INTO users (email, display_name, password_hash, role, status, password_reset_required)
      VALUES ($1, $2, $3, 'admin', 'active', false)
      RETURNING id, email, display_name, role, status, password_reset_required
    `, [email, displayName, await hashPassword(password)]);
    await client.query("COMMIT");

    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      passwordResetRequired: row.password_reset_required,
    };
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}
