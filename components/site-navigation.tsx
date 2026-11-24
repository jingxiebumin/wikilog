"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenText, Bookmark, CircleUserRound, Hash, LogIn, LogOut, Network, Settings } from "lucide-react";
import type { UserRole } from "@/lib/auth/types";

const items = [
  { href: "/", label: "首页", icon: BookOpenText },
  { href: "/tags", label: "标签", icon: Hash },
  { href: "/wiki", label: "知识图谱", icon: Network },
  { href: "/about", label: "关于", icon: CircleUserRound },
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
  const [avatarUnavailable, setAvatarUnavailable] = useState(false);
  const [focusedMenuItemIndex, setFocusedMenuItemIndex] = useState(0);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<(HTMLAnchorElement | HTMLButtonElement)[]>([]);

  // 菜单项列表 - 使用 useMemo 避免每次渲染都重建
  const menuItems = useMemo(() => [
    { type: "link" as const, href: "/account", label: "个人中心", icon: CircleUserRound },
    { type: "link" as const, href: "/favorites", label: "我的收藏", icon: Bookmark },
    ...(session?.role === "admin" ? [{ type: "link" as const, href: "/admin", label: "管理员设置", icon: Settings }] : []),
    { type: "button" as const, label: "退出登录", icon: LogOut },
  ], [session?.role]);

  // 处理菜单键盘交互
  const handleMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!accountMenuOpen) return;

    switch (e.key) {
      case "Escape":
        setAccountMenuOpen(false);
        // 焦点回到触发器
        const trigger = accountMenuRef.current?.querySelector("button[aria-expanded]") as HTMLButtonElement;
        trigger?.focus();
        e.preventDefault();
        break;

      case "ArrowDown":
        e.preventDefault();
        setFocusedMenuItemIndex((prev) => (prev + 1) % menuItems.length);
        break;

      case "ArrowUp":
        e.preventDefault();
        setFocusedMenuItemIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
        break;

      case "Home":
        e.preventDefault();
        setFocusedMenuItemIndex(0);
        break;

      case "End":
        e.preventDefault();
        setFocusedMenuItemIndex(menuItems.length - 1);
        break;
    }
  };

  // 焦点管理
  useEffect(() => {
    if (accountMenuOpen && menuItemsRef.current[focusedMenuItemIndex]) {
      menuItemsRef.current[focusedMenuItemIndex].focus();
    }
  }, [focusedMenuItemIndex, accountMenuOpen]);

  // 菜单打开时自动焦焦到第一项
  useEffect(() => {
    if (accountMenuOpen) {
      setFocusedMenuItemIndex(0);
    }
  }, [accountMenuOpen]);

  // 点击外部关闭菜单
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
        <div className="account-menu" ref={accountMenuRef} onKeyDown={handleMenuKeyDown}>
          <button
            aria-expanded={accountMenuOpen}
            aria-haspopup="menu"
            className="account-menu-trigger"
            onClick={() => setAccountMenuOpen((current) => !current)}
            type="button"
          >
            {avatarUnavailable ? (
              <CircleUserRound aria-hidden="true" size={19} strokeWidth={1.8} />
            ) : (
              <Image
                alt=""
                className="nav-avatar"
                height={22}
                onError={() => setAvatarUnavailable(true)}
                src="/api/auth/avatar"
                unoptimized
                width={22}
              />
            )}
            <span>{session.displayName}</span>
          </button>
          {accountMenuOpen ? (
            <div
              className="account-menu-popover"
              role="menu"
              aria-label="账户菜单"
            >
              {menuItems.map((item, index) => {
                if (item.type === "link") {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setAccountMenuOpen(false)}
                      role="menuitem"
                      ref={(el) => {
                        if (el) menuItemsRef.current[index] = el;
                      }}
                      tabIndex={focusedMenuItemIndex === index ? 0 : -1}
                    >
                      <Icon aria-hidden="true" size={15} />
                      {item.label}
                    </Link>
                  );
                } else {
                  const Icon = item.icon;
                  return (
                    <form
                      key="logout"
                      action="/api/auth/logout"
                      method="post"
                      style={{ width: "100%" }}
                    >
                      <button
                        type="submit"
                        role="menuitem"
                        ref={(el) => {
                          if (el) menuItemsRef.current[index] = el;
                        }}
                        tabIndex={focusedMenuItemIndex === index ? 0 : -1}
                        style={{ width: "100%", justifyContent: "flex-start" }}
                      >
                        <Icon aria-hidden="true" size={15} />
                        {item.label}
                      </button>
                    </form>
                  );
                }
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}
