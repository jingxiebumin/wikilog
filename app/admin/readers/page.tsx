import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { adminListReaders, requireSession } from "@/lib/auth/service";
import { AdminReaderManager } from "@/components/admin-reader-manager";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminReadersPage() {
  let operator;
  try {
    operator = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && error.code === "FORBIDDEN") redirect("/account");
    redirect("/login");
  }
  const readers = await adminListReaders(operator);
  return (
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/readers" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员工作台</p><h1>账号管理</h1><p>维护读者资料和账号状态。</p></div>
      <AdminReaderManager initialReaders={readers} />
    </section>
  );
}
