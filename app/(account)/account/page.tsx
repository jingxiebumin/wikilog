import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  let session;
  try {
    session = await requireSession({ allowPasswordReset: true });
  } catch {
    redirect("/login");
  }
  if (session.passwordResetRequired) redirect("/account/password");
  return (
    <section className="page account-page">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-mark" />账号设置</p>
        <h1>{session.displayName}</h1>
        <p>{session.email} · {session.role === "admin" ? "管理员" : "读者"}</p>
      </div>
      <div className="account-links">
        <Link className="button-link" href="/account/profile">修改邮箱</Link>
        <Link className="button-link" href="/account/password">修改密码</Link>
        {session.role === "reader" ? <Link className="button-link" href="/favorites">我的收藏</Link> : null}
        <Link className="button-link" href="/account/delete">删除账号</Link>
        {session.role === "admin" ? <Link className="button-link" href="/admin">管理员设置</Link> : null}
      </div>
      <form action="/api/auth/logout" method="post"><button className="button-link" type="submit">退出登录</button></form>
    </section>
  );
}
