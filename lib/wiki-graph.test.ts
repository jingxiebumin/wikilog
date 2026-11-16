import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WikiGraph } from "@/components/wiki-graph";
import { WikiTopicContent } from "@/components/wiki-topic-content";
import type { PublishedWikiPage } from "@/lib/wiki/repository";

const page: PublishedWikiPage = {
  id: "page-transaction",
  slug: "database-transactions",
  versionId: "version-transaction",
  versionNumber: 1,
  title: "数据库事务",
  body: "事务保证一组变更的原子性。",
  sources: [{ articleVersionId: "article-v1", articleSlug: "transactions", articleTitle: "事务处理" }],
  relatedPages: [{ slug: "database-indexes", title: "数据库索引" }],
};

describe("Wiki public rendering", () => {
  it("renders each published page as an accessible topic link and draws reviewed relations", () => {
    const markup = renderToStaticMarkup(createElement(WikiGraph, { pages: [
      page,
      {
        id: "page-index",
        slug: "database-indexes",
        versionId: "version-index",
        versionNumber: 1,
        title: "数据库索引",
        body: "索引正文",
        sources: [],
        relatedPages: [],
      },
    ] }));

    expect(markup).toContain('role="group"');
    expect(markup).toContain('href="/wiki/database-transactions"');
    expect(markup).toContain('href="/wiki/database-indexes"');
    expect(markup).toContain('aria-label="查看 Wiki 主题：数据库事务"');
    expect(markup).toContain("<line");
  });

  it("renders an explicit empty state when no topics are published", () => {
    expect(renderToStaticMarkup(createElement(WikiGraph, { pages: [] }))).toContain("暂时没有已发布的 Wiki 主题。");
  });

  it("links a topic to its reviewed page and exact published article versions", () => {
    const markup = renderToStaticMarkup(createElement(WikiTopicContent, { page }));

    expect(markup).toContain("事务保证一组变更的原子性。");
    expect(markup).toContain('href="/wiki/database-indexes"');
    expect(markup).toContain('href="/articles/transactions?version=article-v1"');
    expect(markup).toContain("事务处理");
  });
});
