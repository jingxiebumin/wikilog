"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, CircleUserRound, Hash, Layers3 } from "lucide-react";

const items = [
  { href: "/", label: "最新文章", icon: BookOpenText },
  { href: "/categories", label: "主题分类", icon: Layers3 },
  { href: "/tags", label: "标签索引", icon: Hash },
  { href: "/about", label: "关于作者", icon: CircleUserRound },
];

export function SiteNavigation({ className = "" }: { className?: string }) {
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
    </nav>
  );
}
