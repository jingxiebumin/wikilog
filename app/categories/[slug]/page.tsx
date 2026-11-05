import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { EmptyState } from "@/components/empty-state";
import { categories, getCategory, getCategoryArticles } from "@/lib/content";

type CategoryPageProps = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return categories.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  return { title: category?.name ?? "分类" };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  const categoryArticles = getCategoryArticles(slug);

  return (
    <div className="page listing-page">
      <Link className="back-link" href="/categories"><ArrowLeft aria-hidden="true" size={15} />全部分类</Link>
      <div className="page-heading compact-heading">
        <p className="eyebrow"><span className={`eyebrow-dot tone-${category.tone}`} /> 主题分类 / {categoryArticles.length} 篇</p>
        <h1>{category.name}</h1>
        <p>{category.description}</p>
      </div>
      {categoryArticles.length ? (
        <div className="article-grid listing-grid">{categoryArticles.map((article) => <ArticleCard article={article} key={article.slug} />)}</div>
      ) : (
        <EmptyState title="这个分类还没有文章" message="新的记录整理好后，会出现在这里。" backHref="/categories" backLabel="返回分类" />
      )}
    </div>
  );
}
