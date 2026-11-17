"use client";

import { useState } from "react";

export function ArticlePreviewActions({ id, visibility }: { id: string; visibility: "visible" | "hidden" }) {
  const [error, setError] = useState("");
  const action = visibility === "visible" ? "hide" : "restore";
  const label = visibility === "visible" ? "下架" : "上架";
  async function changeVisibility() {
    const next = action;
    if (!window.confirm(next === "hide" ? "确认下架这篇文章？" : "确认上架这篇文章？")) return;
    setError("");
    const response = await fetch(`/api/admin/articles/${encodeURIComponent(id)}/visibility`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmed: true }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      setError(payload.error ?? "操作失败，请稍后重试。");
      return;
    }
    window.location.reload();
  }
  return <span className="preview-actions"><span>{visibility === "visible" ? "当前上架" : "当前下架"}</span><button onClick={() => void changeVisibility()} type="button">{label}</button>{error ? <span role="alert">{error}</span> : null}</span>;
}
