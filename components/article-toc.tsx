"use client";

import { useEffect, useState } from "react";
import type { ArticleHeading } from "@/components/article-body";

export function ArticleToc({ headings }: { headings: ArticleHeading[] }) {
  const [activeId, setActiveId] = useState(headings[0]?.id ?? "");

  useEffect(() => {
    if (!headings.length) return;
    const elements = headings
      .map(({ id }) => document.getElementById(id))
      .filter((element): element is HTMLElement => element instanceof HTMLElement);
    if (!elements.length) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
      if (visible[0]) setActiveId(visible[0].target.id);
    }, { rootMargin: "-96px 0px -72% 0px", threshold: 0 });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;
  return (
    <nav aria-label="文章目录" className="article-toc">
      <p className="article-toc-title">文章目录</p>
      <ol>
        {headings.map((heading) => (
          <li className={heading.level === 3 ? "article-toc-subitem" : undefined} key={heading.id}>
            <a aria-current={activeId === heading.id ? "location" : undefined} className={activeId === heading.id ? "is-active" : undefined} href={`#${heading.id}`}>
              {heading.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
