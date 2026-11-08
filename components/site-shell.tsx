import Link from "next/link";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { SiteNavigation } from "@/components/site-navigation";
import { getCurrentSession, publicAuthEnabled } from "@/lib/auth/service";

export async function SiteShell({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  return (
    <div className="site-frame">
      <div className="main-column">
        <header className="topbar">
          <Link aria-label="Wikilog 首页" className="brand" href="/">
            <span className="brand-mark"><BookOpenText aria-hidden="true" size={20} /></span>
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
      </div>
    </div>
  );
}
