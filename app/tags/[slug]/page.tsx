import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { EmptyState } from "@/components/empty-state";
import { getTag, getTagArticles, tagCatalog } from "@/lib/content";

type TagPageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return tagCatalog.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tag = getTag(slug);
  return { title: tag?.name ?? "标签" };
}

export default async function TagPage({ params }: TagPageProps) {
  const { slug } = await params;
  const tag = getTag(slug);
  if (!tag) notFound();
  const tagArticles = getTagArticles(slug);

  return (
    <div className="page listing-page">
      <Link className="back-link" href="/tags"><ArrowLeft aria-hidden="true" size={15} />全部标签</Link>
      <div className="page-heading compact-heading">
        <p className="eyebrow"><span className="eyebrow-mark" /> 标签索引 / {tagArticles.length} 篇</p>
        <h1><span className="heading-hash">#</span>{tag.name}</h1>
        <p>围绕「{tag.name}」的文章记录。</p>
      </div>
      {tagArticles.length ? (
        <div className="article-grid listing-grid">{tagArticles.map((article) => <ArticleCard article={article} key={article.slug} />)}</div>
      ) : (
        <EmptyState title="这个标签还没有文章" message="新的记录整理好后，会出现在这里。" backHref="/tags" backLabel="返回标签" />
      )}
    </div>
  );
}
