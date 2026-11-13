import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/service";
import { AuthError } from "@/lib/auth/errors";
import Link from "next/link";
import { BookOpenText, BrainCircuit, UsersRound } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  try {
    await requireSession({ admin: true });
  } catch (error) {
    if (error instanceof AuthError && error.code === "FORBIDDEN") redirect("/account");
    redirect("/login");
  }
  return (
    <section className="page account-page">
      <div className="page-heading"><p className="eyebrow"><span className="eyebrow-mark" />管理员工作台</p><h1>博客设置</h1><p>选择要管理的内容。</p></div>
      <div className="admin-workspace-links">
        <Link href="/admin/readers"><UsersRound aria-hidden="true" size={20} /><span><strong>账号管理</strong><small>创建、编辑和维护读者账号</small></span></Link>
        <Link href="/admin/articles"><BookOpenText aria-hidden="true" size={20} /><span><strong>文章管理</strong><small>上传文章草稿、预览和发布</small></span></Link>
        <Link href="/admin/ai"><BrainCircuit aria-hidden="true" size={20} /><span><strong>AI 设置与问答</strong><small>模型配置、预算和管理员问答</small></span></Link>
      </div>
    </section>
  );
}
