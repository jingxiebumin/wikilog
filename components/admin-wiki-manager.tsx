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

const statusLabel = (status: WikiVersion["status"]) => status === "draft" ? "草稿" : status === "published" ? "已发布" : "历史版本";

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

export function AdminWikiManager({ initialPages, publishedArticles, generationEnabled }: {
  initialPages: WikiPage[];
  publishedArticles: PublishedArticle[];
  generationEnabled: boolean;
}) {
  const [pages, setPages] = useState(initialPages);
  const [editor, setEditor] = useState<Editor>({ slug: "", title: "", body: "", sourceIds: [], relatedSlugs: [] });
  const [editingSlug, setEditingSlug] = useState<string>();
  const [selectedHistory, setSelectedHistory] = useState<{ slug: string; versions: WikiVersion[] }>();
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
    setError("");
    setNotice("");
  }

  async function editPage(page: WikiPage) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson(`/api/admin/wiki/${encodeURIComponent(page.slug)}`, "GET") as { versions: WikiVersion[] };
      setSelectedHistory({ slug: page.slug, versions: result.versions });
      const version = result.versions[0];
      setEditingSlug(page.slug);
      setEditor({
        slug: page.slug,
        title: version?.title ?? "",
        body: version?.body ?? "",
        sourceIds: version?.sources.map(({ articleVersionId }) => articleVersionId) ?? [],
        relatedSlugs: version?.relatedSlugs ?? [],
      });
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
      if (selectedHistory?.slug === page.slug) {
        const result = await requestJson(`/api/admin/wiki/${encodeURIComponent(page.slug)}`, "GET") as { versions: WikiVersion[] };
        setSelectedHistory({ slug: page.slug, versions: result.versions });
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
      setNotice("合并草稿已创建；审核发布前，两个页面仍保持原状。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法创建合并草稿。");
    } finally {
      setBusy(false);
    }
  }

  async function generateInitialCandidates() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await requestJson("/api/admin/wiki/generate", "POST") as { queued?: boolean };
      setNotice(result.queued ? "初始 Wiki 候选已排队，将在请求返回后生成并等待审核。" : "初始 Wiki 候选任务已存在。 ");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "无法排队生成 Wiki 候选。");
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
        <button className="button-secondary" disabled={busy || !generationEnabled} onClick={() => void generateInitialCandidates()} type="button">
          {generationEnabled ? "生成初始 AI 候选" : "AI 生成未启用"}
        </button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="account-notice" role="status">{notice}</p> : null}

      <form className="article-upload-form" onSubmit={saveDraft}>
        <div><h2>{editingSlug ? `编辑 ${editingSlug}` : "新建主题草稿"}</h2><p>保存后仅创建待审核版本，不改变公开页面。</p></div>
        <label className="form-field"><span>稳定地址</span><input autoComplete="off" disabled={Boolean(editingSlug)} maxLength={120} onChange={(event) => setEditor({ ...editor, slug: event.target.value })} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="database-transactions" required value={editor.slug} /></label>
        <label className="form-field"><span>页面标题</span><input maxLength={160} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required value={editor.title} /></label>
        <label className="form-field"><span>正文</span><textarea onChange={(event) => setEditor({ ...editor, body: event.target.value })} required rows={9} value={editor.body} /></label>
        <fieldset className="admin-wiki-options"><legend>有效文章来源</legend>
          {publishedArticles.length === 0 ? <p className="form-help">当前没有可引用的已发布文章版本。</p> : publishedArticles.map((article) => (
            <label key={article.id}><input checked={editor.sourceIds.includes(article.id)} onChange={() => setEditor({ ...editor, sourceIds: toggleValue(editor.sourceIds, article.id) })} type="checkbox" />{article.title} · v{article.versionNumber} · {article.slug}</label>
          ))}
        </fieldset>
        <fieldset className="admin-wiki-options"><legend>已发布相关主题</legend>
          {pages.filter((page) => page.state === "active" && page.slug !== editor.slug && page.current?.status === "published").map((page) => (
            <label key={page.slug}><input checked={editor.relatedSlugs.includes(page.slug)} onChange={() => setEditor({ ...editor, relatedSlugs: toggleValue(editor.relatedSlugs, page.slug) })} type="checkbox" />{page.current?.title} · {page.slug}</label>
          ))}
        </fieldset>
        <div className="admin-article-actions">
          <button disabled={busy} type="submit">{busy ? "保存中…" : "保存为草稿"}</button>
          {editingSlug ? <button className="button-secondary" disabled={busy} onClick={startNewPage} type="button">取消编辑</button> : null}
        </div>
      </form>

      <section className="admin-article-list">
        <h2>页面版本</h2>
        {pages.length === 0 ? <p className="form-help">暂无 Wiki 页面。</p> : pages.map((page) => (
          <article className="admin-article-row" key={page.id}>
            <div className="admin-article-meta"><span>{page.slug}</span><span>{page.state === "merged" ? `已合并至 ${page.redirectTo ?? "目标主题"}` : page.current?.status === "published" ? "公开页面" : "待审核"}</span></div>
            <h3>{page.current?.title ?? page.versions[0]?.title ?? page.slug}</h3>
            <div className="admin-article-actions">
              {page.state === "active" ? <button className="button-secondary" disabled={busy} onClick={() => void editPage(page)} type="button">编辑</button> : null}
              <button className="button-secondary" disabled={busy} onClick={async () => {
                setBusy(true); setError("");
                try {
                  const result = await requestJson(`/api/admin/wiki/${encodeURIComponent(page.slug)}`, "GET") as { versions: WikiVersion[] };
                  setSelectedHistory({ slug: page.slug, versions: result.versions });
                } catch (caught) { setError(caught instanceof Error ? caught.message : "无法读取页面版本。"); }
                finally { setBusy(false); }
              }} type="button">查看版本</button>
            </div>
            {page.versions.map((version) => (
              <div className="admin-article-row" key={version.id}>
                <div className="admin-article-meta"><span>v{version.versionNumber} · {statusLabel(version.status)}</span><span>{new Date(version.createdAt).toLocaleDateString("zh-CN")}</span></div>
                <h4>{version.title}</h4>
                {version.status === "draft" ? <div className="admin-article-actions"><button disabled={busy} onClick={() => void publish(page, version)} type="button">发布此版本</button></div> : null}
              </div>
            ))}
          </article>
        ))}
      </section>

      {selectedHistory ? <section className="admin-article-preview" aria-label={`${selectedHistory.slug} 页面版本历史`}>
        <div className="admin-article-meta"><span>页面版本 · {selectedHistory.slug}</span><button className="button-secondary" onClick={() => setSelectedHistory(undefined)} type="button">关闭</button></div>
        {selectedHistory.versions.map((version) => (
          <article key={version.id}>
            <p className="eyebrow">v{version.versionNumber} · {statusLabel(version.status)} · {new Date(version.createdAt).toLocaleString("zh-CN")}</p>
            <h3>{version.title}</h3><p>{version.body}</p>
            <p>来源：{version.sources.map((source) => `${source.articleTitle} · ${source.articleSlug}`).join("、")}</p>
            <p>相关主题：{version.relatedSlugs.length ? version.relatedSlugs.join("、") : "无"}</p>
            {version.status === "draft" ? <button disabled={busy} onClick={() => {
              const page = pages.find((item) => item.slug === selectedHistory.slug);
              if (page) void publish(page, version);
            }} type="button">发布此版本</button> : null}
          </article>
        ))}
      </section> : null}

      <form className="article-upload-form" onSubmit={mergePages}>
        <div><h2>合并主题</h2><p>先创建目标页面合并草稿，发布后原主题才会跳转。</p></div>
        <label className="form-field"><span>合并来源</span><select onChange={(event) => setMerge({ ...merge, sourceSlug: event.target.value })} required value={merge.sourceSlug}><option value="">选择来源主题</option>{mergeablePages.map((page) => <option key={page.slug} value={page.slug}>{page.current?.title} · {page.slug}</option>)}</select></label>
        <label className="form-field"><span>合并到</span><select onChange={(event) => setMerge({ ...merge, targetSlug: event.target.value })} required value={merge.targetSlug}><option value="">选择目标主题</option>{mergeablePages.filter((page) => page.slug !== merge.sourceSlug).map((page) => <option key={page.slug} value={page.slug}>{page.current?.title} · {page.slug}</option>)}</select></label>
        <button disabled={busy || mergeablePages.length < 2} type="submit">{busy ? "处理中…" : "创建合并草稿"}</button>
      </form>
    </div>
  );
}
