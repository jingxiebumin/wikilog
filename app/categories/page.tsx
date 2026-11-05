import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { categories, getCategoryArticles } from "@/lib/content";

export const metadata: Metadata = { title: "主题分类" };

export default function CategoriesPage() {
  return (
    <div className="page index-page">
      <div className="page-heading">
        <p className="eyebrow"><span className="eyebrow-mark" /> 内容地图 / 01</p>
        <h1>主题分类</h1>
        <p>按问题所在的领域，浏览相关记录。</p>
      </div>
      <div className="category-directory">
        {categories.map((category, index) => {
          const count = getCategoryArticles(category.slug).length;
          return (
            <Link className="category-directory-row" href={`/categories/${category.slug}`} key={category.slug}>
              <span className={`directory-index tone-${category.tone}`}>{String(index + 1).padStart(2, "0")}</span>
              <span className="directory-copy">
                <strong>{category.name}</strong>
                <span>{category.description}</span>
              </span>
              <span className="directory-count">{String(count).padStart(2, "0")} 篇</span>
              <ArrowUpRight aria-hidden="true" className="directory-arrow" size={19} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
