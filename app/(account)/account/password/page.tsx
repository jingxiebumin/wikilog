import { redirect } from "next/navigation";
import { requireSession, getOwnProfile } from "@/lib/auth/service";
import { PersonalCenter } from "@/components/personal-center";

export const dynamic = "force-dynamic";

export default async function PasswordPage() {
  let session;
  try {
    session = await requireSession({ allowPasswordReset: true });
  } catch {
    redirect("/login");
  }
  const profile = await getOwnProfile(session.id);
  return (
    <section className="page personal-center-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />账号</p><h1>个人中心</h1></div>
      {session.passwordResetRequired ? <p className="account-notice password-reset-notice">首次登录请先设置新密码，完成前无法使用其他功能。</p> : null}
      <PersonalCenter activeTab="password" forcePasswordChange={session.passwordResetRequired} initialProfile={profile} />
    </section>
  );
}
