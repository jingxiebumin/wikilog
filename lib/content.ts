export type Category = {
  slug: string;
  name: string;
  description: string;
  tone: "coral" | "green" | "blue";
};

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string };

export type Article = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  status: "published" | "draft" | "archived";
  category: string;
  tags: string[];
  readMinutes: number;
  cover: "boundary" | "search" | "content" | "budget" | "database";
  body: ArticleBlock[];
};

export type SearchResult = {
  article: Article;
  matchType: "title" | "body";
  snippet: string;
};

export const categories: Category[] = [
  {
    slug: "engineering",
    name: "工程实践",
    description: "把实现细节写成可验证的工程决策。",
    tone: "coral",
  },
  {
    slug: "data-search",
    name: "数据与检索",
    description: "围绕内容、查询和证据组织数据。",
    tone: "blue",
  },
  {
    slug: "system-design",
    name: "系统设计",
    description: "让边界、成本与演进路径保持清楚。",
    tone: "green",
  },
];

export const articles: Article[] = [
  {
    slug: "public-read-boundary",
    title: "先划清公开读取边界，再接入真实数据",
    summary: "公开页面需要稳定地读取文章，但数据库凭据和未发布内容都只能留在服务端。",
    publishedAt: "2026-10-29",
    status: "published",
    category: "system-design",
    tags: ["nextjs", "security", "data-access"],
    readMinutes: 7,
    cover: "boundary",
    body: [
      {
        type: "paragraph",
        text: "做公开博客时，页面看起来只是把标题和正文渲染出来。真正需要先确定的是：谁有权读到什么数据，以及凭据在哪一侧使用。",
      },
      { type: "heading", text: "浏览器只接收公开结果" },
      {
        type: "paragraph",
        text: "数据库连接串、服务端 API Key 和草稿内容都属于私有数据。页面可以由服务端查询已发布文章，再把渲染所需的公开字段交给浏览器。",
      },
      {
        type: "code",
        language: "ts",
        code: "export async function listPublishedArticles() {\n  return repository.findMany({ status: 'published' });\n}",
      },
      {
        type: "paragraph",
        text: "原型阶段先用本地种子数据实现同一个查询边界。等数据库方案确定后，只替换数据来源，不需要让页面知道供应商连接细节。",
      },
      { type: "heading", text: "把未发布状态作为默认拒绝" },
      {
        type: "list",
        items: [
          "公开查询只返回当前已发布版本。",
          "草稿、下架文章和待发布版本不进入公开列表或搜索。",
          "数据库异常时展示通用错误状态，不渲染堆栈或连接信息。",
        ],
      },
    ],
  },
  {
    slug: "chinese-substring-search",
    title: "中文搜索先从连续子串开始",
    summary: "先把标题优先、正文命中和附近摘要做得可预测，再根据真实内容规模换检索方案。",
    publishedAt: "2026-10-21",
    status: "published",
    category: "data-search",
    tags: ["search", "postgres", "chinese"],
    readMinutes: 6,
    cover: "search",
    body: [
      {
        type: "paragraph",
        text: "小型文章库通常不需要一开始就接入复杂的搜索服务。对中文查询，连续子串匹配有一个好处：输入的连续汉字本身就是检索单元，不需要先猜分词规则。",
      },
      { type: "heading", text: "先固定用户能观察到的行为" },
      {
        type: "list",
        items: [
          "标题命中排在正文命中之前。",
          "英文关键词不区分大小写。",
          "摘要从命中附近截取，避免只展示文章开头。",
        ],
      },
      {
        type: "paragraph",
        text: "这套行为可以先用本地数据测试。迁移到 PostgreSQL 后，再用同一组用例确认数据库查询没有改变读者看到的顺序和摘要。",
      },
      { type: "heading", text: "给未来替换留出空间" },
      {
        type: "paragraph",
        text: "查询入口只接受关键词并返回公开文章摘要。数据量增长时，可以在入口后增加索引或专门的检索实现，页面路由保持不变。",
      },
    ],
  },
  {
    slug: "mdx-is-data",
    title: "把 MDX 当作数据，而不是可执行代码",
    summary: "内容上传和文章展示是两个不同的信任边界，扩展语法必须经过明确允许。",
    publishedAt: "2026-10-13",
    status: "published",
    category: "engineering",
    tags: ["mdx", "security", "content"],
    readMinutes: 8,
    cover: "content",
    body: [
      {
        type: "paragraph",
        text: "MDX 看起来像 Markdown，但它也能表达 JavaScript 导入和组件调用。若允许上传者提供的代码在服务端执行，文章管理功能就变成了远程代码执行入口。",
      },
      { type: "heading", text: "限定内容表达能力" },
      {
        type: "paragraph",
        text: "发布流程应该采用白名单语法：段落、标题、列表、代码块和少量受控组件。未知节点直接拒绝或按文本处理，不通过 eval 或动态 import 执行。",
      },
      {
        type: "code",
        language: "txt",
        code: "allowed: headings, paragraphs, lists, code fences\nrejected: imports, scripts, arbitrary JSX",
      },
      {
        type: "paragraph",
        text: "本地初版使用可信的种子内容；将来接入上传时，解析器和安全测试应位于内容保存边界，而不是散落在各个页面组件里。",
      },
    ],
  },
  {
    slug: "application-budget-gate",
    title: "把应用预算做成模型调用前的闸门",
    summary: "月度预算需要在并发请求提交给模型之前原子预留，而不只是月底看账单。",
    publishedAt: "2026-10-04",
    status: "published",
    category: "engineering",
    tags: ["ai-cost", "backend", "operations"],
    readMinutes: 5,
    cover: "budget",
    body: [
      {
        type: "paragraph",
        text: "调用完成后再记账，无法阻止一批并发请求同时读到相同的剩余预算。预算检查必须和预留操作放在同一个原子边界里。",
      },
      { type: "heading", text: "预留、结算、释放" },
      {
        type: "list",
        items: [
          "调用前按照保守估值预留额度。",
          "调用成功后依据实际 token 用量调整记录。",
          "失败时释放未消耗的预留，并保留可审计状态。",
        ],
      },
      {
        type: "paragraph",
        text: "应用侧预算是产品保护，不等于供应商账单硬上限。单价变化、税费和服务商最低消费仍需单独核对。",
      },
    ],
  },
  {
    slug: "published-read-model",
    title: "给已发布文章一条窄而清晰的查询",
    summary: "当前版本和历史版本要分开表达，公开读取只需要一条稳定的已发布视图。",
    publishedAt: "2026-09-27",
    status: "published",
    category: "system-design",
    tags: ["postgres", "data-access", "versioning"],
    readMinutes: 7,
    cover: "database",
    body: [
      {
        type: "paragraph",
        text: "文章实体有稳定的 slug，文章版本承载正文和元数据。上传新版本后，它先作为草稿存在；显式发布时才替换当前公开版本。",
      },
      { type: "heading", text: "公开查询不承担发布决策" },
      {
        type: "paragraph",
        text: "发布工作流负责选择当前版本，公开读取只查询已经选定的版本。把这两种职责分开，可以降低列表、搜索和文章详情之间的状态差异。",
      },
      {
        type: "code",
        language: "sql",
        code: "select slug, title, summary, published_at\nfrom published_articles\norder by published_at desc;",
      },
      {
        type: "paragraph",
        text: "原型使用本地 fixture 保持页面可运行。数据库迁移和查询计划等具体实现留到运行平台验证后再定。",
      },
    ],
  },
  {
    slug: "unpublished-preview",
    title: "内部草稿：只用于验证公开边界",
    summary: "这篇种子内容不应出现在首页、搜索、分类或标签页面。",
    publishedAt: "2026-11-01",
    status: "draft",
    category: "engineering",
    tags: ["draft"],
    readMinutes: 2,
    cover: "content",
    body: [{ type: "paragraph", text: "草稿数据只用于验证过滤行为。" }],
  },
];

