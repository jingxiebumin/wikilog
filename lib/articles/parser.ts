import type { ArticleBlock } from "@/lib/content";

export type ParsedArticle = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  category: string;
  tags: string[];
  content: ArticleBlock[];
  contentText: string;
  readMinutes: number;
  cover: "boundary" | "search" | "content" | "budget" | "database";
};

export class ArticleSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArticleSourceError";
  }
}

function fail(message: string): never {
  throw new ArticleSourceError(message);
}

function scalar(value: string): string {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(source: string): { metadata: Record<string, string | string[]>; body: string } {
  const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) fail("文章必须以 frontmatter 开始。");
  const end = normalized.indexOf("\n---\n", 4);
  if (end < 0) fail("frontmatter 缺少结束标记。");

  const metadata: Record<string, string | string[]> = {};
  let currentList: string | undefined;
  for (const line of normalized.slice(4, end).split("\n")) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (/^\s+-\s+/.test(line)) {
      if (currentList === undefined) fail("标签列表格式无效。");
      const listValue = metadata[currentList];
      if (!Array.isArray(listValue)) fail("标签列表格式无效。");
      listValue.push(scalar(line.replace(/^\s+-\s+/, "")));
      continue;
    }
    const match = /^([a-zA-Z][a-zA-Z0-9_-]*):(?:\s*(.*))?$/.exec(line);
    if (match === null) fail("frontmatter 仅支持简单的键值和标签列表。");
    const key = match[1];
    const rawValue = match[2] ?? "";
    if (Object.hasOwn(metadata, key)) fail(`frontmatter 字段重复：${key}`);
    const value = rawValue.trim();
    if (!value) {
      metadata[key] = [];
      currentList = key;
    } else if (value.startsWith("[") && value.endsWith("]")) {
      metadata[key] = value.slice(1, -1).split(",").map(scalar).filter(Boolean);
      currentList = undefined;
    } else {
      metadata[key] = scalar(value);
      currentList = undefined;
    }
  }
  return { metadata, body: normalized.slice(end + 5).trim() };
}

function requiredString(metadata: Record<string, string | string[]>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string" || !value.trim()) fail(`缺少有效的 ${key} 字段。`);
  return (value as string).trim();
}

function parseBody(markdown: string): ArticleBlock[] {
  const lines = markdown.split("\n");
  const blocks: ArticleBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let code: string[] = [];
  let codeLanguage = "text";
  let inCode = false;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ").trim() });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length) blocks.push({ type: "list", items: [...list] });
    list = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("````")) fail("不支持四个或更多反引号的代码围栏。");
    const fence = /^```([a-zA-Z0-9_-]*)\s*$/.exec(trimmed);
    if (fence) {
      flushParagraph();
      flushList();
      if (inCode) {
        blocks.push({ type: "code", language: codeLanguage, code: code.join("\n") });
        code = [];
        inCode = false;
      } else {
        inCode = true;
        codeLanguage = fence[1] || "text";
      }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (/<\/?[A-Za-z][^>]*>|<!DOCTYPE|<script\b|\b(import|export)\s/m.test(trimmed)) {
      fail("正文包含不支持的 HTML、JSX 或可执行语法。");
    }
    if (/!?\[[^\]]*\]\([^)]*\)/.test(trimmed)) {
      const image = /!\[[^\]]*\]\(([^)]*)\)/.exec(trimmed);
      if (image) {
        const target = image[1].trim();
        if (!/^https:\/\//i.test(target)) fail("外链图片必须使用 HTTPS；站内图片暂不支持。");
        fail("外链图片暂未开放，请移除图片语法。");
      }
    }
    for (const link of trimmed.matchAll(/\[[^\]]*\]\(([^)]*)\)/g)) {
      if (!/^https?:\/\//i.test(link[1].trim())) fail("文章链接只允许 HTTP 或 HTTPS 地址。");
    }
    const heading = /^(#{2,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph(); flushList();
      blocks.push({ type: "heading", text: heading[2].trim() });
      continue;
    }
    const item = /^[-*+]\s+(.+)$/.exec(trimmed);
    if (item) { flushParagraph(); list.push(item[1].trim()); continue; }
    if (!trimmed) { flushParagraph(); flushList(); continue; }
    if (/^#|^\d+\.\s/.test(trimmed)) fail("仅支持二级/三级标题与无序列表。");
    flushList();
    paragraph.push(trimmed);
  }
  if (inCode) fail("代码围栏未闭合。");
  flushParagraph(); flushList();
  if (!blocks.length) fail("文章正文不能为空。");
  return blocks;
}

export function parseArticleSource(source: string, categorySlugs: string[]): ParsedArticle {
  if (Buffer.byteLength(source, "utf8") > 1024 * 1024) fail("MDX 文件不能超过 1 MiB。");
  const { metadata, body: markdown } = parseFrontmatter(source);
  const allowedKeys = new Set(["slug", "title", "summary", "publishedAt", "category", "tags"]);
  const unknownKey = Object.keys(metadata).find((key) => !allowedKeys.has(key));
  if (unknownKey) fail(`不支持 frontmatter 字段：${unknownKey}`);
  const slug = requiredString(metadata, "slug");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail("slug 只能包含小写英文、数字和连字符。");
  const title = requiredString(metadata, "title");
  if (title.length > 160) fail("标题不能超过 160 个字符。");
  const summary = requiredString(metadata, "summary");
  if (summary.length > 500) fail("摘要不能超过 500 个字符。");
  const publishedAt = requiredString(metadata, "publishedAt");
  const date = new Date(`${publishedAt}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== publishedAt) {
    fail("publishedAt 必须是 YYYY-MM-DD 日期。");
  }
  const category = requiredString(metadata, "category");
  if (!categorySlugs.includes(category)) fail("category 不在受控分类列表中。");
  const tagsValue = metadata.tags;
  if (tagsValue !== undefined && (!Array.isArray(tagsValue) || tagsValue.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag)))) {
    fail("tags 必须是由小写英文、数字和连字符组成的列表。");
  }
  const tags = [...new Set((tagsValue as string[] | undefined) ?? [])];
  const body = parseBody(markdown);
  const contentText = body.map((block) => block.type === "list" ? block.items.join(" ") : block.type === "code" ? block.code : block.text).join(" ");
  const wordCount = contentText.match(/[\p{Script=Han}]|[A-Za-z0-9]+/gu)?.length ?? 1;
  return {
    slug, title, summary, publishedAt, category, tags, content: body, contentText,
    readMinutes: Math.max(1, Math.ceil(wordCount / 300)),
    cover: "content",
  };
}
