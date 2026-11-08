import Link from "next/link";
import { publicAuthEnabled } from "@/lib/auth/service";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function RegisterPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <section className="page account-page">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-mark" />读者账号</p>
        <h1>注册</h1>
        <p>邮箱只作为登录名和人工联系字段，不发送验证邮件。</p>
      </div>
      {!publicAuthEnabled ? <p className="account-notice">账号功能将在数据库和发布加固验收完成后开放。</p> : (
        <form className="account-form" action="/api/auth/register" method="post">
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <label>昵称<input required name="displayName" maxLength={80} autoComplete="name" /></label>
          <label>邮箱<input required name="email" type="email" maxLength={320} autoComplete="email" /></label>
          <label>密码<input required name="password" type="password" minLength={12} autoComplete="new-password" /></label>
          <label>确认密码<input required name="confirmation" type="password" minLength={12} autoComplete="new-password" /></label>
          <button type="submit">创建读者账号</button>
          <p className="form-help">已有账号？<Link href="/login">登录</Link></p>
        </form>
      )}
    </section>
  );
}
