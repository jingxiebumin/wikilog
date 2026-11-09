import { publicAuthEnabled } from "@/lib/auth/service";
import { LoginForm } from "@/components/account-forms";
import Link from "next/link";

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
        <>
          <LoginForm initialError={error} />
          <p className="form-help account-form-footer">没有账号？<Link href="/register">注册读者账号</Link>。忘记密码请联系管理员进行线下身份确认。</p>
        </>
      )}
    </section>
  );
}
