"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type Reader = {
  id: string;
  email: string;
  displayName: string;
  status: "active" | "disabled";
  passwordResetRequired: boolean;
  createdAt: string | Date;
  phone: string | null;
  gender: "male" | "female" | "other" | "undisclosed" | null;
  delFlag: boolean;
};

type ReaderFilter = "active" | "deleted";

async function requestJson(url: string, method: string, body?: Record<string, string>) {
  const response = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; message?: string; user?: Reader };
  if (!response.ok) throw new Error(payload.error ?? "请求无法完成，请稍后重试。");
  return payload;
}

function CreateReader({ onCreated }: { onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await requestJson("/api/admin/readers", "POST", { email });
      setEmail("");
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建读者失败。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-reader-create" onSubmit={submit}>
      <h2>创建读者</h2>
      <label className="form-field"><span>登录邮箱</span><input autoComplete="email" onChange={(event) => setEmail(event.target.value)} placeholder="reader@example.com" required type="email" value={email} /></label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button disabled={busy} type="submit">{busy ? "创建中…" : "创建账号"}</button>
      <p className="form-help">初始密码为 123456，首次登录时必须修改。</p>
    </form>
  );
}

function EditReaderDialog({ reader, onClose, onSaved }: { reader: Reader; onClose: () => void; onSaved: (reader: Reader) => void }) {
  const [displayName, setDisplayName] = useState(reader.displayName);
  const [email, setEmail] = useState(reader.email);
  const [phone, setPhone] = useState(reader.phone ?? "");
  const [gender, setGender] = useState(reader.gender ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await requestJson(`/api/admin/readers/${reader.id}`, "PATCH", { displayName, email, phone, gender });
      if (result.user) onSaved(result.user);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "资料更新失败。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog aria-labelledby="reader-edit-title" className="admin-reader-dialog" open>
      <form className="account-form" onSubmit={submit}>
        <h2 id="reader-edit-title">编辑读者资料</h2>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <label className="form-field"><span>昵称</span><input maxLength={80} onChange={(event) => setDisplayName(event.target.value)} required value={displayName} /></label>
        <label className="form-field"><span>登录邮箱</span><input onChange={(event) => setEmail(event.target.value)} required type="email" value={email} /></label>
        <label className="form-field"><span>手机号</span><input onChange={(event) => setPhone(event.target.value)} value={phone} /></label>
        <label className="form-field"><span>性别</span><select onChange={(event) => setGender(event.target.value)} value={gender}><option value="">未填写</option><option value="male">男</option><option value="female">女</option><option value="other">其他</option><option value="undisclosed">不愿透露</option></select></label>
        <div className="profile-form-actions"><button disabled={busy} type="submit">{busy ? "保存中…" : "保存"}</button><button className="button-secondary" disabled={busy} onClick={onClose} type="button">取消</button></div>
      </form>
    </dialog>
  );
}

