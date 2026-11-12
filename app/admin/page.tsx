import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";
import { adminListReaders } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { AdminReaderManager } from "@/components/admin-reader-manager";
import { AdminArticleManager } from "@/components/admin-article-manager";
import { adminArticleList } from "@/lib/articles/service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let session;
  try {
    session = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && error.code === "FORBIDDEN") redirect("/account");
    redirect("/login");
  }
  const readers = await adminListReaders(session);
  const articles = await adminArticleList(session);
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />受保护设置</p><h1>管理员设置</h1><p>公网 HTTP 不启用账号或写操作；本站点管理仅供受保护的内部访问。</p></div>
      <AdminReaderManager initialReaders={readers} />
      <AdminArticleManager initialArticles={articles} />
    </section>
  );
}
