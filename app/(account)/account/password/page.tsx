import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function PasswordPage({ searchParams }: Props) {
  const { error } = await searchParams;
  try {
    await requireSession({ allowPasswordReset: true });
  } catch {
    redirect("/login");
  }
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />账号设置</p><h1>修改密码</h1><p>修改密码需要验证当前密码。</p></div>
      <form className="account-form" action="/api/auth/password" method="post">
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <label>当前密码<input required name="currentPassword" type="password" autoComplete="current-password" /></label>
        <label>新密码<input required name="password" type="password" minLength={12} autoComplete="new-password" /></label>
        <label>确认新密码<input required name="confirmation" type="password" minLength={12} autoComplete="new-password" /></label>
        <button type="submit">保存密码</button>
        <Link className="form-help" href="/account">返回账号设置</Link>
      </form>
    </section>
  );
}
