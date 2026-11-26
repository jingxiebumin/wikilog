import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { SiteNavigation } from "@/components/site-navigation";
import { BackToTop } from "@/components/back-to-top";
import { getCurrentSession, publicAuthEnabled } from "@/lib/auth/service";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  return (
    <div className="site-frame">
      <div className="main-column">
        <header className="topbar">
          <Link aria-label="Wikilog 首页" className="brand" href="/">
            <span className="brand-mark"><Image alt="" className="brand-logo" height={32} priority src="/logo.png" width={32} /></span>
            <span className="brand-word">wikilog<span>.</span></span>
          </Link>
          <SiteNavigation accountAvailable={publicAuthEnabled} session={session} />
          <div className="topbar-actions">
            <SearchForm id="top-search" />
          </div>
        </header>
        <main className="main-content">{children}</main>
        <footer className="site-footer">
          <span>© 2026 wikilog</span>
          <span>写给未来的技术备忘</span>
          <Link href="/about">联系与说明 <ArrowUpRight aria-hidden="true" size={13} /></Link>
        </footer>
        <BackToTop />
      </div>
    </div>
  );
}
