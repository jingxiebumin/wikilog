import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";
import { adminListReaders } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import { AdminReaderManager } from "@/components/admin-reader-manager";

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
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />受保护设置</p><h1>管理员设置</h1><p>账号管理操作会在服务端再次检查管理员角色。</p></div>
      <AdminReaderManager initialReaders={readers} />
    </section>
  );
}
