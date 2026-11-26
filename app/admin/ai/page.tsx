import { redirect, notFound } from "next/navigation";
import { AuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/service";
import { getAdminQaSettings, getAdminQaSession, listAdminQaSessions } from "@/lib/qa";
import { AdminQa } from "@/components/admin-qa";
import { AdminLayout } from "@/components/admin/AdminLayout";

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
    <AdminLayout active="/admin/ai" description="管理问答功能和管理员会话。" title="AI 设置与问答">
      <AdminQa {...settings} initialMessages={firstSession?.messages ?? []} initialSessions={sessions} />
    </AdminLayout>
  );
}
