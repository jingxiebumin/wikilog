import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repositoryState = vi.hoisted(() => ({ database: undefined as PGlite | undefined }));

vi.mock("@/lib/db", () => ({
  pool: {
    query: (...args: Parameters<PGlite["query"]>) => repositoryState.database!.query(...args),
    connect: async () => ({
      query: (...args: Parameters<PGlite["query"]>) => repositoryState.database!.query(...args),
      release: () => undefined,
    }),
  },
}));

import { deleteAccount, getOwnProfile, restoreReaderAccount, setUserStatus, softDeleteReaderAccount, updateOwnProfile, updateReaderProfile } from "./repository";

describe("reader account removal", () => {
  let database: PGlite;
  let adminId: string;
  let readerId: string;

  beforeEach(async () => {
    database = new PGlite();
    repositoryState.database = database;
    for (const file of ["0001_initial.sql", "0002_audit_fields.sql", "0003_reader_accounts.sql", "0006_reader_status_audit.sql", "0007_reader_profile_audit.sql", "0008_personal_center.sql"]) {
      await database.exec(await readFile(path.join(process.cwd(), "db/migrations", file), "utf8"));
    }
    const admin = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('admin@example.test', 'Admin', 'hash', 'admin', 'active') RETURNING id
    `);
    adminId = admin.rows[0].id;
    const reader = await database.query<{ id: string }>(`
      INSERT INTO users (email, display_name, password_hash, role, status)
      VALUES ('reader@example.test', 'Reader', 'hash', 'reader', 'active') RETURNING id
    `);
    readerId = reader.rows[0].id;
    await database.query(`
      INSERT INTO reader_sessions (user_id, token_hash, expires_at)
      VALUES ($1, 'reader-session-hash', now() + interval '1 day')
    `, [readerId]);
    await database.query(`
      INSERT INTO admin_password_resets (operator_user_id, target_user_id, target_email, reason, result)
      VALUES ($1, $2, 'reader@example.test', '线下确认', 'success')
    `, [adminId, readerId]);
  });

  afterEach(async () => {
    repositoryState.database = undefined;
    await database.close();
  });

  it("cascades reader sessions and keeps the reset audit snapshot", async () => {
    await deleteAccount(readerId);

    const users = await database.query<{ id: string }>("SELECT id FROM users WHERE id = $1", [readerId]);
    const sessions = await database.query<{ id: string }>("SELECT id FROM reader_sessions WHERE user_id = $1", [readerId]);
    const audits = await database.query<{ target_user_id: string | null; target_email: string }>(`
      SELECT target_user_id, target_email FROM admin_password_resets WHERE operator_user_id = $1
    `, [adminId]);
    expect(users.rows).toEqual([]);
    expect(sessions.rows).toEqual([]);
    expect(audits.rows).toEqual([{ target_user_id: null, target_email: "reader@example.test" }]);
  });

  it("audits status changes and does not restore revoked sessions when re-enabled", async () => {
    expect(await setUserStatus(readerId, "disabled", adminId, "管理员停用")).toBe(true);
    expect(await setUserStatus(readerId, "active", adminId, "人工复核后重新启用")).toBe(true);

    const user = await database.query<{ status: string }>("SELECT status FROM users WHERE id = $1", [readerId]);
    const sessions = await database.query<{ revoked_at: Date | null }>("SELECT revoked_at FROM reader_sessions WHERE user_id = $1", [readerId]);
    const audits = await database.query<{ previous_status: string; new_status: string; reason: string; target_email: string }>(`
      SELECT previous_status, new_status, reason, target_email
      FROM admin_reader_status_changes WHERE target_user_id = $1 ORDER BY created_at
    `, [readerId]);

    expect(user.rows[0].status).toBe("active");
    expect(sessions.rows[0].revoked_at).not.toBeNull();
    expect(audits.rows).toEqual([
      { previous_status: "active", new_status: "disabled", reason: "管理员停用", target_email: "reader@example.test" },
      { previous_status: "disabled", new_status: "active", reason: "人工复核后重新启用", target_email: "reader@example.test" },
    ]);
  });

  it("audits reader profile changes and revokes sessions when the email changes", async () => {
    const updated = await updateReaderProfile({
      targetUserId: readerId,
      operatorUserId: adminId,
      email: "new-reader@example.test",
      displayName: "New Reader",
      reason: "读者申请更换登录邮箱",
    });

    const sessions = await database.query<{ revoked_at: Date | null }>("SELECT revoked_at FROM reader_sessions WHERE user_id = $1", [readerId]);
    const audits = await database.query<{ id: string }>("SELECT id FROM admin_reader_profile_changes WHERE target_user_id = $1", [readerId]);

    expect(updated).toMatchObject({ email: "new-reader@example.test", displayName: "New Reader", role: "reader" });
    expect(sessions.rows[0].revoked_at).not.toBeNull();
    expect(audits.rows).toEqual([]);
  });

  it("does not revoke sessions when only the display name changes", async () => {
    await updateReaderProfile({
      targetUserId: readerId,
      operatorUserId: adminId,
      email: "reader@example.test",
      displayName: "Renamed Reader",
      reason: "修正昵称",
    });

    const sessions = await database.query<{ revoked_at: Date | null }>("SELECT revoked_at FROM reader_sessions WHERE user_id = $1", [readerId]);
    expect(sessions.rows[0].revoked_at).toBeNull();
  });

  it("returns private profile fields only for the owning account", async () => {
    await database.query("UPDATE users SET phone = '+8613812345678', gender = 'undisclosed', introduction = '仅本人可见' WHERE id = $1", [readerId]);

    await expect(getOwnProfile(readerId)).resolves.toMatchObject({
      id: readerId,
      email: "reader@example.test",
      displayName: "Reader",
      phone: "+8613812345678",
      gender: "undisclosed",
      introduction: "仅本人可见",
    });
    await expect(getOwnProfile("00000000-0000-4000-8000-000000000099")).resolves.toBeUndefined();
  });

  it("updates and returns the caller's editable profile fields", async () => {
    await expect(updateOwnProfile({
      userId: readerId,
      displayName: "New Reader",
      phone: "13812345678",
      gender: "other",
      introduction: "新的个人介绍",
    })).resolves.toMatchObject({
      id: readerId,
      displayName: "New Reader",
      phone: "13812345678",
      gender: "other",
      introduction: "新的个人介绍",
    });
  });

  it("soft deletes and restores a reader without restoring old sessions", async () => {
    await expect(softDeleteReaderAccount(readerId, adminId, "用户申请停用")).resolves.toBe(true);
    await expect(restoreReaderAccount(readerId, adminId)).resolves.toBe(true);

    const reader = await database.query<{ del_flag: boolean; deleted_reason: string | null }>("SELECT del_flag, deleted_reason FROM users WHERE id = $1", [readerId]);
    const session = await database.query<{ revoked_at: Date | null }>("SELECT revoked_at FROM reader_sessions WHERE user_id = $1", [readerId]);
    expect(reader.rows[0]).toEqual({ del_flag: false, deleted_reason: null });
    expect(session.rows[0].revoked_at).not.toBeNull();
  });
});
