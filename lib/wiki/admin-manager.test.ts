import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminWikiManager } from "@/components/admin-wiki-manager";

describe("AdminWikiManager", () => {
  it("shows draft editing, source selection, version review, and merge controls", () => {
    const markup = renderToStaticMarkup(createElement(AdminWikiManager, {
      initialPages: [{
        id: "page-id",
        slug: "database-transactions",
        state: "active",
        current: { id: "published-id", title: "数据库事务", status: "published" },
        versions: [{
          id: "draft-id", versionNumber: 2, status: "draft", title: "数据库事务更新",
          body: "事务保证原子性。", createdAt: "2026-11-16T12:00:00.000Z",
          sources: [{ articleVersionId: "source-id", articleSlug: "transactions", articleTitle: "事务处理" }],
          relatedSlugs: [],
        }],
      }],
      publishedArticles: [{ id: "source-id", slug: "transactions", title: "事务处理", versionNumber: 1 }],
      generationEnabled: false,
    }));

    expect(markup).toContain("创建 Wiki 页面");
    expect(markup).toContain("事务处理 · v1");
    expect(markup).toContain("发布此版本");
    expect(markup).toContain("合并主题");
    expect(markup).toContain("页面版本");
    expect(markup).toContain("AI 生成未启用");
  });
});
