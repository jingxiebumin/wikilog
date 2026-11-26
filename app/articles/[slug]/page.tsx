import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Clock3, Hash } from "lucide-react";
import { ArticleBody, getArticleHeadings } from "@/components/article-body";
import { ArticleToc } from "@/components/article-toc";
import { ArticleCard } from "@/components/article-card";
import { FavoriteButton } from "@/components/favorite-button";
import { getCurrentSession } from "@/lib/auth/service";
import { getAdminQaSettings } from "@/lib/qa";
import { readerHasFavorite } from "@/lib/favorites/service";
import { getCategoryBySlug, getPublishedArticle, listPublishedArticles, listTags } from "@/lib/public-content";

type ArticlePageProps = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  return article ? { title: article.title, description: article.summary } : { title: "文章未找到" };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getPublishedArticle(slug);
  if (!article) notFound();

  const [category, allArticles, tagOptions] = await Promise.all([
    getCategoryBySlug(article.category),
    listPublishedArticles(),
    listTags(),
  ]);
  const tagNames = new Map(tagOptions.map(({ slug, name }) => [slug, name]));
  const relatedArticles = [...new Map(allArticles
    .filter((item) => item.slug !== article.slug && item.category === article.category)
    .map((item) => [item.slug, item])).values()]
    .slice(0, 2);
  const recommendedArticles = [...new Map(allArticles
    .filter((item) => item.slug !== article.slug)
    .map((item) => [item.slug, item])).values()]
    .sort((left, right) => {
      const relevance = (candidate: typeof article) =>
        Number(candidate.category === article.category) * 2
        + candidate.tags.filter((tag) => article.tags.includes(tag)).length;
      return relevance(right) - relevance(left) || right.publishedAt.localeCompare(left.publishedAt);
    })
    .slice(0, 5);
  const bodyBlocks = article.body[0]?.type === "heading" && article.body[0].text === article.title
    ? article.body.slice(1)
    : article.body;
  const headings = getArticleHeadings(bodyBlocks);
  const session = await getCurrentSession();
  const qaSettings = session?.role === "admin" ? getAdminQaSettings() : { enabled: false };
  const favorite = session && !session.passwordResetRequired
    ? await readerHasFavorite(session, article.slug)
    : false;

  return (
    <div className="page article-page">
      <Link className="back-link" href="/"><ArrowLeft aria-hidden="true" size={15} />所有文章</Link>
      <article>
        <header className="article-header pb-8">
          <p className="eyebrow"><span className={`eyebrow-dot tone-${category?.tone ?? "blue"}`} /> {category?.name ?? "文章"} / ARTICLE</p>
          <h1>{article.title}</h1>
          <p className="article-deck">{article.summary}</p>
          <div className="article-byline">
            <span className="byline-author"><span className="author-monogram">W</span><span>Wikilog 编辑</span></span>
            <span className="byline-divider" aria-hidden="true" />
            <time dateTime={article.publishedAt}>{article.publishedAt.replaceAll("-", ".")}</time>
            <span className="byline-divider" aria-hidden="true" />
            <span><Clock3 aria-hidden="true" size={14} />{article.readMinutes} 分钟</span>
            {session && !session.passwordResetRequired
              ? <FavoriteButton initialFavorite={favorite} slug={article.slug} />
              : !session ? <Link className="favorite-login-link" href="/login">登录后收藏</Link> : null}
            {session?.role === "admin" && !session.passwordResetRequired && qaSettings.enabled
              ? <Link className="article-qa-link" href={`/admin/ai?question=${encodeURIComponent(`请基于《${article.title}》的原文回答：`)}`}>基于本文提问</Link>
              : null}
          </div>
        </header>

        <div className="article-reading-layout mx-auto grid max-w-[1200px] grid-cols-1 items-start gap-6 px-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="article-aside sticky top-24 self-start space-y-4">
            <div className="space-y-4 rounded-2xl border border-white/65 bg-white/75 p-5 backdrop-blur-xl">
              <ArticleToc headings={headings} />
              <div className="article-aside-keywords">
                <span className="article-aside-label">本文关键词</span>
                <div className="article-tag-list">
                  {article.tags.map((tag) => <Link href={`/tags/${tag}`} key={tag}><Hash aria-hidden="true" size={12} />{tagNames.get(tag) ?? tag}</Link>)}
                </div>
              </div>
              <Link className="inline-flex items-center gap-1 text-zinc-600 transition-colors hover:text-[#1B4332]" href="/categories/engineering" rel="noopener noreferrer" target="_blank">
                更多工程实践 <ArrowUpRight aria-hidden="true" size={14} />
              </Link>
            </div>
            <section className="rounded-2xl border border-white/65 bg-white/75 p-5 shadow-sm backdrop-blur-xl" aria-labelledby="article-recommendations-heading">
              <h2 className="mb-3 text-sm font-semibold text-gray-900" id="article-recommendations-heading">相关推荐</h2>
              <ul className="m-0 list-none p-0">
                {recommendedArticles.map((item) => (
                  <li key={item.slug}>
                    <Link className="group block border-b border-zinc-200/60 py-2 last:border-none" href={`/articles/${item.slug}`} rel="noopener noreferrer" target="_blank">
                      <span className="line-clamp-2 text-[13px] leading-snug text-zinc-700 transition-colors group-hover:text-[#1B4332]">{item.title}</span>
                      <time className="mt-1 block text-[11px] text-zinc-400" dateTime={item.publishedAt}>{item.publishedAt.replaceAll("-", ".")}</time>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
          <div className="article-reading-card rounded-2xl border border-white/65 bg-white/75 p-8 shadow-sm backdrop-blur-xl md:p-10">
            <ArticleBody blocks={bodyBlocks} />
          </div>
        </div>
      </article>

      {relatedArticles.length > 0 && (
        <section className="related-section" aria-labelledby="related-heading">
          <div className="section-heading">
            <div><p className="section-index">继续阅读 / {category?.name}</p><h2 id="related-heading">相关记录</h2></div>
            <Link className="inline-flex items-center gap-1 text-zinc-600 transition-colors hover:text-[#1B4332]" href={`/categories/${article.category}`} rel="noopener noreferrer" target="_blank">查看分类 <ArrowUpRight aria-hidden="true" size={15} /></Link>
          </div>
          <div className="article-grid">{relatedArticles.map((item) => <ArticleCard article={item} key={item.slug} variant="compact" />)}</div>
        </section>
      )}
    </div>
  );
}
