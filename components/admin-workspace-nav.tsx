import Link from "next/link";
import { BookOpenText, BrainCircuit, Network, Settings2, UsersRound } from "lucide-react";

const links = [
  { href: "/admin/readers", label: "账号管理", icon: UsersRound },
  { href: "/admin/articles", label: "文章管理", icon: BookOpenText },
  { href: "/admin/ai", label: "AI 设置与问答", icon: BrainCircuit },
  { href: "/admin/wiki", label: "Wiki 管理", icon: Network },
  { href: "/admin/settings", label: "系统设置", icon: Settings2 },
];

export function AdminWorkspaceNav({ active }: { active?: string }) {
  return (
    <nav aria-label="管理员设置" className="flex flex-col gap-1.5">
      {links.map(({ href, label, icon: Icon }) => (
        <Link aria-current={active === href ? "page" : undefined} className={`inline-flex min-h-10 items-center gap-2 px-3 text-xs ${active === href ? "bg-emerald-900/12 !text-[#1B4332] font-semibold rounded-xl" : "text-zinc-700 hover:bg-emerald-900/10 hover:text-[#1B4332] rounded-xl transition-colors"}`} href={href} key={href}>
          <Icon aria-hidden="true" size={15} />{label}
        </Link>
      ))}
    </nav>
  );
}
