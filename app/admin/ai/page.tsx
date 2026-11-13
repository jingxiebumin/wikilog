import { redirect } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  try {
    await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && error.code === "FORBIDDEN") redirect("/account");
    redirect("/login");
  }
  return (
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/ai" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员工作台</p><h1>AI 设置与问答</h1><p>此区域将在问答服务完成数据政策、用量和权限验收后开放。</p></div>
      <p className="admin-feature-status">当前尚未启用问答。只有管理员可以使用该功能。</p>
    </section>
  );
}