export const tagCatalog = [
  { slug: "nextjs", name: "Next.js" },
  { slug: "security", name: "安全" },
  { slug: "data-access", name: "数据访问" },
  { slug: "search", name: "搜索" },
  { slug: "postgres", name: "PostgreSQL" },
  { slug: "chinese", name: "中文" },
  { slug: "mdx", name: "MDX" },
  { slug: "content", name: "内容管理" },
  { slug: "ai-cost", name: "AI 成本" },
  { slug: "backend", name: "服务端" },
  { slug: "operations", name: "运维" },
  { slug: "versioning", name: "版本管理" },
];

export const publishedArticles = () =>
  articles
    .filter((article) => article.status === "published")
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

export const findPublishedArticle = (slug: string) =>
  articles.find((article) => article.slug === slug && article.status === "published");

export const getCategory = (slug: string) => categories.find((category) => category.slug === slug);

export const getCategoryArticles = (slug: string) =>
  publishedArticles().filter((article) => article.category === slug);

export const getTag = (slug: string) => tagCatalog.find((tag) => tag.slug === slug);

export const getTagArticles = (slug: string) =>
  publishedArticles().filter((article) => article.tags.includes(slug));

export const getArticleText = (article: Article) =>
  article.body
    .map((block) => {
      if (block.type === "list") return block.items.join(" ");
      if (block.type === "code") return block.code;
      return block.text;
    })
    .join(" ");

const makeSnippet = (text: string, query: string, index: number) => {
  const start = Math.max(0, index - 42);
  const end = Math.min(text.length, index + query.length + 96);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return `${prefix}${text.slice(start, end).trim()}${suffix}`;
};

export const searchArticles = (rawQuery: string): SearchResult[] => {
  const query = rawQuery.trim();
  if (!query) return [];

  const needle = query.toLocaleLowerCase("zh-CN");
  return publishedArticles()
    .flatMap((article) => {
      const titleIndex = article.title.toLocaleLowerCase("zh-CN").indexOf(needle);
      const body = `${article.summary} ${getArticleText(article)}`;
      const bodyIndex = body.toLocaleLowerCase("zh-CN").indexOf(needle);
      if (titleIndex < 0 && bodyIndex < 0) return [];

      const matchType: SearchResult["matchType"] = titleIndex >= 0 ? "title" : "body";
      return [{
        article,
        matchType,
        snippet: matchType === "title" || bodyIndex < 0
          ? article.summary
          : makeSnippet(body, query, bodyIndex),
      }];
    })
    .sort((left, right) => {
      if (left.matchType !== right.matchType) return left.matchType === "title" ? -1 : 1;
      return right.article.publishedAt.localeCompare(left.article.publishedAt);
    });
};

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00+08:00`));
