import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { getCategory, type Article } from "@/lib/content";

export function ArticleCard({ article, summary, variant = "default" }: { article: Article; summary?: string; variant?: "default" | "compact" }) {
  const category = getCategory(article.category);
  const compact = variant === "compact";

  return (
    <article className={`article-card${compact ? " article-card-compact bg-white/75 backdrop-blur-xl border border-white/65 rounded-xl p-5" : ""}`}>
      {!compact ? (
        <Link aria-label={`阅读：${article.title}`} className="article-cover-link" href={`/articles/${article.slug}`} rel="noreferrer" target="_blank">
          <Image
            alt=""
            className={`article-cover cover-${article.cover}`}
            height={304}
            src={`/covers/${article.cover}.svg`}
            width={560}
          />
          <span aria-hidden="true" className="cover-arrow"><ArrowUpRight size={18} /></span>
        </Link>
      ) : null}
      <div className="article-card-content">
        <div className="article-card-meta">
          <span className={`category-label tone-${category?.tone ?? "blue"}`}>{category?.name ?? "未分类"}</span>
          <time dateTime={article.publishedAt}>{article.publishedAt.replaceAll("-", ".")}</time>
        </div>
        <h3><Link className="text-[#111827] visited:text-[#111827] hover:text-[#1B4332] transition-colors" href={`/articles/${article.slug}`} rel="noreferrer" target="_blank">{article.title}</Link></h3>
        <p>{summary ?? article.summary}</p>
        <div className="article-card-bottom">
          <span className="read-time"><Clock3 aria-hidden="true" size={14} />{article.readMinutes} 分钟</span>
          {!compact ? <Link aria-label={`阅读：${article.title}`} className="text-arrow" href={`/articles/${article.slug}`} rel="noreferrer" target="_blank">
            阅读文章 <ArrowUpRight aria-hidden="true" size={15} />
          </Link> : null}
        </div>
      </div>
    </article>
  );
}
