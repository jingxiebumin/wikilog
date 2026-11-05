import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Hash } from "lucide-react";
import { getTagArticles, tagCatalog } from "@/lib/content";

export const metadata: Metadata = { title: "标签索引" };

export default function TagsPage() {
  const visibleTags = tagCatalog
    .map((tag) => ({ ...tag, count: getTagArticles(tag.slug).length }))
    .filter((tag) => tag.count > 0)
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"));

  return (
    <div className="page index-page">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-mark" /> 内容地图 / 02</p>
        <h1>标签索引</h1>
        <p>跨越不同主题，找到反复出现的关键词。</p>
      </div>
      <div className="tag-directory">
        {visibleTags.map((tag, index) => (
          <Link className="tag-directory-row" href={`/tags/${tag.slug}`} key={tag.slug}>
            <span className="directory-index">{String(index + 1).padStart(2, "0")}</span>
            <Hash aria-hidden="true" className="tag-hash" size={17} />
            <strong>{tag.name}</strong>
            <span className="directory-count">{String(tag.count).padStart(2, "0")} 篇</span>
            <ArrowUpRight aria-hidden="true" className="directory-arrow" size={18} />
          </Link>
        ))}
      </div>
    </div>
  );
}
