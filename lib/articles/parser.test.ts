import { describe, expect, it } from "vitest";
import { ArticleSourceError, parseArticleForm, parseArticleSource } from "./parser";

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

  it("accepts uploaded image references only when the matching file is attached", () => {
    const source = validSource.replace("正文第一段。", "![流程图](./images/flow.png)");
    expect(parseArticleSource(source, ["engineering"], { "flow.png": "123e4567-e89b-42d3-a456-426614174000.png" }).content[0])
      .toEqual({ type: "image", src: "/api/article-images/123e4567-e89b-42d3-a456-426614174000.png", alt: "流程图" });
    expect(() => parseArticleSource(source, ["engineering"])).toThrow("本次上传中提供");
  });

  it("renders external HTTPS images and rejects other schemes", () => {
    const source = validSource.replace("正文第一段。", "![外部图](https://example.test/flow.png)");
    expect(parseArticleSource(source, ["engineering"]).content[0]).toEqual({
      type: "image", src: "https://example.test/flow.png", alt: "外部图",
    });
    expect(() => parseArticleSource(source.replace("https://", "http://"), ["engineering"]))
      .toThrow("必须在本次上传中提供");
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

describe("parseArticleForm", () => {
  it("keeps metadata outside Markdown and derives a plain summary from the first paragraph", () => {
    expect(parseArticleForm("## ignored heading\n\n**First** `paragraph` text.\n\n![photo](https://example.test/a.png)\n\n```ts\ncode\n```", {
      title: "  Form title  ", category: "engineering", publishedAt: "2026-11-17", tags: ["release"],
    }, ["engineering"])).toMatchObject({
      slug: "", title: "Form title", summary: "First paragraph text.", tags: ["release"],
      content: [{ type: "heading" }, { type: "paragraph", text: "**First** `paragraph` text." }, { type: "image" }, { type: "code" }],
    });
  });

  it("rejects more than two tags and unknown controlled options", () => {
    const metadata = { title: "Title", category: "engineering", publishedAt: "2026-11-17", tags: ["one", "two", "three"] };
    expect(() => parseArticleForm("Body", metadata, ["engineering"])).toThrow("最多选择两个");
    expect(() => parseArticleForm("Body", { ...metadata, tags: [], category: "other" }, ["engineering"])).toThrow("受控分类");
  });
});
