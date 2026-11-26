import { redirect, notFound } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { adminArticleFormOptions, adminCurrentArticleList } from "@/lib/articles/service";
import { AdminArticleManager } from "@/components/admin-article-manager";
import { AdminLayout } from "@/components/admin/AdminLayout";

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
    <AdminLayout active="/admin/articles" description="维护文章内容和公开状态。" title="文章管理">
      <AdminArticleManager initialResult={result} categories={options.categories} tags={options.tags} />
    </AdminLayout>
  );
}
