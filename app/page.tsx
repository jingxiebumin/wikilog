import Link from "next/link";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { PublicArticleList } from "@/components/public-article-list";
import { listCategories, listPublishedArticlePage, listTags } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [page, categories, tags] = await Promise.all([
    listPublishedArticlePage("all", 10, 0),
    listCategories(),
    listTags(),
  ]);

  return (
    <div className="page home-page">
      <div className="home-intro">
        <div>
          <p className="eyebrow text-xs font-medium tracking-wide text-zinc-600"><span className="eyebrow-mark" /> 个人技术日志 <span className="eyebrow-year">2026 / 持续更新</span></p>
          <h1>把问题写清楚，<br /><em>让经验留下来。</em></h1>
        </div>
        <p className="home-intro-copy text-zinc-700">记录工程实践、数据检索与系统设计中的具体问题。少一点结论先行，多一点过程和依据。</p>
      </div>

      <div className="home-layout">
        <section className="home-main" aria-labelledby="latest-heading">
          <div className="section-heading">
            <div><p className="section-index text-xs font-medium tracking-wide text-zinc-600">01 / 文章</p><h2 id="latest-heading">全部文章</h2></div>
            <span className="result-count">{String(page.totalCount).padStart(2, "0")} 篇</span>
          </div>
          {page.totalCount ? <PublicArticleList initialPage={{ ...page, hasMore: page.articles.length < page.totalCount }} categories={categories} tags={tags} /> : (
            <div className="home-empty-state">
              <span className="home-empty-icon"><BookOpenText aria-hidden="true" size={19} strokeWidth={1.7} /></span>
              <div>
                <h3>还没有已发布的文章</h3>
                <p>目前数据库中没有公开文章。添加并发布文章后，内容会显示在这里。</p>
              </div>
            </div>
          )}
        </section>

        <aside className="home-aside">
          <section className="aside-section" aria-labelledby="topics-heading">
            <div className="aside-heading">
              <span className="section-index text-xs font-medium tracking-wide text-zinc-600">02 / 主题</span>
              <Link aria-label="查看全部分类" href="/categories" title="查看全部分类"><ArrowUpRight size={16} /></Link>
            </div>
            <h2 id="topics-heading">从这里开始</h2>
            <div className="topic-list">
              {categories.map((category, index) => {
                return (
                  <Link className="topic-row group" href={`/categories/${category.slug}`} key={category.slug}>
                    <span className={`topic-number tone-${category.tone} bg-emerald-900/10 text-[#1B4332]`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="topic-name">{category.name}</span>
                    <ArrowUpRight aria-hidden="true" className="topic-arrow ml-auto text-zinc-400 group-hover:text-[#1B4332] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" size={15} />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="aside-section aside-tags" aria-labelledby="tags-heading">
            <div className="aside-heading">
              <span className="section-index text-xs font-medium tracking-wide text-zinc-600">03 / 关键词</span>
              <Link aria-label="查看全部标签" href="/tags" title="查看全部标签"><ArrowUpRight size={16} /></Link>
            </div>
            <h2 id="tags-heading">最近在写</h2>
            <div className="tag-list">
              {tags.slice(0, 7).map((tag) => (
                <Link href={`/tags/${tag.slug}`} key={tag.slug}>#{tag.name}</Link>
              ))}
            </div>
          </section>

          <section className="aside-note">
            <span className="aside-note-label">写作索引 <span>W / 26</span></span>
            <p>代码会变，问题的来龙去脉值得留下。</p>
            <Link href="/about">关于这个站点 <ArrowUpRight aria-hidden="true" size={14} /></Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
