import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { getCategory, type Article } from "@/lib/content";

export function ArticleCard({ article, summary }: { article: Article; summary?: string }) {
  const category = getCategory(article.category);

  return (
    <article className="article-card">
      <Link aria-label={`阅读：${article.title}`} className="article-cover-link" href={`/articles/${article.slug}`}>
        <Image
          alt=""
          className={`article-cover cover-${article.cover}`}
          height={304}
          src={`/covers/${article.cover}.svg`}
          width={560}
        />
        <span aria-hidden="true" className="cover-arrow"><ArrowUpRight size={18} /></span>
      </Link>
      <div className="article-card-content">
        <div className="article-card-meta">
          <span className={`category-label tone-${category?.tone ?? "blue"}`}>{category?.name ?? "未分类"}</span>
          <time dateTime={article.publishedAt}>{article.publishedAt.replaceAll("-", ".")}</time>
        </div>
        <h3><Link href={`/articles/${article.slug}`}>{article.title}</Link></h3>
        <p>{summary ?? article.summary}</p>
        <div className="article-card-bottom">
          <span className="read-time"><Clock3 aria-hidden="true" size={14} />{article.readMinutes} 分钟</span>
          <Link aria-label={`阅读：${article.title}`} className="text-arrow" href={`/articles/${article.slug}`}>
            阅读文章 <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
