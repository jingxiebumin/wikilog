import { describe, expect, it } from "vitest";
import { ArticleSourceError, parseArticleSource } from "./parser";

const validSource = [
  "---",
  "slug: safe-content",
  "title: 安全内容",
  "publishedAt: 2026-11-12",
  "category: engineering",
  "tags: [security, mdx]",
  "summary: 用受限语法解析内容。",
  "---",
  "正文第一段。",
  "",
  "## 标题",
  "",
  "- 列表一",
  "- 列表二",
  "",
  "```ts",
  "const answer = 42;",
  "```",
].join("\n");

describe("parseArticleSource", () => {
  it("validates metadata and creates safe structured blocks", () => {
    expect(parseArticleSource(validSource, ["engineering"])).toMatchObject({
      slug: "safe-content",
      category: "engineering",
      tags: ["security", "mdx"],
      content: [
        { type: "paragraph", text: "正文第一段。" },
        { type: "heading", text: "标题" },
        { type: "list", items: ["列表一", "列表二"] },
        { type: "code", language: "ts", code: "const answer = 42;" },
      ],
    });
  });

  it.each([
    "import X from 'x';",
    "export const x = 1;",
    "<script>alert(1)</script>",
    "<Widget />",
    "<div>raw html</div>",
    "[unsafe](javascript:alert(1))",
    "![local](./secret.png)",
    "![remote](http://example.com/image.png)",
  ])("rejects executable or unsafe content: %s", (body) => {
    expect(() => parseArticleSource(validSource.replace("正文第一段。", body), ["engineering"])).toThrow(ArticleSourceError);
  });

  it("rejects unsupported dates, categories, and oversized source", () => {
    expect(() => parseArticleSource(validSource.replace("engineering", "unknown"), ["engineering"])).toThrow("受控分类");
    expect(() => parseArticleSource(validSource.replace("2026-11-12", "2026-02-31"), ["engineering"])).toThrow("YYYY-MM-DD");
    expect(() => parseArticleSource("x".repeat(1024 * 1024 + 1), ["engineering"])).toThrow("1 MiB");
  });

  it("rejects unknown frontmatter fields", () => {
    expect(() => parseArticleSource(validSource.replace("title:", "draft: true\ntitle:"), ["engineering"]))
      .toThrow("不支持 frontmatter 字段");
  });
});
