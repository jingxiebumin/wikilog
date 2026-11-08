import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireSession();
  } catch {
    redirect("/login");
  }
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />受保护设置</p><h1>管理员设置</h1><p>账号管理操作会在服务端再次检查管理员角色。</p></div>
      <div className="admin-sections">
        <form className="account-form" action="/api/admin/readers" method="post">
          <h2>人工创建读者</h2>
          <label>昵称<input required name="displayName" maxLength={80} /></label>
          <label>邮箱<input required name="email" type="email" /></label>
          <label>初始密码<input required name="password" type="password" minLength={12} /></label>
          <button type="submit">创建读者</button>
        </form>
        <p className="form-help">密码重置需要读者 ID、线下身份确认和重置原因，请通过受保护的管理员 API 执行；临时密码只在成功响应中展示一次，审计记录不会保存它。</p>
      </div>
    </section>
  );
}
