import { redirect } from "next/navigation";
import { requireSession, getOwnProfile } from "@/lib/auth/service";
import { PersonalCenter } from "@/components/personal-center";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  let session;
  try {
    session = await requireSession({ allowPasswordReset: true });
  } catch {
    redirect("/login");
  }
  if (session.passwordResetRequired) redirect("/account/password");
  const profile = await getOwnProfile(session.id);
  return <section className="page personal-center-page"><div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />账号</p><h1>个人中心</h1></div><PersonalCenter initialProfile={profile} /></section>;
}
