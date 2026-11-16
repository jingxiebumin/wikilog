import type { Metadata } from "next";
import { WikiGraph } from "@/components/wiki-graph";
import { listPublishedWikiPages } from "@/lib/wiki/service";
import styles from "./wiki.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "知识图谱",
  description: "按主题浏览已发布 Wiki 页面及其关联关系。",
};

export default async function WikiPage() {
  const pages = await listPublishedWikiPages();
  return (
    <div className={`page ${styles.page}`}>
      <header className="page-heading">
        <p className="eyebrow">知识关联 / WIKI</p>
        <h1>知识图谱</h1>
        <p>从主题之间的关联继续探索已发布的技术知识。</p>
      </header>
      <WikiGraph pages={pages} />
    </div>
  );
}