export function AdminReaderManager({ initialReaders, initialSearch, includeDeleted }: { initialReaders: Reader[]; initialSearch: string; includeDeleted: boolean }) {
  const router = useRouter();
  const [readers, setReaders] = useState(initialReaders);
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<ReaderFilter>(includeDeleted ? "deleted" : "active");
  const [editing, setEditing] = useState<Reader>();
  const [deleting, setDeleting] = useState<Reader>();
  const [deleteReason, setDeleteReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  async function reloadReaders() {
    const params = new URLSearchParams({ search, status: filter });
    const response = await fetch(`/api/admin/readers?${params.toString()}`, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({})) as { readers?: Reader[]; error?: string };
    if (response.ok) setReaders(payload.readers ?? []);
    else setError(payload.error ?? "无法读取账号列表。");
  }

  async function searchReaders(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams({ search, status: filter });
    router.replace(`/admin/readers?${params.toString()}`);
    const response = await fetch(`/api/admin/readers?${params.toString()}`, { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({})) as { readers?: Reader[]; error?: string };
    if (!response.ok) { setError(payload.error ?? "无法读取账号列表。"); return; }
    setError("");
    setReaders(payload.readers ?? []);
  }

  async function resetPassword(reader: Reader) {
    if (!window.confirm(`确定将 ${reader.email} 的密码重置为 123456 吗？该读者下次登录时必须修改密码。`)) return;
    setBusyId(reader.id);
    setError("");
    try {
      const result = await requestJson(`/api/admin/readers/${reader.id}/reset-password`, "POST");
      setNotice(result.message ?? "密码已重置。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "密码重置失败。");
    } finally {
      setBusyId("");
    }
  }

  async function confirmDelete(event: FormEvent) {
    event.preventDefault();
    if (!deleting) return;
    setBusyId(deleting.id);
    setError("");
    try {
      await requestJson(`/api/admin/readers/${deleting.id}`, "DELETE", { reason: deleteReason });
      setReaders((current) => current.filter((reader) => reader.id !== deleting.id));
      setDeleting(undefined);
      setDeleteReason("");
      setNotice("读者账号已删除。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "删除失败。");
    } finally {
      setBusyId("");
    }
  }

  async function restore(reader: Reader) {
    if (!window.confirm(`确定恢复 ${reader.email} 吗？`)) return;
    setBusyId(reader.id);
    setError("");
    try {
      await requestJson(`/api/admin/readers/${reader.id}/restore`, "POST");
      setReaders((current) => current.filter((item) => item.id !== reader.id));
      setNotice("读者账号已恢复。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "恢复失败。");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="admin-sections">
      {!includeDeleted ? <CreateReader onCreated={() => { setNotice("读者账号已创建。"); void reloadReaders(); }} /> : null}
      <section aria-label="读者账号列表" className="admin-reader-list">
        <form className="admin-reader-list-heading" onSubmit={searchReaders}>
          <h2>读者账号</h2>
          <label className="form-field"><span>邮箱或昵称</span><input onChange={(event) => setSearch(event.target.value)} type="search" value={search} /></label>
          <label className="form-field"><span>账号范围</span><select onChange={(event) => setFilter(event.target.value as ReaderFilter)} value={filter}><option value="active">正常账号</option><option value="deleted">已删除账号</option></select></label>
          <button type="submit">查询</button>
        </form>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {notice ? <p className="account-notice" role="status">{notice}</p> : null}
        {readers.length === 0 ? <p className="form-help">暂无匹配的读者账号。</p> : (
          <div className="admin-reader-table-wrap"><table className="admin-reader-table">
            <thead><tr><th>昵称</th><th>登录邮箱</th><th>账号状态</th><th>创建日期</th><th>操作</th></tr></thead>
            <tbody>{readers.map((reader) => <tr key={reader.id}>
              <td>{reader.displayName || "未设置"}</td><td>{reader.email}</td>
              <td>{reader.delFlag ? "已删除" : reader.status === "active" ? "正常" : "停用"}</td>
              <td>{new Date(reader.createdAt).toLocaleDateString("zh-CN")}</td>
              <td className="admin-reader-actions">
                {reader.delFlag ? <button disabled={busyId === reader.id} onClick={() => void restore(reader)} type="button">恢复</button> : <>
                  <button onClick={() => setEditing(reader)} type="button">编辑</button>
                  <button disabled={busyId === reader.id} onClick={() => void resetPassword(reader)} type="button">重置密码</button>
                  <button className="danger-action" onClick={() => { setDeleteReason(""); setDeleting(reader); }} type="button">删除</button>
                </>}
              </td>
            </tr>)}</tbody>
          </table></div>
        )}
      </section>
      {editing ? <EditReaderDialog onClose={() => setEditing(undefined)} onSaved={(updated) => { setReaders((current) => current.map((reader) => reader.id === updated.id ? updated : reader)); setEditing(undefined); setNotice("读者资料已保存。"); }} reader={editing} /> : null}
      {deleting ? <dialog aria-labelledby="reader-delete-title" className="admin-reader-dialog" open>
        <form className="account-form" onSubmit={confirmDelete}>
          <h2 id="reader-delete-title">删除读者账号</h2><p>账号将被软删除，关联数据保留，会话立即失效。</p>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <label className="form-field"><span>删除原因（选填）</span><textarea maxLength={500} onChange={(event) => setDeleteReason(event.target.value)} rows={3} value={deleteReason} /></label>
          <div className="profile-form-actions"><button className="danger-action" disabled={busyId === deleting.id} type="submit">{busyId === deleting.id ? "处理中…" : "确认删除"}</button><button className="button-secondary" onClick={() => setDeleting(undefined)} type="button">取消</button></div>
        </form>
      </dialog> : null}
    </div>
  );
}
