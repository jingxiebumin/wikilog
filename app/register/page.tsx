import { publicAuthEnabled } from "@/lib/auth/service";
import { RegisterForm } from "@/components/account-forms";
import Link from "next/link";

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
        <>
          <RegisterForm initialError={error} />
          <p className="form-help account-form-footer">已有账号？<Link href="/login">登录</Link></p>
        </>
      )}
    </section>
  );
}
