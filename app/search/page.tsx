import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Search, SearchX } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { SearchForm } from "@/components/search-form";
import { searchArticles } from "@/lib/content";

export const metadata: Metadata = { title: "搜索" };

type SearchPageProps = { searchParams: Promise<{ q?: string | string[] }> };

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "";
  const results = searchArticles(query);

  return (
    <div className="page search-page">
      <div className="page-heading search-heading">
        <p className="eyebrow"><span className="eyebrow-mark" /> 全文索引 / SEARCH</p>
        <h1>搜索文章</h1>
        <p>在标题与正文中查找相关记录。</p>
      </div>
      <div className="search-main-form"><SearchForm id="results-search" query={query} /></div>
      {query.trim() ? (
        <section aria-live="polite" aria-labelledby="search-results-heading">
          <div className="section-heading search-results-heading">
            <div>
              <p className="section-index">检索结果</p>
              <h2 id="search-results-heading">“{query.trim()}”</h2>
            </div>
            <span className="result-count">{results.length} 篇</span>
          </div>
          {results.length ? (
            <div className="article-grid listing-grid">{results.map(({ article, matchType, snippet }) => (
              <div className="search-result" key={article.slug}>
                <span className={`match-label ${matchType === "title" ? "match-title" : "match-body"}`}>
                  {matchType === "title" ? "标题命中" : "正文命中"}
                </span>
                <ArticleCard article={article} summary={snippet} />
              </div>
            ))}</div>
          ) : (
            <div className="search-empty">
              <SearchX aria-hidden="true" size={23} />
              <div><h3>没有找到匹配文章</h3><p>试试缩短关键词，或换一个相关术语。</p></div>
              <Link href="/categories">浏览主题 <ArrowUpRight aria-hidden="true" size={15} /></Link>
            </div>
          )}
        </section>
      ) : (
        <div className="search-prompt">
          <span><Search aria-hidden="true" size={18} /></span>
          <p>输入关键词开始检索</p>
        </div>
      )}
    </div>
  );
}
