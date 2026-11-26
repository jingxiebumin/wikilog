import { notFound, redirect } from "next/navigation";
import { AdminWikiManager } from "@/components/admin-wiki-manager";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { adminArticleList } from "@/lib/articles/service";
import { listAdminWikiPages } from "@/lib/wiki/service";

export const dynamic = "force-dynamic";

export default async function AdminWikiPage() {
  let session;
  try {
    session = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }

  const [pages, articles] = await Promise.all([listAdminWikiPages(session), adminArticleList(session)]);
  const publishedArticles = articles
    .filter((article) => article.status === "published" && article.current && article.visibility === "visible")
    .map((article) => ({ id: article.id, slug: article.slug, title: article.title, versionNumber: article.versionNumber }));

  return (
    <AdminLayout active="/admin/wiki" description="维护主题页面、文章来源和已审核关系。" title="Wiki 管理">
      <AdminWikiManager initialPages={pages} publishedArticles={publishedArticles} />
    </AdminLayout>
  );
}
