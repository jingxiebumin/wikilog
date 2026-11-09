"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpenText, CircleUserRound, Hash, Layers3, LogIn, LogOut, Settings } from "lucide-react";
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
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [accountMenuOpen]);

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
        <div className="account-menu" ref={accountMenuRef}>
          <button aria-expanded={accountMenuOpen} aria-haspopup="menu" className="account-menu-trigger" onClick={() => setAccountMenuOpen((current) => !current)} type="button">
            <CircleUserRound aria-hidden="true" size={19} strokeWidth={1.8} /><span>{session.displayName}</span>
          </button>
          {accountMenuOpen ? (
          <div className="account-menu-popover">
            <Link href="/account" onClick={() => setAccountMenuOpen(false)}><CircleUserRound aria-hidden="true" size={15} />账号设置</Link>
            {session.role === "admin" ? <Link href="/admin" onClick={() => setAccountMenuOpen(false)}><Settings aria-hidden="true" size={15} />管理员设置</Link> : null}
            <form action="/api/auth/logout" method="post"><button type="submit"><LogOut aria-hidden="true" size={15} />退出登录</button></form>
          </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
