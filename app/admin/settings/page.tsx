import { notFound, redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { listAdminTaxonomy } from "@/lib/admin-settings/service";
import { AdminSettingsManager } from "@/components/admin-settings-manager";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

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
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/settings" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员设置</p><h1>系统设置</h1><p>维护文章使用的分类和标签。</p></div>
      <AdminSettingsManager initialTaxonomy={taxonomy} />
    </section>
  );
}
