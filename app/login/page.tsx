import Link from "next/link";
import { publicAuthEnabled } from "@/lib/auth/service";

type Props = { searchParams: Promise<{ error?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  return (
    <section className="page account-page">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-mark" />读者账号</p>
        <h1>登录</h1>
        <p>登录后管理资料，并在功能开放时使用读者服务。</p>
      </div>
      {!publicAuthEnabled ? <p className="account-notice">账号功能将在数据库和发布加固验收完成后开放。</p> : (
        <form className="account-form" action="/api/auth/login" method="post">
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <label>邮箱<input required name="email" type="email" autoComplete="email" /></label>
          <label>密码<input required name="password" type="password" autoComplete="current-password" /></label>
          <button type="submit">登录</button>
          <p className="form-help">没有账号？<Link href="/register">注册读者账号</Link></p>
          <p className="form-help">忘记密码请联系管理员进行线下身份确认。</p>
        </form>
      )}
    </section>
  );
}
