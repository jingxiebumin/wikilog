import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  let session;
  try { session = await requireSession(); } catch { redirect("/login"); }
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />账号设置</p><h1>修改邮箱</h1><p>邮箱是登录名和人工联系字段，不发送验证邮件。</p></div>
      <form className="account-form" action="/api/auth/email" method="post">
        <label>当前邮箱<input readOnly value={session.email} /></label>
        <label>当前密码<input required name="currentPassword" type="password" autoComplete="current-password" /></label>
        <label>新邮箱<input required name="email" type="email" autoComplete="email" /></label>
        <button type="submit">保存邮箱</button>
      </form>
    </section>
  );
}
