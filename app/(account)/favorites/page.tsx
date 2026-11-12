import { redirect } from "next/navigation";
import { ArrowUpRight, Bookmark } from "lucide-react";
import Link from "next/link";
import { ArticleCard } from "@/components/article-card";
import { requireSession } from "@/lib/auth/service";
import { readerFavorites } from "@/lib/favorites/service";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  let session;
  try {
    session = await requireSession();
  } catch {
    redirect("/login");
  }
  if (session.role !== "reader") redirect("/account");
  const favorites = await readerFavorites(session);

  return (
    <section className="page favorites-page">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-mark" />读者收藏</p>
        <h1>收藏文章</h1>
        <p>只显示目前公开的文章。</p>
      </div>
      {favorites.length ? <div className="article-grid">{favorites.map((article) => <ArticleCard article={article} key={article.slug} />)}</div> : (
        <div className="favorites-empty"><Bookmark aria-hidden="true" size={20} /><div><h2>还没有收藏</h2><p>阅读文章时可以将它加入收藏。</p></div><Link href="/">浏览文章 <ArrowUpRight aria-hidden="true" size={14} /></Link></div>
      )}
    </section>
  );
}
