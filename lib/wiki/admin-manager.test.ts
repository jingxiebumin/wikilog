import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminWikiManager } from "@/components/admin-wiki-manager";

describe("AdminWikiManager", () => {
  it("shows the current publication state, draft preview, and merge controls without history or AI generation", () => {
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
    }));

    expect(markup).toContain("创建 Wiki 页面");
    expect(markup).toContain("数据库事务");
    expect(markup).toContain("预览待发布草稿");
    expect(markup).toContain("合并页面");
    expect(markup).not.toContain("页面版本历史");
    expect(markup).not.toContain("AI 生成");
  });
});
