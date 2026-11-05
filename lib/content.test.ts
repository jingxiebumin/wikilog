import { describe, expect, it } from "vitest";
import {
  findPublishedArticle,
  getCategoryArticles,
  publishedArticles,
  searchArticles,
} from "./content";

describe("public content queries", () => {
  it("never returns drafts from public article reads", () => {
    expect(publishedArticles().some((article) => article.slug === "unpublished-preview")).toBe(false);
    expect(findPublishedArticle("unpublished-preview")).toBeUndefined();
    expect(getCategoryArticles("engineering").some((article) => article.status !== "published")).toBe(false);
    expect(searchArticles("内部草稿")).toEqual([]);
  });

  it("matches continuous Chinese substrings in titles and body text", () => {
    expect(searchArticles("中文搜索").map(({ article }) => article.slug)).toContain("chinese-substring-search");
    expect(searchArticles("原子边界").map(({ article }) => article.slug)).toContain("application-budget-gate");
  });

  it("places body matches inside the result snippet", () => {
    const result = searchArticles("原子边界").find(({ article }) => article.slug === "application-budget-gate");
    expect(result?.matchType).toBe("body");
    expect(result?.snippet).toContain("原子边界");
  });

  it("matches English without case sensitivity", () => {
    expect(searchArticles("POSTGRESql").map(({ article }) => article.slug)).toContain("chinese-substring-search");
  });

  it("ranks title matches before newer body matches", () => {
    const results = searchArticles("文章");
    expect(results[0]?.matchType).toBe("title");
    expect(results.some((result) => result.matchType === "body")).toBe(true);
  });

  it("returns no results for blank or unmatched queries", () => {
    expect(searchArticles("   ")).toEqual([]);
    expect(searchArticles("not-a-real-query")).toEqual([]);
  });
});
