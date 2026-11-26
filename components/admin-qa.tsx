"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import type { QaMessage, QaSession } from "@/lib/qa/service";

type SessionSummary = Omit<QaSession, "messages">;

async function requestJson<T>(url: string, method = "GET", body?: Record<string, string>): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "请求无法完成，请稍后重试。");
  return payload;
}

export function AdminQa({
  enabled,
  models,
  canSelectModel,
  initialSessions,
  initialMessages,
}: {
  enabled: boolean;
  models: string[];
  canSelectModel: boolean;
  initialSessions: SessionSummary[];
  initialMessages: QaMessage[];
}) {
  const params = useSearchParams();
  const [sessions, setSessions] = useState(initialSessions);
  const [selectedId, setSelectedId] = useState(initialSessions[0]?.id ?? "");
  const [messages, setMessages] = useState<QaMessage[]>(initialMessages);
  const [question, setQuestion] = useState(params.get("question") ?? "");
  const [modelId, setModelId] = useState(models[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function selectSession(id: string) {
    setSelectedId(id);
    setError("");
    if (!id) { setMessages([]); return; }
    try {
      const result = await requestJson<{ session: QaSession }>(`/api/admin/qa/sessions/${id}`);
      setMessages(result.session.messages);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取问答会话。");
    }
  }

  async function createSession() {
    setSelectedId("");
    setMessages([]);
    setError("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true); setError("");
    try {
      const result = await requestJson<{ sessionId: string }>(
        selectedId ? `/api/admin/qa/sessions/${selectedId}/messages` : "/api/admin/qa/sessions",
        "POST",
        { question, ...(modelId ? { modelId } : {}) },
      );
      const sessionId = result.sessionId;
      if (!selectedId) setSelectedId(sessionId);
      setQuestion("");
      await selectSession(sessionId);
      const updated = await requestJson<{ sessions: SessionSummary[] }>("/api/admin/qa/sessions");
      setSessions(updated.sessions);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "问答暂时无法完成。");
    } finally { setBusy(false); }
  }

  async function removeSession() {
    if (!selectedId) return;
    setBusy(true); setError("");
    try {
      await requestJson(`/api/admin/qa/sessions/${selectedId}`, "DELETE");
      const remaining = sessions.filter((session) => session.id !== selectedId);
      setSessions(remaining);
      setMessages([]);
      setSelectedId(remaining[0]?.id ?? "");
      if (remaining[0]) await selectSession(remaining[0].id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法删除问答会话。");
    } finally { setBusy(false); }
  }

  if (!enabled) return <p className="qa-disabled p-5 rounded-xl bg-emerald-950/[0.03] border border-zinc-200/70 text-sm text-zinc-600" role="status">问答功能当前关闭。</p>;

  return (
    <div className="admin-qa">
      <aside className="qa-sessions" aria-label="问答会话">
        <div className="qa-sessions-heading"><h2>会话</h2><button disabled={busy} onClick={createSession} type="button">新建</button></div>
        {sessions.map((session) => (
          <button aria-current={selectedId === session.id ? "page" : undefined} className="qa-session-item" key={session.id} onClick={() => void selectSession(session.id)} type="button">
            <span>{session.title}</span><time>{new Date(session.updatedAt).toLocaleDateString("zh-CN")}</time>
          </button>
        ))}
        {sessions.length === 0 ? <p className="qa-empty">暂无会话</p> : null}
      </aside>
      <section className="qa-conversation" aria-label="文章问答">
        <div className="qa-conversation-heading">
          <h2>{sessions.find((session) => session.id === selectedId)?.title ?? "新问答"}</h2>
          {selectedId ? <button disabled={busy} onClick={() => void removeSession()} type="button">删除会话</button> : null}
        </div>
        <div className="qa-messages" aria-live="polite">
          {messages.map((message) => <QaMessageView key={message.id} message={message} />)}
          {messages.length === 0 ? <p className="qa-empty">选择或新建一个会话</p> : null}
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <form className="qa-form" onSubmit={submit}>
          {canSelectModel ? <label className="form-field"><span>模型</span><select onChange={(event) => setModelId(event.target.value)} value={modelId}>{models.map((model) => <option key={model} value={model}>{model}</option>)}</select></label> : null}
          <label className="form-field"><span>问题</span><textarea maxLength={4000} onChange={(event) => setQuestion(event.target.value)} value={question} /></label>
          <p className="form-help">回答会附上已发布文章中的原文依据；证据不足时将拒绝回答。</p>
          <div className="qa-form-footer"><span>{Array.from(question).length} / 2,000</span><button disabled={busy || !question.trim() || Array.from(question).length > 2000} type="submit">{busy ? "处理中…" : "提问"}</button></div>
        </form>
      </section>
    </div>
  );
}

function QaMessageView({ message }: { message: QaMessage }) {
  const pending = message.status === "queued" || message.status === "processing";
  const statusText = message.status === "queued"
    ? "排队中…"
    : message.status === "processing"
      ? "正在生成…"
      : message.status === "timed_out"
        ? "请求超时，可主动重试。"
        : "请求未完成，可主动重试。";

  return (
    <article className="qa-message">
      <p className="qa-question">{message.question}</p>
      {message.status === "succeeded" || message.status === "refused"
        ? <p className="qa-answer">{message.answer}</p>
        : <p aria-live="polite" className={`qa-answer ${pending ? "" : "qa-answer-error"}`}>{statusText}</p>}
      {message.citations.map((citation) => (
        <blockquote className="qa-citation" key={`${message.id}:${citation.articleVersionId}`}>
          <a href={citation.url}>{citation.title}</a><p>{citation.quote}</p>
        </blockquote>
      ))}
      {message.inputTokens !== null && message.outputTokens !== null ? <small className="qa-usage">输入 {message.inputTokens} · 输出 {message.outputTokens} tokens</small> : null}
    </article>
  );
}
