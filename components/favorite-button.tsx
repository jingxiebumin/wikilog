"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

export function FavoriteButton({ slug, initialFavorite }: { slug: string; initialFavorite: boolean }) {
  const [favorited, setFavorited] = useState(initialFavorite);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function toggle() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/favorites/${encodeURIComponent(slug)}`, {
        method: favorited ? "DELETE" : "POST",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(payload.error ?? "收藏操作暂时无法完成。");
      }
      setFavorited(!favorited);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "收藏操作暂时无法完成。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="favorite-control">
      <button aria-label={favorited ? "取消收藏" : "收藏文章"} aria-pressed={favorited} disabled={busy} onClick={() => void toggle()} title={favorited ? "取消收藏" : "收藏文章"} type="button">
        {favorited ? <BookmarkCheck aria-hidden="true" size={16} /> : <Bookmark aria-hidden="true" size={16} />}
        <span>{favorited ? "已收藏" : "收藏"}</span>
      </button>
      {error ? <span className="form-error" role="alert">{error}</span> : null}
    </div>
  );
}
