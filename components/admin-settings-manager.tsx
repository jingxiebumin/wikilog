"use client";

import { useState, type FormEvent } from "react";

type TaxonomyType = "category" | "tag";
type TaxonomyItem = { id: string; slug: string; name: string };
type Taxonomy = { categories: TaxonomyItem[]; tags: TaxonomyItem[] };

async function requestJson(url: string, method: string, body?: Record<string, string>) {
  const response = await fetch(url, {
    method,
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "请求无法完成，请稍后重试。");
}

export function AdminSettingsManager({ initialTaxonomy }: { initialTaxonomy: Taxonomy }) {
  const [taxonomy, setTaxonomy] = useState(initialTaxonomy);
  const [selectedType, setSelectedType] = useState<TaxonomyType>("category");
  const [editing, setEditing] = useState<TaxonomyItem>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const items = selectedType === "category" ? taxonomy.categories : taxonomy.tags;
  const typeLabel = selectedType === "category" ? "分类" : "标签";

  async function reload() {
    const response = await fetch("/api/admin/settings", { headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({})) as Taxonomy & { error?: string };
    if (!response.ok) throw new Error(payload.error ?? "无法读取分类和标签。");
    setTaxonomy({ categories: payload.categories ?? [], tags: payload.tags ?? [] });
  }

  function openCreate() {
    setEditing(undefined);
    setName("");
    setSlug("");
    setError("");
    setDialogOpen(true);
  }

  function openEdit(item: TaxonomyItem) {
    setEditing(item);
    setName(item.name);
    setSlug(item.slug);
    setError("");
    setDialogOpen(true);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson("/api/admin/settings", editing ? "PATCH" : "POST", {
        type: selectedType,
        ...(editing ? { id: editing.id } : { slug }),
        name,
      });
      await reload();
      setNotice(`${typeLabel}已${editing ? "更新" : "添加"}。`);
      setDialogOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${typeLabel}保存失败。`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: TaxonomyItem) {
    if (!window.confirm(`确定删除“${item.name}”吗？已被文章使用的${typeLabel}不能删除。`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await requestJson(`/api/admin/settings?type=${selectedType}&id=${encodeURIComponent(item.id)}`, "DELETE");
      await reload();
      setNotice(`${typeLabel}已删除。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `${typeLabel}删除失败。`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-settings-manager">
      <div aria-label="系统设置类型" className="personal-tabs" role="tablist">
        <button aria-selected={selectedType === "category"} onClick={() => setSelectedType("category")} role="tab" type="button">文章分类</button>
        <button aria-selected={selectedType === "tag"} onClick={() => setSelectedType("tag")} role="tab" type="button">文章标签</button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {notice ? <p className="account-notice" role="status">{notice}</p> : null}
      <div className="admin-reader-toolbar">
        <p className="form-help">{selectedType === "category" ? "每篇文章选择一个分类。" : "每篇文章最多选择两个标签。"}</p>
        <button disabled={busy} onClick={openCreate} type="button">添加{typeLabel}</button>
      </div>
      <div className="admin-reader-table-wrap">
        <table className="admin-reader-table">
          <thead><tr><th>名称</th><th>标识</th><th>操作</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td><td><code>{item.slug}</code></td>
                <td><div className="admin-reader-actions">
                  <button className="button-secondary" disabled={busy} onClick={() => openEdit(item)} type="button">改名</button>
                  <button className="button-secondary" disabled={busy} onClick={() => void remove(item)} type="button">删除</button>
                </div></td>
              </tr>
            ))}
            {items.length === 0 ? <tr><td colSpan={3}>暂无{typeLabel}。</td></tr> : null}
          </tbody>
        </table>
      </div>
      {dialogOpen ? <dialog aria-labelledby="taxonomy-dialog-title" className="admin-reader-dialog" open>
        <form className="account-form" onSubmit={save}>
          <h2 id="taxonomy-dialog-title">{editing ? `修改${typeLabel}名称` : `添加${typeLabel}`}</h2>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          {!editing ? <label className="form-field"><span>稳定标识</span><input autoComplete="off" maxLength={80} onChange={(event) => setSlug(event.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="例如 engineering" required value={slug} /><small>使用小写英文、数字和连字符；创建后不再更改。</small></label> : null}
          <label className="form-field"><span>显示名称</span><input autoComplete="off" maxLength={80} onChange={(event) => setName(event.target.value)} required value={name} /></label>
          <div className="profile-form-actions"><button disabled={busy} type="submit">{busy ? "保存中…" : "保存"}</button><button className="button-secondary" disabled={busy} onClick={() => setDialogOpen(false)} type="button">取消</button></div>
        </form>
      </dialog> : null}
    </div>
  );
}
