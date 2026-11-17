import { redirect, notFound } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { adminArticleFormOptions, adminCurrentArticleList } from "@/lib/articles/service";
import { AdminArticleManager } from "@/components/admin-article-manager";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  let operator;
  try {
    operator = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }
  const [result, options] = await Promise.all([adminCurrentArticleList(operator), adminArticleFormOptions(operator)]);
  return (
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/articles" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员设置</p><h1>文章管理</h1><p>维护文章内容和公开状态。</p></div>
      <AdminArticleManager initialResult={result} categories={options.categories} tags={options.tags} />
    </section>
  );
}
