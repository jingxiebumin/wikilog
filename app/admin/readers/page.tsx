import { redirect, notFound } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { adminListReaders, requireSession } from "@/lib/auth/service";
import { AdminReaderManager } from "@/components/admin-reader-manager";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminReadersPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  let operator;
  try {
    operator = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }
  const params = await searchParams;
  const includeDeleted = params.status === "deleted";
  const readers = await adminListReaders(operator, { includeDeleted, search: params.search ?? "" });
  return (
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/readers" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员设置</p><h1>账号管理</h1><p>创建、编辑、重置和维护读者账号。</p></div>
      <AdminReaderManager key={`${params.status ?? "active"}:${params.search ?? ""}`} initialReaders={readers} initialSearch={params.search ?? ""} includeDeleted={includeDeleted} />
    </section>
  );
}
