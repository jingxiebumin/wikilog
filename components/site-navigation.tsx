"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, CircleUserRound, Hash, Layers3, LogIn, Settings } from "lucide-react";
import type { UserRole } from "@/lib/auth/types";

const items = [
  { href: "/", label: "最新文章", icon: BookOpenText },
  { href: "/categories", label: "主题分类", icon: Layers3 },
  { href: "/tags", label: "标签索引", icon: Hash },
  { href: "/about", label: "关于作者", icon: CircleUserRound },
];

export function SiteNavigation({
  className = "",
  accountAvailable = false,
  session,
}: {
  className?: string;
  accountAvailable?: boolean;
  session?: { displayName: string; role: UserRole };
}) {
  const pathname = usePathname();

  return (
    <nav aria-label="主导航" className={`site-nav ${className}`}>
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className="site-nav-link"
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
      {accountAvailable && !session ? (
        <Link className="site-nav-link site-account-link" href="/login">
          <LogIn aria-hidden="true" size={18} strokeWidth={1.8} />
          <span>登录</span>
        </Link>
      ) : null}
      {session ? (
        <details className="account-menu">
          <summary aria-label="账号菜单"><CircleUserRound aria-hidden="true" size={19} strokeWidth={1.8} /><span>{session.displayName}</span></summary>
          <div className="account-menu-popover">
            <Link href="/account"><CircleUserRound aria-hidden="true" size={15} />账号设置</Link>
            {session.role === "admin" ? <Link href="/admin"><Settings aria-hidden="true" size={15} />管理员设置</Link> : null}
            <form action="/api/auth/logout" method="post"><button type="submit">退出登录</button></form>
          </div>
        </details>
      ) : null}
    </nav>
  );
}
