import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, Hash } from "lucide-react";
import { ArticleBody } from "@/components/article-body";
import { ArticleCard } from "@/components/article-card";
import { getCategory, findPublishedArticle, publishedArticles } from "@/lib/content";

type ArticlePageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return publishedArticles().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = findPublishedArticle(slug);
  return article ? { title: article.title, description: article.summary } : { title: "文章未找到" };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = findPublishedArticle(slug);
  if (!article) notFound();

  const category = getCategory(article.category);
  const relatedArticles = publishedArticles()
    .filter((item) => item.slug !== article.slug && item.category === article.category)
    .slice(0, 2);

  return (
    <div className="page article-page">
      <Link className="back-link" href="/"><ArrowLeft aria-hidden="true" size={15} />所有文章</Link>
      <article>
        <header className="article-header">
          <p className="eyebrow"><span className={`eyebrow-dot tone-${category?.tone ?? "blue"}`} /> {category?.name ?? "文章"} / ARTICLE</p>
          <h1>{article.title}</h1>
          <p className="article-deck">{article.summary}</p>
          <div className="article-byline">
            <span className="byline-author"><span className="author-monogram">W</span><span>Wikilog 编辑</span></span>
            <span className="byline-divider" aria-hidden="true" />
            <time dateTime={article.publishedAt}>{article.publishedAt.replaceAll("-", ".")}</time>
            <span className="byline-divider" aria-hidden="true" />
            <span><Clock3 aria-hidden="true" size={14} />{article.readMinutes} 分钟</span>
          </div>
        </header>

        <figure className="article-hero-figure">
          <Image alt="" className={`article-hero-image cover-${article.cover}`} height={620} priority src={`/covers/${article.cover}.svg`} width={1200} />
          <figcaption><span>W / {article.publishedAt.slice(0, 4)}</span><span>技术手记 · {category?.name}</span></figcaption>
        </figure>

        <div className="article-reading-layout">
          <aside className="article-aside">
            <span className="article-aside-label">本文关键词</span>
            <div className="article-tag-list">
              {article.tags.map((tag) => <Link href={`/tags/${tag}`} key={tag}><Hash aria-hidden="true" size={12} />{tag}</Link>)}
            </div>
            <Link className="article-aside-category" href={`/categories/${article.category}`}>
              更多{category?.name} <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </aside>
          <ArticleBody blocks={article.body} />
        </div>
      </article>

      {relatedArticles.length > 0 && (
        <section className="related-section" aria-labelledby="related-heading">
          <div className="section-heading">
            <div><p className="section-index">继续阅读 / {category?.name}</p><h2 id="related-heading">相关记录</h2></div>
            <Link className="text-arrow" href={`/categories/${article.category}`}>查看分类 <ArrowUpRight aria-hidden="true" size={15} /></Link>
          </div>
          <div className="article-grid">{relatedArticles.map((item) => <ArticleCard article={item} key={item.slug} />)}</div>
        </section>
      )}
    </div>
  );
}
