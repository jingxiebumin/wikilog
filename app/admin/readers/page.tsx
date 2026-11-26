import { redirect, notFound } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { adminListReaders, requireSession } from "@/lib/auth/service";
import { AdminReaderManager } from "@/components/admin-reader-manager";
import { AdminLayout } from "@/components/admin/AdminLayout";

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
    <AdminLayout active="/admin/readers" description="创建、编辑、重置和维护读者账号。" title="账号管理">
      <AdminReaderManager key={`${params.status ?? "active"}:${params.search ?? ""}`} initialReaders={readers} initialSearch={params.search ?? ""} includeDeleted={includeDeleted} />
    </AdminLayout>
  );
}
