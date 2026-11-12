"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { PasswordInput } from "@/components/password-input";

type Reader = {
  id: string;
  email: string;
  displayName: string;
  status: "active" | "disabled";
  passwordResetRequired: boolean;
};

async function postJson(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string; temporaryPassword?: string; user?: Reader };
  if (!response.ok) throw new Error(payload.error ?? "请求无法完成，请稍后重试。");
  return payload;
}

const passwordError = (value: string) => value.length < 9 ? "密码至少需要 9 位。" : "";

function CreateReaderForm({ onCreated }: { onCreated: (reader: Reader) => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordFieldError, setPasswordFieldError] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextPasswordError = passwordError(password);
    setPasswordFieldError(nextPasswordError);
    if (nextPasswordError) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await postJson("/api/admin/readers", { displayName, email, password });
      if (result.user) onCreated(result.user);
      setDisplayName("");
      setEmail("");
      setPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "创建读者失败。");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form className="account-form" onSubmit={submit}>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <h2>人工创建读者</h2>
      <label className="form-field" htmlFor="admin-reader-name"><span>昵称</span><input id="admin-reader-name" maxLength={80} onChange={(event) => setDisplayName(event.target.value)} placeholder="读者昵称" required value={displayName} /></label>
      <label className="form-field" htmlFor="admin-reader-email"><span>邮箱</span><input id="admin-reader-email" onChange={(event) => setEmail(event.target.value)} placeholder="reader@example.com" required type="email" value={email} /></label>
      <PasswordInput error={passwordFieldError} label="初始密码" name="admin-reader-password" onBlur={() => setPasswordFieldError(passwordError(password))} onChange={(event) => setPassword(event.target.value)} placeholder="至少 9 位密码" required value={password} />
      <button disabled={submitting} type="submit">{submitting ? "创建中…" : "创建读者"}</button>
    </form>
  );
}

function ResetReaderForm({ reader }: { reader: Reader }) {
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!confirmed) { setError("请确认已在线下完成读者身份确认。"); return; }
    setSubmitting(true);
    setError("");
    setTemporaryPassword("");
    try {
      const result = await postJson(`/api/admin/readers/${reader.id}/reset-password`, {
        reason,
        identityConfirmed: "true",
      });
      setTemporaryPassword(result.temporaryPassword ?? "");
      setReason("");
      setConfirmed(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "密码重置失败。");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <form className="admin-reader-reset" onSubmit={submit}>
      <div><strong>{reader.displayName}</strong><span>{reader.email}</span></div>
      <label className="form-field" htmlFor={`reset-reason-${reader.id}`}><span>重置原因</span><input id={`reset-reason-${reader.id}`} onChange={(event) => setReason(event.target.value)} placeholder="例如：线下确认身份后协助找回" required value={reason} /></label>
      <label className="admin-confirm"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />我已在线下确认该读者身份</label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button disabled={submitting || reader.status !== "active"} type="submit">{submitting ? "生成中…" : "生成一次性临时密码"}</button>
      {temporaryPassword ? <p className="temporary-password" role="status"><span>临时密码（只显示这一次）</span><code>{temporaryPassword}</code></p> : null}
    </form>
  );
}

function ReaderStatusControl({ reader, onChanged }: { reader: Reader; onChanged: (status: Reader["status"]) => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nextStatus = reader.status === "active" ? "disabled" : "active";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await postJson(`/api/admin/readers/${reader.id}/status`, { status: nextStatus, reason });
      onChanged(nextStatus);
      setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "账号状态更新失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-reader-status" onSubmit={submit}>
      <label className="form-field" htmlFor={`status-reason-${reader.id}`}>
        <span>{nextStatus === "active" ? "重新启用原因" : "停用原因"}</span>
        <input id={`status-reason-${reader.id}`} maxLength={300} onChange={(event) => setReason(event.target.value)} required value={reason} />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="button-link" disabled={submitting} type="submit">
        {submitting ? "处理中…" : nextStatus === "active" ? "重新启用" : "停用账号"}
      </button>
    </form>
  );
}

export function AdminReaderManager({ initialReaders }: { initialReaders: Reader[] }) {
  const [readers, setReaders] = useState(initialReaders);
  return (
    <div className="admin-sections">
      <CreateReaderForm onCreated={(reader) => setReaders((current) => [reader, ...current])} />
      <section className="admin-reader-list">
        <h2>读者账号</h2>
        {readers.length === 0 ? <p className="form-help">暂无读者账号。</p> : readers.map((reader) => (
          <div className="admin-reader-entry" key={reader.id}>
            <div><strong>{reader.displayName} · {reader.status === "active" ? "已启用" : "已停用"}</strong><span>{reader.email}</span></div>
            <ReaderStatusControl reader={reader} onChanged={(status) => setReaders((current) => current.map((item) => item.id === reader.id ? { ...item, status } : item))} />
            <ResetReaderForm reader={reader} />
          </div>
        ))}
      </section>
    </div>
  );
}
