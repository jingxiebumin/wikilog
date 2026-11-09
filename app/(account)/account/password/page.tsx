import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";
import { PasswordForm } from "@/components/account-forms";

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
      <PasswordForm initialError={error} />
    </section>
  );
}
