import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { PublishedWikiPage } from "@/lib/wiki/repository";
import styles from "@/app/wiki/wiki.module.css";

export function WikiTopicContent({ page }: { page: PublishedWikiPage }) {
  return (
    <article className={styles.topic}>
      <Link className="back-link" href="/wiki"><ArrowLeft aria-hidden="true" size={15} />知识图谱</Link>
      <header className={styles.topicHeader}>
        <p className="eyebrow"><span className="eyebrow-dot tone-green text-[#1B4332]" /> WIKI / TOPIC</p>
        <h1>{page.title}</h1>
      </header>
      <div className={styles.topicBody}>{page.body}</div>

      {page.relatedPages.length ? (
        <section aria-labelledby="wiki-related-heading" className={styles.topicSection}>
          <h2 id="wiki-related-heading">相关主题</h2>
          <ul className={styles.topicLinks}>
            {page.relatedPages.map((related) => (
              <li key={related.slug}><Link href={`/wiki/${related.slug}`}>{related.title}<ArrowUpRight aria-hidden="true" size={14} /></Link></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="wiki-sources-heading" className={`${styles.topicSection} ${styles.sourceSection} mt-8 rounded-xl border border-emerald-900/10 bg-emerald-950/[0.04] p-4`}>
        <h2 id="wiki-sources-heading">原文来源</h2>
        {page.sources.length ? (
          <ul className={styles.topicLinks}>
            {page.sources.map((source) => (
              <li key={source.articleVersionId}>
                <Link className="transition-colors hover:text-[#1B4332]" href={`/articles/${source.articleSlug}`} rel="noreferrer" target="_blank">
                  {source.articleTitle}<ArrowUpRight aria-hidden="true" size={14} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p>暂无可用原文来源。</p>}
      </section>
    </article>
  );
}
