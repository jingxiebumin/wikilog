"use client";

import { useState, type FormEvent } from "react";

type WikiVersion = {
  id: string;
  versionNumber: number;
  status: "draft" | "published" | "archived";
  title: string;
  body: string;
  createdAt: string;
  sources: Array<{ articleVersionId: string; articleSlug: string; articleTitle: string }>;
  relatedSlugs: string[];
  mergeSourceSlug?: string;
};

type WikiPage = {
  id: string;
  slug: string;
  state: "active" | "merged";
  redirectTo?: string;
  current?: { id: string; title: string | null; status: string | null };
  versions: WikiVersion[];
};

type PublishedArticle = { id: string; slug: string; title: string; versionNumber: number };
type Editor = { slug: string; title: string; body: string; sourceIds: string[]; relatedSlugs: string[] };

const statusLabel = (status: WikiVersion["status"]) => status === "draft" ? "待发布草稿" : "当前公开内容";

async function requestJson(url: string, method: string, body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "请求无法完成，请稍后重试。");
  return payload;
}

export function AdminWikiManager({ initialPages, publishedArticles }: {
  initialPages: WikiPage[];
  publishedArticles: PublishedArticle[];
}) {
  const [pages, setPages] = useState(initialPages);
  const [editor, setEditor] = useState<Editor>({ slug: "", title: "", body: "", sourceIds: [], relatedSlugs: [] });
  const [editingSlug, setEditingSlug] = useState<string>();
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedPreview, setSelectedPreview] = useState<{ slug: string; version: WikiVersion }>();
  const [mergeOpen, setMergeOpen] = useState(false);
  const [merge, setMerge] = useState({ sourceSlug: "", targetSlug: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function reloadPages() {
    const result = await requestJson("/api/admin/wiki", "GET") as { pages: WikiPage[] };
    setPages(result.pages);
  }

  function startNewPage() {
    setEditingSlug(undefined);
    setEditor({ slug: "", title: "", body: "", sourceIds: [], relatedSlugs: [] });
    setEditorOpen(true);
    setError("");
    setNotice("");
  }

  async function editPage(page: WikiPage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson(`/api/admin/wiki/${encodeURIComponent(page.slug)}`, "GET") as { versions: WikiVersion[] };
      const version = result.versions.find(({ status }) => status === "draft")
        ?? result.versions.find(({ status }) => status === "published");
      setEditingSlug(page.slug);
      setEditor({
        slug: page.slug,
        title: version?.title ?? "",
        body: version?.body ?? "",
        sourceIds: version?.sources.map(({ articleVersionId }) => articleVersionId) ?? [],
        relatedSlugs: version?.relatedSlugs ?? [],
      });
      setEditorOpen(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法读取 Wiki 页面。");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const path = editingSlug ? `/api/admin/wiki/${encodeURIComponent(editingSlug)}` : "/api/admin/wiki";
      await requestJson(path, "POST", {
        slug: editor.slug,
        title: editor.title,
        body: editor.body,
        sourceArticleVersionIds: editor.sourceIds,
        relatedSlugs: editor.relatedSlugs,
      });
      await reloadPages();
      setNotice("草稿已保存，公开页面保持不变。");
      setEditorOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法保存 Wiki 草稿。");
    } finally {
      setBusy(false);
    }
  }

  async function publish(page: WikiPage, version: WikiVersion) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson(`/api/admin/wiki/pages/${encodeURIComponent(page.id)}/versions/${encodeURIComponent(version.id)}/publish`, "POST");
      await reloadPages();
      setNotice(`“${version.title}”已发布。`);
      if (selectedPreview?.slug === page.slug) {
        const result = await requestJson(`/api/admin/wiki/${encodeURIComponent(page.slug)}`, "GET") as { versions: WikiVersion[] };
        const version = result.versions.find(({ status }) => status === "published");
        if (version) setSelectedPreview({ slug: page.slug, version });
        else setSelectedPreview(undefined);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法发布 Wiki 页面。");
    } finally {
      setBusy(false);
    }
  }

  async function mergePages(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/admin/wiki/merge", "POST", merge);
      await reloadPages();
      const result = await requestJson(`/api/admin/wiki/${encodeURIComponent(merge.targetSlug)}`, "GET") as { versions: WikiVersion[] };
      const draft = result.versions.find(({ status }) => status === "draft");
      if (draft) {
        setEditingSlug(merge.targetSlug);
        setEditor({
          slug: merge.targetSlug,
          title: draft.title,
          body: draft.body,
          sourceIds: draft.sources.map(({ articleVersionId }) => articleVersionId),
          relatedSlugs: draft.relatedSlugs,
        });
        setMergeOpen(false);
        setEditorOpen(true);
      }
      setNotice("合并草稿已创建；审核发布前，两个页面仍保持原状。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建合并草稿。");
    } finally {
      setBusy(false);
    }
  }

  function toggleValue(values: string[], value: string) {
    return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
  }

  const mergeablePages = pages.filter((page) => page.state === "active" && page.current?.status === "published");

  return (
    <div className="admin-article-manager">
      <div className="admin-article-actions">
        <button onClick={startNewPage} type="button">创建 Wiki 页面</button>
        <button className="button-secondary" onClick={() => setMergeOpen(true)} type="button">合并页面</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="account-notice" role="status">{notice}</p> : null}

      <section className="admin-article-list">
        <h2>Wiki 页面</h2>
        {pages.length === 0 ? <p className="form-help">暂无 Wiki 页面。</p> : pages.map((page) => (
          <article className="admin-article-row" key={page.id}>
            <div className="admin-article-meta"><span>{page.slug}</span><span>{page.state === "merged" ? `已合并至 ${page.redirectTo ?? "目标主题"}` : page.current?.status === "published" ? "当前公开" : "尚未公开"}</span></div>
            <h3>{page.current?.title ?? page.versions.find(({ status }) => status === "draft")?.title ?? page.slug}</h3>
            <div className="admin-article-actions">
              {page.state === "active" ? <button className="button-secondary" disabled={busy} onClick={() => void editPage(page)} type="button">编辑</button> : null}
              {page.current?.status === "published" ? <button className="button-secondary" disabled={busy} onClick={() => {
                const current = page.versions.find(({ status }) => status === "published");
                if (current) setSelectedPreview({ slug: page.slug, version: current });
              }} type="button">查看公开内容</button> : null}
              {page.state === "active" && page.versions.some(({ status }) => status === "draft") ? <button className="button-secondary" disabled={busy} onClick={() => {
                const draft = page.versions.find(({ status }) => status === "draft");
                if (draft) setSelectedPreview({ slug: page.slug, version: draft });
              }} type="button">预览待发布草稿</button> : null}
            </div>
            {page.versions.some(({ status }) => status === "draft") ? <p className="form-help">有一份待发布草稿</p> : null}
          </article>
        ))}
      </section>

      {editorOpen ? <dialog aria-label={editingSlug ? `编辑 Wiki 页面 ${editingSlug}` : "新建 Wiki 页面"} aria-modal="true" className="admin-reader-dialog" open>
        <form onSubmit={saveDraft}>
          <h2>{editingSlug ? `编辑 ${editingSlug}` : "新建 Wiki 页面"}</h2>
          <p>保存后只更新待发布草稿；当前公开页面会保持不变。</p>
          <label className="form-field"><span>页面地址</span><input autoComplete="off" disabled={Boolean(editingSlug)} maxLength={120} onChange={(event) => setEditor({ ...editor, slug: event.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="database-transactions" required value={editor.slug} /></label>
          <label className="form-field"><span>页面标题</span><input maxLength={160} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required value={editor.title} /></label>
          <label className="form-field"><span>正文</span><textarea onChange={(event) => setEditor({ ...editor, body: event.target.value })} required rows={9} value={editor.body} /></label>
          <fieldset className="admin-wiki-options"><legend>有效文章来源</legend>
            {publishedArticles.length === 0 ? <p className="form-help">当前没有可引用的已发布文章。</p> : publishedArticles.map((article) => (
              <label key={article.id}><input checked={editor.sourceIds.includes(article.id)} onChange={() => setEditor({ ...editor, sourceIds: toggleValue(editor.sourceIds, article.id) })} type="checkbox" />{article.title} · {article.slug}</label>
            ))}
          </fieldset>
          <fieldset className="admin-wiki-options"><legend>相关 Wiki 页面</legend>
            {pages.filter((page) => page.state === "active" && page.slug !== editor.slug && page.current?.status === "published").map((page) => (
              <label key={page.slug}><input checked={editor.relatedSlugs.includes(page.slug)} onChange={() => setEditor({ ...editor, relatedSlugs: toggleValue(editor.relatedSlugs, page.slug) })} type="checkbox" />{page.current?.title} · {page.slug}</label>
            ))}
          </fieldset>
          <div className="admin-article-actions">
            <button disabled={busy} type="submit">{busy ? "保存中…" : "保存待发布草稿"}</button>
            <button className="button-secondary" disabled={busy} onClick={() => setEditorOpen(false)} type="button">取消</button>
          </div>
        </form>
      </dialog> : null}

      {selectedPreview ? <dialog aria-label={`${selectedPreview.slug} Wiki 详情预览`} aria-modal="true" className="admin-reader-dialog" open>
        <div>
          <div className="admin-article-meta"><span>{selectedPreview.slug} · {statusLabel(selectedPreview.version.status)}</span><button className="button-secondary" onClick={() => setSelectedPreview(undefined)} type="button">关闭</button></div>
          <h2>{selectedPreview.version.title}</h2>
          <p>{selectedPreview.version.body}</p>
          <h3>文章来源</h3>
          <p>{selectedPreview.version.sources.map((source) => `${source.articleTitle} · ${source.articleSlug}`).join("、") || "无"}</p>
          <h3>相关页面</h3>
          <p>{selectedPreview.version.relatedSlugs.length ? selectedPreview.version.relatedSlugs.join("、") : "无"}</p>
          {selectedPreview.version.status === "draft" ? <button disabled={busy} onClick={() => {
            const page = pages.find((item) => item.slug === selectedPreview.slug);
            if (page) void publish(page, selectedPreview.version);
          }} type="button">确认发布</button> : null}
        </div>
      </dialog> : null}

      {mergeOpen ? <dialog aria-label="合并 Wiki 页面" aria-modal="true" className="admin-reader-dialog" open>
        <form onSubmit={mergePages}>
          <h2>合并 Wiki 页面</h2>
          <p>系统汇总来源文章和相关页面；合并草稿发布前，两页保持原样。</p>
          <label className="form-field"><span>并入页面</span><select onChange={(event) => setMerge({ ...merge, sourceSlug: event.target.value })} required value={merge.sourceSlug}><option value="">选择并入页面</option>{mergeablePages.map((page) => <option key={page.slug} value={page.slug}>{page.current?.title} · {page.slug}</option>)}</select></label>
          <label className="form-field"><span>保留页面</span><select onChange={(event) => setMerge({ ...merge, targetSlug: event.target.value })} required value={merge.targetSlug}><option value="">选择保留页面</option>{mergeablePages.filter((page) => page.slug !== merge.sourceSlug).map((page) => <option key={page.slug} value={page.slug}>{page.current?.title} · {page.slug}</option>)}</select></label>
          <div className="admin-article-actions"><button disabled={busy || mergeablePages.length < 2} type="submit">{busy ? "处理中…" : "准备合并草稿"}</button><button className="button-secondary" disabled={busy} onClick={() => setMergeOpen(false)} type="button">取消</button></div>
        </form>
      </dialog> : null}
    </div>
  );
}
