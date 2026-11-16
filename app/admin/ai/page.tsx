import { redirect, notFound } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { getAdminQaSettings, getAdminQaSession, listAdminQaSessions } from "@/lib/qa";
import { AdminQa } from "@/components/admin-qa";
import { AdminWorkspaceNav } from "@/components/admin-workspace-nav";

export const dynamic = "force-dynamic";

export default async function AdminAiPage() {
  let operator;
  try {
    operator = await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) notFound();
    redirect("/login");
  }
  const settings = getAdminQaSettings();
  const sessions = settings.enabled ? await listAdminQaSessions(operator) : [];
  const firstSession = sessions[0] ? await getAdminQaSession(operator, sessions[0].id) : undefined;
  return (
    <section className="page account-page admin-section-page">
      <AdminWorkspaceNav active="/admin/ai" />
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员设置</p><h1>AI 设置与问答</h1></div>
      <AdminQa {...settings} initialMessages={firstSession?.messages ?? []} initialSessions={sessions} />
    </section>
  );
}
