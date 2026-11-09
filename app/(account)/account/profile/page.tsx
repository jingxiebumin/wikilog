import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";
import { EmailForm } from "@/components/account-forms";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />账号设置</p><h1>修改邮箱</h1><p>邮箱是登录名和人工联系字段，不发送验证邮件。</p></div>
      <EmailForm currentEmail={session.email} />
    </section>
  );
}
