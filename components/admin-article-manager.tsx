"use client";

import { useState } from "react";
import { getTaxonomyDisplayNames } from "@/lib/public-presentation";
import styles from "./admin-article-manager.module.css";

type Option = { slug: string; name: string };
type Article = {
  id: string; title: string; summary: string; publishedAt: string; category: string; tags: string[];
  createdAt: string; visibility: "visible" | "hidden"; sourceFilename: string;
};
type Result = { articles: Article[]; total: number; page: number; pageSize: number };
type Editor = { id?: string; title: string; summary: string; publishedAt: string; category: string; tags: string[]; sourceFilename: string };

export function AdminArticleManager({ initialResult, categories, tags }: { initialResult: Result; categories: Option[]; tags: Option[] }) {
  const [result, setResult] = useState(initialResult);
  const [filter, setFilter] = useState({ category: "", status: "", search: "", pageSize: "10" });
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload(page = 1, pageSize = filter.pageSize) {
    const query = new URLSearchParams({ page: String(page), pageSize });
    if (filter.category) query.set("category", filter.category);
    if (filter.status) query.set("status", filter.status);
    if (filter.search) query.set("search", filter.search);
    const response = await fetch(`/api/admin/articles?${query}`, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("文章列表加载失败。");
    setResult(await response.json() as Result);
  }

  function openNew() {
    setError(""); setNotice("");
    setEditor({ title: "", summary: "", publishedAt: new Date().toISOString().slice(0, 10), category: categories[0]?.slug ?? "", tags: [], sourceFilename: "" });
  }

  async function openEdit(article: Article) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/articles/${encodeURIComponent(article.id)}`);
      if (!response.ok) throw new Error("文章资料加载失败。");
      const { article: current } = await response.json() as { article: Article };
      setEditor({ id: current.id, title: current.title, summary: current.summary, publishedAt: current.publishedAt, category: current.category, tags: current.tags, sourceFilename: current.sourceFilename });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "文章资料加载失败。"); }
    finally { setBusy(false); }
  }

  async function save(form: HTMLFormElement) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/articles", { method: "POST", body: new FormData(form) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "保存失败，请稍后重试。");
      setEditor(null); await reload(); setNotice("文章已保存。");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "保存失败。"); }
    finally { setBusy(false); }
  }

  async function change(article: Article, action: "hide" | "restore" | "delete") {
    const labels = { hide: "下架", restore: "上架", delete: "删除" };
    if (!window.confirm(`确认${labels[action]}“${article.title}”？`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/articles/${encodeURIComponent(article.id)}/visibility`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmed: true }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "操作失败，请稍后重试。");
      await reload(result.page); setNotice(`文章已${labels[action]}。`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "操作失败。"); }
    finally { setBusy(false); }
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));
  return <div className={styles.manager}>
    <div className={`${styles.toolbar} account-form`}>
      <label className="form-field">分类<select value={filter.category} onChange={(event) => setFilter({ ...filter, category: event.target.value })}><option value="">全部分类</option>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <label className="form-field">状态<select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}><option value="">全部状态</option><option value="visible">上架</option><option value="hidden">下架</option></select></label>
      <label className="form-field">标题<input value={filter.search} onChange={(event) => setFilter({ ...filter, search: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter") void reload(1); }} placeholder="输入标题关键词" /></label>
      <button className="button-secondary" disabled={busy} onClick={() => void reload(1)} type="button">筛选</button>
      <button disabled={busy} onClick={openNew} type="button">新增文章</button>
    </div>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p className="account-notice" role="status">{notice}</p> : null}
    <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>标题</th><th>分类</th><th>标签</th><th>文章日期</th><th>创建时间</th><th>状态</th><th>操作</th></tr></thead><tbody>
      {result.articles.map((article) => <tr key={article.id}><td><strong>{article.title}</strong><small>{article.summary}</small></td><td>{categories.find((item) => item.slug === article.category)?.name ?? article.category}</td><td>{getTaxonomyDisplayNames(article.tags, tags) || "-"}</td><td>{article.publishedAt}</td><td>{article.createdAt.slice(0, 10)}</td><td>{article.visibility === "visible" ? "上架" : "下架"}</td><td className={styles.rowActions}><a href={`/admin/articles/${encodeURIComponent(article.id)}/preview`} target="_blank" rel="noreferrer">预览</a>{article.visibility === "hidden" ? <button disabled={busy} onClick={() => void openEdit(article)} type="button">编辑</button> : null}<button disabled={busy} onClick={() => void change(article, article.visibility === "visible" ? "hide" : "restore")} type="button">{article.visibility === "visible" ? "下架" : "上架"}</button><button disabled={busy} onClick={() => void change(article, "delete")} type="button">删除</button></td></tr>)}
      {result.articles.length === 0 ? <tr><td colSpan={7}>没有符合条件的文章。</td></tr> : null}
    </tbody></table></div>
    <div className={`${styles.pagination} account-form`}><label className="form-field">每页<select value={filter.pageSize} onChange={(event) => { const value = event.target.value; setFilter((current) => ({ ...current, pageSize: value })); void reload(1, value); }}><option value="10">10 条</option><option value="20">20 条</option><option value="50">50 条</option></select></label><span>{result.total} 篇 · {result.page}/{totalPages}</span><button className="button-secondary" disabled={busy || result.page <= 1} onClick={() => void reload(result.page - 1)} type="button">上一页</button><button disabled={busy || result.page >= totalPages} onClick={() => void reload(result.page + 1)} type="button">下一页</button></div>
    {editor ? <dialog aria-labelledby="article-editor-title" aria-modal="true" className="admin-reader-dialog article-editor-dialog" open><div className={styles.dialogHeader}><h2 id="article-editor-title">{editor.id ? "编辑文章" : "新增文章"}</h2><button aria-label="关闭" disabled={busy} onClick={() => setEditor(null)} type="button">×</button></div><form className="account-form" onSubmit={(event) => { event.preventDefault(); void save(event.currentTarget); }}>
      {editor.id ? <input name="id" type="hidden" value={editor.id} /> : null}
      <label className="form-field"><span>标题</span><input maxLength={160} name="title" onChange={(event) => setEditor({ ...editor, title: event.target.value })} required value={editor.title} /></label>
      <label className="form-field"><span>摘要（可选）</span><textarea maxLength={500} name="summary" onChange={(event) => setEditor({ ...editor, summary: event.target.value })} value={editor.summary} /></label>
      <label className="form-field"><span>分类</span><select name="category" onChange={(event) => setEditor({ ...editor, category: event.target.value })} required value={editor.category}>{categories.map((item) => <option key={item.slug} value={item.slug}>{item.name}</option>)}</select></label>
      <fieldset className={styles.tagOptions}><legend>标签（最多两个）</legend>{tags.map((item) => <label key={item.slug}><input checked={editor.tags.includes(item.slug)} disabled={!editor.tags.includes(item.slug) && editor.tags.length >= 2} name="tags" onChange={(event) => setEditor({ ...editor, tags: event.target.checked ? [...editor.tags, item.slug] : editor.tags.filter((tag) => tag !== item.slug) })} type="checkbox" value={item.slug} />{item.name}</label>)}</fieldset>
      <label className="form-field"><span>文章日期</span><input name="publishedAt" onChange={(event) => setEditor({ ...editor, publishedAt: event.target.value })} required type="date" value={editor.publishedAt} /></label>
      {editor.id ? <p className="form-help">当前文件：{editor.sourceFilename || "无"} <a href={`/api/admin/articles/${encodeURIComponent(editor.id)}/source`}>下载</a></p> : null}
      <label className="form-field"><span>{editor.id ? "替换 Markdown 文件（可选）" : "Markdown 文件"}</span><input accept=".md,text/markdown,text/plain" name="file" required={!editor.id} type="file" /></label>
      <div className="profile-form-actions"><button className="button-secondary" disabled={busy} onClick={() => setEditor(null)} type="button">取消</button><button disabled={busy} type="submit">{busy ? "保存中…" : "保存"}</button></div>
    </form></dialog> : null}
  </div>;
}
