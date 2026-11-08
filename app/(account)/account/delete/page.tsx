import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function DeleteAccountPage() {
  try { await requireSession(); } catch { redirect("/login"); }
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />账号设置</p><h1>删除账号</h1><p>删除前请重新输入当前密码。此操作会移除账号关联的站内个人数据。</p></div>
      <form className="account-form" action="/api/auth/delete" method="post">
        <label>当前密码<input required name="currentPassword" type="password" autoComplete="current-password" /></label>
        <label>输入 DELETE 确认<input required name="confirmation" autoComplete="off" /></label>
        <button type="submit">确认删除账号</button>
      </form>
    </section>
  );
}
