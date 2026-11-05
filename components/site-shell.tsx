import Link from "next/link";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { SearchForm } from "@/components/search-form";
import { SiteNavigation } from "@/components/site-navigation";

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="site-frame">
      <aside className="sidebar">
        <Link aria-label="Wikilog 首页" className="brand" href="/">
          <span className="brand-mark"><BookOpenText aria-hidden="true" size={20} /></span>
          <span className="brand-word">wikilog<span>.</span></span>
        </Link>
        <p className="brand-caption">技术手记与系统观察</p>
        <SiteNavigation />
        <div className="sidebar-note">
          <span className="sidebar-note-mark" aria-hidden="true">W</span>
          <p>把复杂问题拆开，留下可复用的思路。</p>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" aria-hidden="true" />
          <span>持续写作中</span>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-label">
            <span className="topbar-kicker">独立技术写作</span>
            <span className="topbar-divider" aria-hidden="true" />
            <span>2026</span>
          </div>
          <div className="topbar-actions">
            <SearchForm id="top-search" />
            <Link aria-label="关于作者" className="topbar-about" href="/about" title="关于作者">
              <ArrowUpRight aria-hidden="true" size={17} />
            </Link>
          </div>
        </header>
        <div className="mobile-brand-row">
          <Link aria-label="Wikilog 首页" className="brand" href="/">
            <span className="brand-mark"><BookOpenText aria-hidden="true" size={19} /></span>
            <span className="brand-word">wikilog<span>.</span></span>
          </Link>
          <SearchForm id="mobile-search" />
        </div>
        <SiteNavigation className="mobile-nav" />
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
