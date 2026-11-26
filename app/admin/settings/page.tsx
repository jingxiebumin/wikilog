import { notFound, redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { listAdminTaxonomy } from "@/lib/admin-settings/service";
import { AdminSettingsManager } from "@/components/admin-settings-manager";
import { AdminLayout } from "@/components/admin/AdminLayout";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  let session;
  try {
    session = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }
  const taxonomy = await listAdminTaxonomy(session);
  return (
    <AdminLayout active="/admin/settings" description="维护文章使用的分类和标签。" title="系统设置">
      <AdminSettingsManager initialTaxonomy={taxonomy} />
    </AdminLayout>
  );
}
