"use client";

import { useState } from "react";
import type { ArticleBlock } from "@/lib/content";

type ArticleVersion = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  category: string;
  tags: string[];
  versionNumber: number;
  current: boolean;
  status: "draft" | "published" | "archived";
  visibility: "visible" | "hidden" | "deleted";
  sourceMdx: string;
  content: ArticleBlock[];
};

async function post(url: string, body?: FormData | Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    ...(body instanceof FormData
      ? { body }
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "操作失败，请稍后重试。");
}

export function AdminArticleManager({ initialArticles }: { initialArticles: ArticleVersion[] }) {
  const [articles, setArticles] = useState(initialArticles);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  async function upload(formData: FormData) {
    setBusy(true); setError(""); setNotice("");
    try {
      await post("/api/admin/articles", formData);
      const response = await fetch("/api/admin/articles", { headers: { Accept: "application/json" } });
      const result = await response.json() as { articles: ArticleVersion[] };
      setArticles(result.articles);
      setNotice("草稿已保存。发布前不会影响当前公开版本。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "上传失败。");
    } finally { setBusy(false); }
  }

  async function act(url: string, body?: Record<string, string>, success = "操作已完成。") {
    setBusy(true); setError(""); setNotice("");
    try {
      await post(url, body);
      const response = await fetch("/api/admin/articles", { headers: { Accept: "application/json" } });
      const result = await response.json() as { articles: ArticleVersion[] };
      setArticles(result.articles); setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "操作失败。");
    } finally { setBusy(false); }
  }

  return (
    <div className="admin-article-manager">
      <form className="article-upload-form" onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void upload(formData);
        event.currentTarget.reset();
      }}>
        <div><h2>上传文章草稿</h2><p>仅接收最多 1 MB 的受限 MDX 文件。图片上传在持久存储验收后开放。</p></div>
        <label className="form-field" htmlFor="article-source"><span>MDX 文件</span><input id="article-source" accept=".mdx,text/markdown,text/plain" name="file" required type="file" /></label>
        <button disabled={busy} type="submit">{busy ? "处理中…" : "保存为草稿"}</button>
      </form>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="account-notice" role="status">{notice}</p> : null}
      <section className="admin-article-list">
        <h2>文章版本</h2>
        {articles.length === 0 ? <p className="form-help">暂无文章版本。</p> : articles.map((article) => (
          <article className="admin-article-row" key={article.id}>
            <div className="admin-article-meta"><span>{article.slug} · v{article.versionNumber}</span><span>{article.status === "draft" ? "草稿" : article.current ? "当前版本" : "历史版本"} · {article.visibility === "visible" ? "正常" : article.visibility === "hidden" ? "下架" : "已删除"}</span></div>
            <h3>{article.title}</h3><p>{article.summary}</p>
            <div className="admin-article-actions">
              {article.status === "draft" ? <button disabled={busy} onClick={() => void act(`/api/admin/article-versions/${article.id}/publish`, undefined, "版本已发布，公开内容已切换。")} type="button">发布此版本</button> : null}
              <button className="button-secondary" onClick={() => setPreviewId(previewId === article.id ? null : article.id)} type="button">{previewId === article.id ? "收起预览" : "草稿预览"}</button>
              {article.current && article.visibility === "visible" ? <button className="button-secondary" disabled={busy} onClick={() => void act(`/api/admin/articles/${encodeURIComponent(article.slug)}/visibility`, { action: "hide" }, "文章已下架。")} type="button">下架</button> : null}
              {article.current && article.visibility !== "visible" ? <button className="button-secondary" disabled={busy} onClick={() => void act(`/api/admin/articles/${encodeURIComponent(article.slug)}/visibility`, { action: "restore" }, "文章已恢复。")} type="button">恢复</button> : null}
              {article.visibility !== "deleted" ? <button className="button-secondary" disabled={busy} onClick={() => void act(`/api/admin/articles/${encodeURIComponent(article.slug)}/visibility`, { action: "delete" }, "文章已标记删除，可恢复。")} type="button">删除</button> : null}
            </div>
            {previewId === article.id ? <div className="admin-article-preview">
              <p className="eyebrow">预览 · {article.category} · {article.publishedAt}</p>
              <h4>{article.title}</h4><p>{article.summary}</p>
              {article.content.map((block, index) => block.type === "heading"
                ? <h5 key={index}>{block.text}</h5>
                : block.type === "list"
                  ? <ul key={index}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  : block.type === "code"
                    ? <pre key={index}><code>{block.code}</code></pre>
                    : <p key={index}>{block.text}</p>)}
              <details><summary>查看 MDX 源文</summary><pre>{article.sourceMdx || "当前版本没有上传源文。"}</pre></details>
            </div> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
