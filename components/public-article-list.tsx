"use client";

import Link from "next/link";
import Image from "next/image";
import { Bookmark, Clock3 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Article, Category } from "@/lib/content";
import { getArticleCoverPath, getArticleSummaryLine, getTaxonomyDisplayNames } from "@/lib/public-presentation";

const PAGE_SIZE = 10;

type ArticlePage = { articles: Article[]; totalCount: number; hasMore: boolean };

const uniqueArticles = (articles: Article[]) => Array.from(new Map(articles.map((article) => [article.slug, article])).values());

export function PublicArticleList({ initialPage, categories, tags }: { initialPage: ArticlePage; categories: Category[]; tags: Array<{ slug: string; name: string }> }) {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [articles, setArticles] = useState(() => uniqueArticles(initialPage.articles));
  const [hasMore, setHasMore] = useState(initialPage.hasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement>(null);
  const pending = useRef(false);
  const requestId = useRef(0);

  const loadPage = useCallback(async (category: string, offset: number, replace: boolean) => {
    if (!replace && pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    const id = ++requestId.current;
    try {
      const response = await fetch(`/api/articles?category=${encodeURIComponent(category)}&limit=${PAGE_SIZE}&offset=${offset}`, {
        headers: { Accept: "application/json" },
      });
      const result = await response.json() as ArticlePage & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "文章暂时无法加载。");
      if (id !== requestId.current) return;
      setArticles((current) => {
        const next = replace ? result.articles : [...current, ...result.articles];
        return Array.from(new Map(next.map((article) => [article.slug, article])).values());
      });
      setHasMore(result.hasMore);
    } catch (caught) {
      if (id === requestId.current) setError(caught instanceof Error ? caught.message : "文章暂时无法加载。");
    } finally {
      if (id === requestId.current) {
        pending.current = false;
        setLoading(false);
      }
    }
  }, []);

  function selectCategory(category: string) {
    setSelectedCategory(category);
    pending.current = false;
    setArticles([]);
    setHasMore(false);
    void loadPage(category, 0, true);
  }

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      void loadPage(selectedCategory, articles.length, false);
    }, { rootMargin: "0px 0px 320px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [articles.length, hasMore, loadPage, selectedCategory]);

  return (
    <>
      <div aria-label="文章分类" className="article-category-tabs" role="group">
        <button aria-pressed={selectedCategory === "all"} className={`article-category-tab ${selectedCategory === "all" ? "bg-[#1B4332] text-[#ECFDF5] border-[#1B4332]" : "bg-white/60 text-zinc-700 border-zinc-200/80 hover:bg-white"}`} onClick={() => selectCategory("all")} type="button">全部</button>
        {categories.map((category) => (
          <button aria-pressed={selectedCategory === category.slug} className={`article-category-tab ${selectedCategory === category.slug ? "bg-[#1B4332] text-[#ECFDF5] border-[#1B4332]" : "bg-white/60 text-zinc-700 border-zinc-200/80 hover:bg-white"}`} key={category.slug} onClick={() => selectCategory(category.slug)} type="button">
            {category.name}
          </button>
        ))}
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {articles.length ? (
        <div aria-busy={loading} aria-live="polite" className="public-article-list">
          {articles.map((article) => {
            const category = categories.find(({ slug }) => slug === article.category);
            return (
              <article className="public-article-row" key={article.slug}>
                <div className="public-article-row-copy">
                  <div className="article-card-meta">
                    <span className={`category-label tone-${category?.tone ?? "blue"}`}>{category?.name ?? "未分类"}</span>
                    <time dateTime={article.publishedAt}>{article.publishedAt.replaceAll("-", ".")}</time>
                  </div>
                  <h3><Link className="text-[#111827] visited:text-[#111827] hover:text-[#1B4332] transition-colors" href={`/articles/${article.slug}`} rel="noreferrer" target="_blank">{article.title}</Link></h3>
                  <p>{getArticleSummaryLine(article.summary)}</p>
                  <div className="public-article-row-meta">
                    <span><Clock3 aria-hidden="true" size={13} />{article.readMinutes} 分钟</span>
                    <span><Bookmark aria-hidden="true" size={13} />{article.favoriteCount ?? 0}</span>
                    <span className="public-article-tags">{getTaxonomyDisplayNames(article.tags, tags).replaceAll("、", " #")}</span>
                  </div>
                </div>
                <Image
                  alt={`${article.title} 封面`}
                  className={`public-article-cover cover-${article.cover}`}
                  height={64}
                  src={getArticleCoverPath(article.cover)}
                  width={96}
                />
              </article>
            );
          })}
        </div>
      ) : <p className="form-help">{loading ? "正在加载文章…" : "该分类暂时没有已发布文章。"}</p>}
      {error ? <button className="button-secondary article-list-retry" onClick={() => void loadPage(selectedCategory, articles.length, articles.length === 0)} type="button">重试</button> : null}
      <div aria-hidden="true" className="article-list-sentinel" ref={sentinel} />
      {hasMore && loading ? <p className="article-list-loading" role="status">正在加载更多文章…</p> : null}
    </>
  );
}
