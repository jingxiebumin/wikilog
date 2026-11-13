import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { adminArticleList } from "@/lib/articles/service";
import { AdminArticleManager } from "@/components/admin-article-manager";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminArticlesPage() {
  let operator;
  try {
    operator = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && error.code === "FORBIDDEN") redirect("/account");
    redirect("/login");
  }
  const articles = await adminArticleList(operator);
  return (
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/articles" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员工作台</p><h1>文章管理</h1><p>上传草稿，检查预览后再发布。</p></div>
      <AdminArticleManager initialArticles={articles} />
    </section>
  );
}
