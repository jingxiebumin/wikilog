import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpenText, Clock3, MoveDownRight } from "lucide-react";
import { ArticleCard } from "@/components/article-card";
import { listCategories, listPublishedArticles, listTags } from "@/lib/public-content";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [articles, categories, tags] = await Promise.all([
    listPublishedArticles(),
    listCategories(),
    listTags(),
  ]);
  const [featured, ...moreArticles] = articles;
  const featuredCategory = categories.find((category) => category.slug === featured?.category);

  return (
    <div className="page home-page">
      <div className="home-intro">
        <div>
          <p className="eyebrow"><span className="eyebrow-mark" /> 个人技术日志 <span className="eyebrow-year">2026 / 持续更新</span></p>
          <h1>把问题写清楚，<br /><em>让经验留下来。</em></h1>
        </div>
        <p className="home-intro-copy">记录工程实践、数据检索与系统设计中的具体问题。少一点结论先行，多一点过程和依据。</p>
      </div>

      <div className="home-layout">
        <section className="home-main" aria-labelledby="latest-heading">
          <div className="section-heading">
            <div>
              <p className="section-index">01 / 最近更新</p>
              <h2 id="latest-heading">最新文章</h2>
            </div>
            <span className="result-count">{String(articles.length).padStart(2, "0")} 篇</span>
          </div>

          {featured && (
            <article className="featured-article">
              <Link aria-label={`阅读：${featured.title}`} className="featured-cover-link" href={`/articles/${featured.slug}`}>
                <Image alt="" className={`featured-cover cover-${featured.cover}`} height={450} priority src={`/covers/${featured.cover}.svg`} width={780} />
                <span className="featured-index">LATEST NOTE <span>№ 0{articles.length}</span></span>
                <MoveDownRight aria-hidden="true" className="featured-mark" size={24} strokeWidth={1.5} />
              </Link>
              <div className="featured-copy">
                <div className="article-card-meta">
                  <span className={`category-label tone-${featuredCategory?.tone ?? "blue"}`}>{featuredCategory?.name ?? "未分类"}</span>
                  <time dateTime={featured.publishedAt}>{featured.publishedAt.replaceAll("-", ".")}</time>
                </div>
                <h3><Link href={`/articles/${featured.slug}`}>{featured.title}</Link></h3>
                <p>{featured.summary}</p>
                <div className="featured-bottom">
                  <span><Clock3 aria-hidden="true" size={14} /> {featured.readMinutes} 分钟阅读</span>
                  <Link href={`/articles/${featured.slug}`}>阅读全文 <ArrowRight aria-hidden="true" size={15} /></Link>
                </div>
              </div>
            </article>
          )}

          {featured ? (
            <div className="article-grid">
              {moreArticles.map((article) => <ArticleCard article={article} key={article.slug} />)}
            </div>
          ) : (
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
              <span className="section-index">02 / 主题</span>
              <Link aria-label="查看全部分类" href="/categories" title="查看全部分类"><ArrowUpRight size={16} /></Link>
            </div>
            <h2 id="topics-heading">从这里开始</h2>
            <div className="topic-list">
              {categories.map((category, index) => {
                const count = articles.filter((article) => article.category === category.slug).length;
                return (
                  <Link className="topic-row" href={`/categories/${category.slug}`} key={category.slug}>
                    <span className={`topic-number tone-${category.tone}`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="topic-name">{category.name}</span>
                    <span className="topic-count">{count}</span>
                    <ArrowUpRight aria-hidden="true" className="topic-arrow" size={15} />
                  </Link>
                );
              })}
            </div>
          </section>

          <section className="aside-section aside-tags" aria-labelledby="tags-heading">
            <div className="aside-heading">
              <span className="section-index">03 / 关键词</span>
              <Link aria-label="查看全部标签" href="/tags" title="查看全部标签"><ArrowUpRight size={16} /></Link>
            </div>
            <h2 id="tags-heading">最近在写</h2>
            <div className="tag-list">
              {tags.filter((tag) => articles.some((article) => article.tags.includes(tag.slug))).slice(0, 7).map((tag) => (
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
