import Link from "next/link";
import { BookOpenText, BrainCircuit, ChevronLeft, UsersRound } from "lucide-react";

const links = [
  { href: "/admin/readers", label: "账号管理", icon: UsersRound },
  { href: "/admin/articles", label: "文章管理", icon: BookOpenText },
  { href: "/admin/ai", label: "AI 设置与问答", icon: BrainCircuit },
];

export function AdminWorkspaceNav({ active }: { active?: string }) {
  return (
    <nav aria-label="管理员设置" className="admin-workspace-nav">
      <Link className="admin-workspace-back" href="/admin"><ChevronLeft aria-hidden="true" size={15} />工作台</Link>
      {links.map(({ href, label, icon: Icon }) => (
        <Link aria-current={active === href ? "page" : undefined} href={href} key={href}>
          <Icon aria-hidden="true" size={15} />{label}
        </Link>
      ))}
    </nav>
  );
}
