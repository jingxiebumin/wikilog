import { notFound, redirect } from "next/navigation";
import { ArticleBody } from "@/components/article-body";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { adminCurrentArticle } from "@/lib/articles/service";
import { ArticlePreviewActions } from "@/components/article-preview-actions";
import { listCategories, listTags } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export default async function AdminArticlePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  let actor;
  try { actor = await requireSession({ admin: true }); }
  catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }
  const { id } = await params;
  const article = await adminCurrentArticle(actor, id);
  if (!article) notFound();
  const [categories, tags] = await Promise.all([listCategories(), listTags()]);
  const categoryName = categories.find(({ slug }) => slug === article.category)?.name ?? article.category;
  const tagNames = new Map(tags.map(({ slug, name }) => [slug, name]));
  return <article className="page article-page admin-article-preview-page">
    <div className="preview-mode-banner"><span>预览模式</span><ArticlePreviewActions id={article.id} visibility={article.visibility} /></div>
    <header className="article-header">
      <div className="article-meta"><span>{categoryName}</span><time dateTime={article.publishedAt}>{article.publishedAt}</time><span>{article.readMinutes} 分钟阅读</span></div>
      <h1>{article.title}</h1>
      {article.summary ? <p className="article-summary">{article.summary}</p> : null}
      <div className="article-tag-list">{article.tags.map((tag) => <span key={tag}>#{tagNames.get(tag) ?? tag}</span>)}</div>
    </header>
    <ArticleBody blocks={article.content} />
  </article>;
}
