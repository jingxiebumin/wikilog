# 个人技术博客 V1 实施规格

状态：实施基线。本文把 `docs/adr/` 的已接受决策整理为可执行规格；遇到 ADR 未决定的供应商或部署细节时，须先验证并记录，不得在实现中默认为已选定。

## 1. 功能范围与目标

### 1.1 目标

交付一个面向中国大陆读者的个人技术博客。匿名访客可以浏览已发布文章、主分类、标签和搜索结果。唯一管理员（负责人本人）通过受保护的管理区维护读者账号、文章和 AI 设置；其他身份不能执行这些管理操作。目标公网形态为 IP/HTTP，不申请域名、不做备案、不配置 HTTPS。公开注册只创建 reader；reader 与已初始化的 admin 登录后均可收藏文章；问答仅对 admin 开放。账号不依赖邮件服务。

已发布文章的服务器端 MDX 源文和元数据是权威内容；渲染后的结构化正文用于展示和检索。新上传版本先是草稿，只有管理员显式发布后才替换同一 slug 的当前公开版本。文章原文始终优先于问答索引或模型输出。

本项目与旧私有 RAG 项目使用独立仓库和数据环境，不迁移旧文档、用户、会话或索引。首版技术形态为 TypeScript、Next.js App Router 和 PostgreSQL；项目使用已购买的华为云 Flexus L 单机及自管 PostgreSQL。负责人已决定不使用、不验证 CloudBase，不申请域名、不做备案、不配置 HTTPS，且之后不再考虑这些事项。

### 1.2 分阶段范围和发布门槛

| 能力 | 实施范围 | 启用条件 |
| --- | --- | --- |
| 公开博客 | 首页、文章、分类、标签、搜索、关于/联系；仅查询当前已发布版本 | 目标为公网 IP/HTTP；完成 Issue 01/08 适用的网络和公开边界验收。本地开发不受运行环境阻塞 |
| 文章管理 | 管理员上传 MDX 与配图、预览草稿、发布版本、下架及恢复 | 持久化运行与文件存储方案通过验证；每项操作服务端验证管理员身份、限速、审计和输入 |
| 读者账号 | 邮箱密码注册/登录、个人中心资料和密码管理、管理员创建/编辑/重置密码/软删除与恢复 | 账号实现、限速、服务端授权和发布验收通过；头像上传另须通过华为云服务器私有持久目录的写入、读取、重启持久性和备份恢复验证 |
| 收藏 | 所有 active 登录用户（reader/admin）添加、查看、移除自己的收藏 | 账号和文章管理可用；按用户 ID 隔离数据 |
| 管理员问答 | 仅管理员使用 DeepSeek 聊天问答、文章引用、会话和每日成功回答配额；优先检索 Wiki，原文兜底只发送少量相关片段 | DeepSeek API 专属数据处理政策通过核验；配额、用量记录、错误处理和来源校验通过测试；否则关闭问答 |
| Wiki | 管理员维护主题页和审核草稿；访客/读者通过公开知识图谱浏览已发布页面；Wiki 检索辅助问答 | Issue 10 的功能和安全验收通过；DeepSeek API 专属数据处理政策核验通过前，禁用 Wiki AI 生成和问答供应商调用 |

服务器和基础设施费用按 Issue 01 的实际订单、续费价和按量费用记录。问答记录供应商返回的输入/输出 token 用量，不换算应用侧费用、不设置月度预算门槛或费用告警；供应商账户余额由负责人在 DeepSeek 平台管理。

### 1.3 非目标（Out of Scope）

- 迁移或复用旧 RAG 项目的文档、用户、会话、向量索引或问答数据。
- 首版文章评论、公开 Wiki、任意文件格式导入、富文本编辑器、读者投稿或自助内容管理。
- 上传 MDX 中执行 `import`/`export`、脚本、任意 JSX/组件、任意原始 HTML 或动态代码；不得使用 `eval` 或动态导入运行上传内容。
- 读者自行注册为管理员、客户端修改角色、用户自助管理模型凭据。
- 首版接入 DeepSeek 以外的模型供应商；管理员只能在服务端预先配置和验证过的 DeepSeek 文本模型中选择。
- 复用 `llm_wiki` 桌面应用作为线上运行依赖；它只作为知识组织方式的参考。
- 把未验证的对象存储或其他外部服务宣称为生产选择；CloudBase 已由负责人明确排除，不再是候选方案。
- 把应用侧预算称为供应商费用绝对上限，或把未经供应商验证的数据保留/训练政策当作事实。

## 2. 技术细节与变更范围

### 2.1 架构约束

- 页面通过服务端查询读取公开内容；数据库连接串、对象存储凭据和模型 API Key 只存在于服务端，不进入浏览器包、响应或日志。系统不发送系统邮件，不配置邮件凭据。
- 公开读取只通过 `articles.current_published_version_id` 关联当前已发布版本，并过滤草稿、下架、删除及软删除数据。所有管理员、读者和问答写操作必须在服务端重新验证身份、角色、所有权和输入。
- 普通文章路由只展示当前已发布版本；问答引用的历史版本通过受控版本地址/快照单独验证。文章下架或删除后，普通读者不能打开其任何历史版本；问答记录保留的版本 ID 与原文片段用于历史核验，不绕过文章可见性状态。
- 使用 PostgreSQL 迁移管理 schema；数据库访问集中在 `lib/` 的服务端模块。页面不直接拼装 SQL。
- 使用 `Asia/Shanghai` 自然日边界处理问答每日成功回答配额；并发限额必须由数据库事务/约束保证，不能只依赖应用进程内检查。
- 页面层、路由/Server Action 层和领域服务层分离：传输层负责解析输入及映射响应；领域服务实现校验、权限、事务和业务错误；仓储负责参数化数据库操作。采用 Server Actions 或 Route Handlers 时须沿用此边界，不得绕开服务端领域校验。
- IP/HTTP 是负责人接受的部署目标，不作为账号或收藏的关闭条件。HTTP 不加密，登录凭据和会话可能被传输链路观察或篡改；仍必须使用服务端会话授权、限速和安全 Cookie 设置，不得把 HTTP 描述为安全传输。需审计的管理操作遵循各自 Issue；读者账号管理仅记录用户表字段。公网开放前核对云平台对当前实例和访问方式的适用要求；备案不属于本项目计划事项。
- 问答只接受 active admin 会话；问答会话按创建者隔离。收藏允许 active reader 和 admin，但任何用户只能读取/删除自己的收藏。
- 个人中心与管理员设置均采用左右布局；未登录访问个人中心跳转登录页。管理员设置包含账号管理、文章管理、AI 设置与问答、Wiki 管理四个独立二级路由；`/admin` 重定向至 `/admin/readers`。匿名用户与 reader 访问 `/admin` 及任意子路由时显示带返回首页链接的 404，管理 API 对这两类身份返回 404。账号管理的创建、资料编辑、密码重置、软删除和恢复见 Issue 11；不提供启用/停用、角色编辑或读者自助删除。
- 读者账号管理只将创建人/时间、最近修改人/时间和删除原因保留在 `users` 行，不记录逐次账号操作日志；文章等其他管理操作遵循各自 Issue 的日志/审计要求。
- 用户头像固定存放于已购买的华为云服务器私有持久目录，通过服务端鉴权后只允许本人读取，不使用公开静态目录。实际目录由实施阶段确定；头像上传实施前验证目录写权限、上传和本人鉴权读取、容器/主机重启后的持久性及备份恢复。文章上传图片的存储细节仍依 Issue 01/05 验证，不把头像决策外推为文章图片方案。
- 文章资源的持久化方案仍由对应验证 Issue 决定；不接入邮件供应商，不将邮件供应商写进领域模型。

### 2.2 预期文件范围

现有文件优先扩展，目录和命名可按仓库已有模式细化；新增实现不得复制一套平行的数据访问或认证逻辑。

| 路径 | 变更职责 |
| --- | --- |
| `app/page.tsx`、`app/articles/[slug]/page.tsx`、`app/categories/**`、`app/tags/**`、`app/search/page.tsx`、`app/about/page.tsx` | 保持公开路由只显示已发布数据；文章页预留收藏/问答入口的条件化挂载 |
| `app/layout.tsx`、`components/site-navigation.tsx`、`components/site-shell.tsx` | 添加经服务端会话驱动的头像菜单；登录用户看到个人中心，管理员另见管理员设置；未启用账号时保留公开导航 |
| `components/article-body.tsx`、`lib/content.ts` | 定义和安全渲染允许的结构化正文节点；保留 fixture 与搜索行为用于本地预览和回归 |
| `lib/db.ts`、`lib/content-repository.ts`、`lib/public-content.ts` | 保持服务端 PostgreSQL 连接池和公开查询边界；增加按已发布文章版本读取正文/引用所需字段的仓储函数 |
| `db/migrations/0003_*.sql` 及后续迁移 | 为 MDX 源文、读者令牌/会话、收藏和问答等增加兼容迁移；每个变更独立迁移并可重复通过迁移器应用 |
| `scripts/migrate.ts`、`scripts/seed.ts` | 纳入新迁移及仅供本地使用的示例；种子不得重置或覆盖线上内容，也不得创建可用生产管理员/真实用户 |
| `lib/auth/**`（新） | 密码哈希、会话、注册/登录、个人资料与头像授权、管理员初始密码/重置、读者软删除/恢复及权限校验 |
| `lib/storage/**`（新） | 服务端存储适配与失败映射；头像适配已购华为云服务器私有持久目录，文章图片继续依 Issue 01/05 确认 |
| `lib/articles/**`（新） | frontmatter 校验、受限 MDX 解析、草稿预览、版本发布/下架和管理员写权限 |
| `lib/favorites/**`（新） | 收藏创建、列表、删除及用户所有权检查 |
| `lib/qa/**`、`lib/ai/**`（新） | Wiki 优先检索、少量原文片段兜底、DeepSeek 服务端适配、回答来源校验、会话、成功回答配额和 token 用量记录 |
| `lib/wiki/**`（新） | 主题页、来源文章版本、已审核关系、页面版本、AI 候选更新、后台审核和公开图谱查询 |
| `app/(account)/**`、`app/(admin)/**`、必要的 `app/api/**` 或 Server Actions（新） | 账号/收藏/问答/管理界面与传输适配；每项写操作调用领域服务并处理统一错误 |
| `lib/*.test.ts`、各新模块 `*.test.ts`（新） | 领域单测、数据库迁移/仓储测试、权限和并发测试；优先使用现有 Vitest 与 PGlite 测试方式 |

### 2.3 关键模型和数据结构

#### 现有 PostgreSQL 表

当前 `0001_initial.sql` 与 `0002_audit_fields.sql` 已建立下表。所有业务表具有 `created_at`、`created_by`、`updated_at`、`updated_by` 和 `del_flag`（版本关联表以 `created_at` 作为初始时间并在 0002 补 `updated_at`）；操作者可空。保留既有列和迁移兼容性。

| 表 | 已确定职责与关键约束 |
| --- | --- |
| `users` | `id`、`email`、`display_name`、`password_hash`、`role(reader/admin)`、`status(active/disabled)`，并扩展可选手机号、性别、个人介绍、头像资源引用和删除原因；管理员新建读者在首次设置昵称前允许 `display_name` 为空。邮箱仅对未软删除账号保持大小写不敏感唯一；仅作登录名和人工联系字段。用户行保留 `created_at/created_by`、`updated_at/updated_by` 和软删除 `del_flag`。确认密码不存储；公开注册固定 `reader`。0001 中的 `pending` 和 `email_verified_at` 是待 Issue 04 迁移清理的旧字段，不再表示业务状态。管理员账号管理不提供启用/停用功能；`del_flag` 为真时账号软删除，不物理删除用户或关联数据。 |
| `categories` | 受控主分类：唯一 `slug`、名称、描述、展示 tone；文章只有一个主分类 |
| `tags` | 唯一 `slug` 与名称；可跨越主分类 |
| `articles` | 稳定唯一 `slug`、`category_id`、`current_published_version_id`、可恢复的下架/删除时间；下架与删除是不同文章状态，V1 不永久删除文章，版本发布通过此指针切换 |
| `article_versions` | 每个版本的序号、`draft/published/archived` 状态、标题、摘要、`content` JSON、`content_text`、封面、阅读分钟数、发布时间；`(article_id, version_number)` 唯一，发布版本必须有 `published_at` |
| `article_version_tags` | 文章版本与标签多对多关联，组合主键唯一；标签属于版本快照，修改草稿标签不应改变线上旧版本 |

#### 需新增的逻辑数据及 schema 扩展

实际列类型、索引命名在迁移中落实；下列约束不可省略。建议按功能拆分迁移，不重建现有表。

| 表/扩展 | 必需字段与不变量 |
| --- | --- |
| `article_versions` 扩展 | 保存上传的原始 `source_mdx`，使服务端存档的源文可审计和重新解析；兼容已有种子版本。配图引用需关联稳定的文章版本/对象存储 key，发布前草稿图片不得绕开权限校验公开访问 |
| `reader_sessions` | 用户 ID、仅哈希后的随机会话 token、过期/撤销时间、创建时间；token 只通过安全、HttpOnly、SameSite Cookie 传递 |
| 已有密码重置记录 | `admin_password_resets` 是既有实现表；本次新建的账号管理流程不新增逐次操作日志，也不再向该表写入操作记录。是否清理既有历史行不属于本需求。密码状态在 `users` 行更新；密码仅保存哈希。固定初始/重置密码为 `123456`，首次登录必须修改 |
| `favorites` | `user_id`、稳定 `article_id`、收藏时间；`(user_id, article_id)` 唯一。文章软下架时隐藏但不删除关系，账号删除清理用户关系 |
| `qa_sessions` | 所属管理员、标题/时间等会话元信息；所有查询、删除均按管理员会话所有者约束 |
| `qa_messages` | 会话、用户问题/助手回答、状态（`processing`/`succeeded`/`refused`/`failed`/`timed_out`）、模型标识、输入/输出 token、请求业务日、创建时间；成功回答计入每日配额，拒答、供应商错误和超时不计次；不得保存不必要的凭据或敏感日志 |
| `qa_citations` | 回答消息、实际引用的 `article_version_id`、原文片段/位置和可验证版本地址；仅允许引用该次检索中有效且当时已发布的原文版本，不能只依赖会随发布切换的当前 slug 页面；文章下架/删除后普通读者不可访问历史页面 |
| `qa_daily_usage` | 管理员与 `Asia/Shanghai` 业务日期唯一的成功回答数；并发消费配额必须原子化，每名管理员每日最多 5 个成功回答 |
| Wiki 页面及关系 | 页面按稳定 slug 标识主题；保存已发布版本、候选草稿、关联的当前已发布文章版本、已审核主题关系和版本历史。草稿/待审核关系不进入公开图谱或问答检索；失去全部有效来源的页面从公开图谱和问答检索隐藏 |

密码采用成熟的带盐密码哈希；会话 token 使用密码学安全随机值并只保存哈希。管理员创建读者和重置密码均将密码设为固定值 `123456`；新读者首次登录要求设置昵称及新密码，既有读者重置后首次登录只要求改密，完成前不能继续使用系统。新读者首次设置后轮换当前会话令牌并继续当前会话；重置密码通过二次确认并明确提示该固定值，不要求线下身份确认或填写原因。密码只保存哈希。管理员读者账号操作仅更新用户行的创建/最近修改信息及删除原因，不新增逐次操作日志。

#### TypeScript 领域类型

类型名以词汇表为准；以下为建议的稳定服务边界，实际传输 DTO 不包含密钥或内部 DB 行：

```ts
type ReaderRole = "reader" | "admin";
type AccountStatus = "active" | "disabled";
type ArticleVersionStatus = "draft" | "published" | "archived";

type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; language: string; code: string }
  | { type: "quote"; text: string }
  | { type: "image"; assetKey?: string; httpsUrl?: string; alt: string };

type PublicArticle = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  updatedAt?: string;
  category: string;
  tags: string[];
  readMinutes: number;
  body: ArticleBlock[];
};

type SearchResult = {
  article: PublicArticle;
  matchType: "title" | "body";
  snippet: string;
};

 type Citation = {
  articleSlug: string;
  articleTitle: string;
  articleVersionId: string;
  href: string; // 指向可验证的文章版本地址
  excerpt: string;
  position?: string;
};
```

`ArticleBlock` 只代表解析器白名单内可安全渲染的节点；若既有 `content` JSON 需要迁移，必须采用可兼容旧种子/文章的解码器，并对未知节点拒绝发布或安全转义，不能作为组件执行。

### 2.4 核心 API 与函数边界

所有写操作返回领域结果或抛出可识别的 `DomainError`，不把原始 SQL、供应商响应、token 或堆栈透给客户端。建议定义：`VALIDATION_ERROR`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`CONFLICT`、`RATE_LIMITED`、`STORAGE_UNAVAILABLE`、`MODEL_UNAVAILABLE`、`QUOTA_EXCEEDED`、`BUDGET_EXCEEDED`、`INTERNAL_ERROR`。UI 显示安全且可理解的消息；服务端日志记录关联 ID 和脱敏上下文。认证入口错误不得暴露邮箱是否注册。

| 模块/签名 | 入参与出参 | 错误/事务要求 |
| --- | --- | --- |
| `lib/public-content.ts`: `listPublishedArticles(): Promise<PublicArticle[]>`、`getPublishedArticle(slug: string): Promise<PublicArticle | undefined>`、`listArticlesForCategory(slug: string): Promise<PublicArticle[]>`、`listArticlesForTag(slug: string): Promise<PublicArticle[]>`、`searchPublishedArticles(query: string): Promise<SearchResult[]>` | 仅返回当前已发布版本；搜索返回标题命中优先、正文命中附近摘要 | 空查询返回空列表；无匹配返回空列表；数据库错误交给通用错误边界，不返回草稿或内部错误 |
| `lib/auth/service.ts`: `registerReader(input: { displayName: string; email: string; password: string; confirmPassword: string }): Promise<{ userId: string }>` | 校验字段、唯一邮箱并创建 active reader；确认密码只参与校验，不发送邮件 | 公开注册强制 reader；重复的未删除邮箱响应不枚举；软删除账号邮箱可重新注册；邮箱只作登录名和人工联系字段 |
| `updateOwnProfile(userId, input: { displayName: string; phone?: string; gender?: string; introduction?: string })` | 读者修改自己的基础资料；昵称必填，其余选填 | 所有权来自服务端会话；手机号按约定格式校验，个人介绍不超过 500 字；更新 users 最近修改字段 |
| `setOwnAvatar(userId, image)` | 读者上传并保存自己的头像；图片文件存入华为云服务器私有持久目录 | 只允许 JPEG/PNG/WebP 静态图片且不超过 5 MB；上传和读取均校验会话所有权；目录写入、重启持久性和备份恢复未验收前不得开放上传 |
| `completeFirstLoginSetup(userId, input: { displayName: string; newPassword: string; confirmPassword: string })` | 新建读者首次登录时设置昵称和新密码 | 完成前不得继续使用系统；至少 9 位；轮换当前会话令牌并继续当前会话，撤销其他会话 |
| `completePasswordReset(userId, input: { newPassword: string; confirmPassword: string })` | 已有读者使用管理员重置密码登录后设置新密码 | 保留已有昵称；完成前不得继续使用系统；至少 9 位 |
| `changeOwnEmail(userId, input: { currentPassword: string; newEmail: string })` | 本人修改作为登录名的邮箱 | 需当前密码、大小写不敏感唯一；不发送验证邮件；成功后撤销该用户全部会话 |
| `adminCreateReader(actorId, email)`、`adminUpdateReader(actorId, userId, profile)` | 管理员只用邮箱创建读者；可修改昵称、邮箱、手机号、性别 | 创建密码固定为 `123456`；邮箱冲突拒绝；管理员修改邮箱不要求读者密码；所有修改更新 users 行元数据，不写逐次操作日志 |
| `adminResetReaderPassword(actorId, userId)` | 二次确认后将读者密码重置为固定值 `123456` | 不要求线下身份确认或填写原因；撤销目标用户全部会话并要求首次登录改密；不写逐次操作日志 |
| `adminSoftDeleteReader(actorId, userId, reason?)`、`adminRestoreReader(actorId, userId)` | 软删除只设置 users `del_flag` 并可记录选填删除原因；恢复时清空原因 | 撤销目标用户会话；保留用户和关联数据；恢复前检查邮箱是否已被未删除账号占用，冲突时拒绝；不记录逐次操作日志 |
| `login(input: { email: string; password: string }): Promise<SessionCookieData>`、`logout(sessionId: string): Promise<void>`、`changePassword(userId: string, input: { currentPassword: string; newPassword: string; confirmPassword: string }): Promise<void>` | 验证活跃账号；建立/撤销会话；改密验证旧密码并清除首次改密状态 | 通用凭据错误；按账号、邮箱和来源 IP 限速；普通改密保留当前浏览器会话并撤销其他会话 |
| `deleteAccount(userId: string, input: { currentPassword: string; confirm: true }): Promise<void>` | 读者自助删除账号入口当前停用 | 页面与 API 均不可用；管理员通过上述软删除操作维护读者账号 |
| `lib/auth/authorization.ts`: `requireReader(): Promise<SessionUser>`、`requireAdmin(): Promise<SessionUser>`、`requireAuthenticatedUser(): Promise<SessionUser>`、`requireOwner(userId: string, resourceOwnerId: string): void` | 从服务端会话取得可信身份并检查角色/所有权 | 不得接受客户端角色作为判权依据；匿名或 reader 访问 `/admin` 页面及管理 API 时统一映射为 404，普通账户页面仍按登录边界处理 |
| `lib/articles/service.ts`: `createDraft(input: { sourceMdx: string; files: UploadedAsset[] }, actorId: string): Promise<{ articleId: string; versionId: string; preview: PublicArticle }>` | 验证 frontmatter、受限 MDX、slug、主分类、标签与图片；为唯一管理员的新上传创建草稿版本 | 非管理员拒绝；不合法/危险语法拒绝；slug 已存在时为同文章新建版本，绝不替换当前发布指针；文件校验和保存失败不留下半成品 |
| `publishArticleVersion(versionId: string, actorId: string): Promise<{ slug: string; versionId: string }>`、`withdrawArticle(slug: string, actorId: string): Promise<void>`、`deleteArticle(slug: string, actorId: string): Promise<void>`、`restoreArticle(slug: string, actorId: string): Promise<void>` | 发布前再次校验草稿；发布时事务更新状态和当前版本指针，旧当前版本转为 `archived`；下架、删除和恢复保持收藏关系 | 仅唯一管理员；目标版本/文章不存在报 `NOT_FOUND`；非法状态转换报 `CONFLICT`；切换失败保留原线上版本；V1 不提供文章永久删除 |
| `lib/favorites/service.ts`: `addFavorite(userId: string, articleSlug: string): Promise<void>`、`listFavorites(userId: string): Promise<PublicArticle[]>`、`removeFavorite(userId: string, articleSlug: string): Promise<void>` | active reader/admin 管理自己的收藏；列表按最近收藏时间倒序，只列当前公开文章 | 唯一约束处理并发重复收藏；不存在/下架文章不暴露私有信息；会话所有权来自服务端 |
| `lib/qa/service.ts`: `createQaSession(adminId: string): Promise<{ sessionId: string }>`、`askQuestion(...)` | 仅 active admin 可调用；校验问题与会话所有权；问题最多 2,000 个字符；先检索可用 Wiki 页面，原文兜底只取少量相关片段，不得全量发送文章；模型只能返回服务端提供的来源 ID；输出约 800 个中文字内 | 每名管理员每日最多 5 个成功回答；拒答、供应商错误、超时不计次；60 秒超时且不自动重试；无每分钟限流或每日已提交调用上限；同一会话按提交顺序处理 |
| `listQaSessions(adminId: string): Promise<QaSessionSummary[]>`、`getQaSession(adminId: string, sessionId: string): Promise<QaSession>`、`deleteQaSession(adminId: string, sessionId: string): Promise<void>` | 仅管理员读取/删除自己创建的问答会话；删除同时清理问题、回答及引用 | 所有查询以 admin ID 做数据库约束；其他身份或会话按不可见处理；删除需事务/外键保证完整清理 |
| `lib/ai/deepseek.ts`: `complete(input: { modelId: string; system: string; messages: QaPromptMessage[]; maxOutputTokens: number }): Promise<{ text: string; inputTokens: number; outputTokens: number }>` | 使用仅服务端配置的 API Key 和预先验证的模型；返回供应商文本及用量元数据 | 超时/供应商故障映射为 `MODEL_UNAVAILABLE`；密钥不进入异常、日志、请求响应；数据政策未验证时功能开关关闭 |
| `lib/wiki/service.ts` | 管理员创建/编辑/合并主题页、生成候选版本、审核发布、来源有效性、关系审核及图谱查询 | 发布/文章更新与候选生成解耦；更新失败保留已发布版本；仅有效来源页面进入公开图谱和 QA |

具体 HTTP 路由、表单动作和对象存储 SDK 由实现阶段按仓库约定确定；无论传输形式如何，必须调用上述受测领域边界，不可在组件中直接执行权限敏感 SQL。

### 2.5 搜索、MDX 与安全行为

- 当前搜索行为是契约：匹配已发布文章标题和正文；中文按连续子串匹配，英文不区分大小写；标题匹配排在正文匹配前，同类结果按发布时间倒序；正文摘要截取命中附近文本。数据库和 fixture 实现必须对同一组用例给出相同排序和摘要。
- 文章 frontmatter 必需字段：`slug`、`title`、`publishedAt`、唯一 `category`、`tags`（可空数组）和 `summary`。状态由服务端工作流管理，不从上传 frontmatter 接受。主分类来自受控配置，不做独立分类后台。
- MDX 解析器只把白名单语法转换成 `ArticleBlock`；拒绝危险表达式、导入/导出、脚本、任意 JSX、未经清理的 HTML、危险链接协议和路径穿越。外链图片只允许 HTTPS；上传图片验证类型、扩展名、大小及内容签名，具体上限记录在实施配置中。
- 上传的源文与解析结果一并保存；渲染只处理结构化白名单节点。草稿预览须通过管理员授权，不能因链接可猜测而公开。
- 账号注册、登录、管理员密码重置和上传端点须有限速、输入校验和通用错误响应。HTTP-only、Secure（生产）、SameSite Cookie；CSRF 防护按所用传输方式落实。
- 服务端日志脱敏：不得记录密码、临时密码、会话 cookie、API Key 或完整敏感问答内容。上传/模型失败应安全降级，不能向读者展示数据库、对象存储或供应商内部信息。

## 3. 实施分步任务清单（Task Checklist）

按依赖顺序执行。每一项必须完成其验证后再进入后续项。`npm test` 是仓库规定的测试命令；最终整体验收还须执行 lint、类型检查和生产构建。Issue 01/03 是验证工作，不得伪造为代码实现完成；当前可在本地继续开发。IP/HTTP 目标允许注册/登录及所有已登录用户收藏；问答仅 admin 可用。服务端授权、限速、目标环境验收和适用的管理操作审计仍是上线门槛，读者账号管理的变更仅保留用户表元数据，HTTPS 不是功能开关。

### A. 基线与公开博客

- [ ] 建立本规格对应的实现任务/依赖状态，确认当前工作树及本地测试基线；验证：记录 `git status --short`，运行 `npm test`。
- [x] 完成 Flexus L 私有单机、自管 PostgreSQL、持久图片目录、迁移和逻辑备份恢复试点；验证记录见 Issue 01。公网开放仍等待目标网络与公开边界验收；CloudBase、域名、备案和 HTTPS 已明确排除。
- [ ] 确认当前 PostgreSQL schema、公开查询、路由及 fixture 的基线行为；验证：`npm test` 覆盖 `lib/schema.test.ts`、`lib/content.test.ts`，并运行 `npm run lint`、`npm run typecheck`、`npm run build`。
- [ ] 补足公开内容边界和查询测试，覆盖草稿、下架、删除及非当前版本不可见；验证：数据库仓储测试对每种状态断言首页、分类、标签、详情和搜索均不返回非公开文章，运行 `npm test`。
- [ ] 固定 fixture 与 PostgreSQL 的搜索契约，覆盖中文连续子串、英文大小写、标题优先、正文附近摘要、空查询和无结果；验证：同一组断言分别运行 fixture 与 PGlite 仓储测试，执行 `npm test`。
- [ ] 完成公开路由空态、缺失文章、响应式和可访问性检查，确认联系作者使用配置的 `mailto` 且无评论入口；验证：公开路由组件测试/手动匿名验收通过，运行 `npm run lint`、`npm run typecheck`、`npm run build`。
- [ ] （条件任务）若负责人决定将服务公开到公网 IP/HTTP，完成目标网络、安全组和分角色验收；注册/登录及 reader/admin 收藏可用，问答仅 admin 可用。管理写操作由服务端授权和限速保护；需审计的操作按各自 Issue 验收，读者账号管理只保留用户表字段。公网开放前核对云平台对当前实例和访问方式的适用要求，并记录完整安全组规则及已接受的风险例外。负责人不要求数据库或文章图片备份/恢复并接受数据不可恢复风险。

### B. 账号与文章管理

- [x] 记录不接入邮件服务的账号方案；验证：Issue 03 标记 `wontfix`，ADR-0005、词汇表和账号规格同步记录邮箱登录基线；管理员读者初始/重置密码以 2026-11-14 新确认规则为准。
- [ ] 增加账号及文章源文所需的向前兼容迁移，保留原有数据与迁移顺序；验证：PGlite 从空库和已有 0001/0002 数据应用全部迁移，确认旧文章可读，`npm test`。
- [x] 实现基础密码哈希、会话、首次改密状态和服务端身份读取；验证：认证测试覆盖哈希而非明文、首次登录强制改密及 cookie 属性，运行 `npm test`。当前管理员固定密码和新账号管理要求尚待 Issue 11 实现。
- [x] 实现原有注册、登录、登出、管理员重置密码、登录后改密及统一防枚举响应；验证记录见 Issue 04 历史评论。旧随机临时密码和逐次审计行为由新需求取代。
- [x] 实现 reader/admin 服务端授权和受控管理员初始化；验证：读者不能访问管理员操作、伪造客户端角色无效、公开注册永远生成 reader；测试不得创建可用于生产的管理员密钥或账号。
- [x] 实现原有账号设置与头像菜单；验证记录见 Issue 04 历史评论。个人中心新布局和字段、头像上传及读者自助删除停用尚待 Issue 11 实现。
- [ ] 完成公共左右布局、个人中心基础信息/邮箱/密码标签页及保存、重置、失败与成功反馈；验证：按 Issue 11 对 reader/admin/匿名用户验收并运行 `npm test`。
- [ ] 完成头像上传、预览、确认保存和本人私有读取；前置：在已购华为云服务器的私有持久目录上验证应用写入、实际上传/读取及容器与主机重启持久性。目录未确定前不固化示例路径；验证：路径由实施记录确认，权限和持久性验收通过后再开放上传。
- [ ] 完成管理员 `/admin` 公共布局、账号管理和 404 权限边界；验证：`/admin` 重定向到 `/admin/readers`，匿名/reader 对所有管理页和 API 均得 404 且页面有返回首页链接；运行 `npm test`、`npm run typecheck`。
- [ ] 完成读者创建/编辑/密码重置/软删除/恢复流程；验证：固定初始密码 `123456`、邮箱冲突规则、选填删除原因与恢复清理、会话撤销、用户行字段更新均符合 Issue 11；不写逐次操作日志，运行 `npm test`。
- [ ] 暂停读者自助删除页面及 API；验证：reader/admin/匿名均不能触发自助硬删除，账号和关联数据仅由管理员软删除保留。
- [ ] 完成受限 MDX 解析、图片持久化和文章版本工作流；验收细节见 Issue 05。
- [ ] 将管理员文章管理页接入 Issue 11 公共左右布局；验证：Issue 05 的文章操作规则保持不变，运行 `npm test`、`npm run typecheck`。AI 设置与问答按 Issue 07 实施；DeepSeek API 专属数据政策核验通过前保持关闭。

### C. 收藏

- [ ] 创建收藏表及唯一约束，按稳定 `article_id` 维护收藏关系；验证：迁移测试验证唯一约束和账号删除清理，运行 `npm test`。
- [ ] 实现收藏添加、列表、移除及归属校验；验证：并发重复添加仍只有一条；reader/admin 均可用但他人不能列出/删除；下架隐藏、重发恢复且时间倒序，运行 `npm test`。
- [x] 接入文章页收藏按钮和所有登录用户的收藏列表；验证：访客引导登录，reader/admin 只看到自己的当前公开文章收藏，无收藏和文章下架均有明确空态，运行 lint、typecheck、test。实现记录见 Issue 06；公网启用另受 Issue 08 验收控制。

### D. 管理员问答与每日配额

- [ ] 核实 DeepSeek API 专属数据处理政策；不把未经证实的不用于训练或保留期限承诺写成事实。验证：按 Issue 07 留存一手来源证据；政策不明确或不满足要求时问答保持关闭。
- [ ] 增加会话、问答消息、引用和每日配额数据结构；验证：迁移测试检查外键、唯一约束、删除级联、业务日记录及索引，运行 `npm test`。
- [ ] 实现先检索已发布 Wiki 页面、无合适结果时检索少量当前已发布文章原文片段的流程；验证：不向模型发送全部文章，草稿、下架、旧非当前版本不能作为来源，引用 href 必须由服务端生成，运行 `npm test`。
- [ ] 实现 DeepSeek 服务端适配、模型 allowlist、60 秒超时、token 用量记录和脱敏日志；限制问题最多 2,000 字符，不自动重试。验证：mock provider 覆盖成功、超时、供应商错误及密钥从客户端 bundle/响应/日志不可见，运行 `npm test`。
- [ ] 实现仅管理员可用的 `Asia/Shanghai` 自然日最多 5 次成功回答原子配额；验证：匿名/reader 被拒绝，管理员并发不超过 5 个成功回答；超时、供应商错误和证据不足拒答不计数；边界时区正确归日，运行 `npm test`。
- [ ] 实现回答引用校验、证据不足拒答、约 800 个中文字目标和问答会话生命周期；验证：固定可回答、跨文章、错误来源和证据不足题通过；会话越权不可读；删除会话清理其问题、回答和引用；运行 `npm test`。
- [ ] 实现管理员问答/会话 UI、从文章页提问及管理员模型/用量状态设置；验证：入口只对 admin 显示且服务端拒绝其他角色、API Key 不下发、会话隔离、成功回答配额和超时显示安全提示，运行 lint、typecheck、test。

### E. 安全加固与首发验收

- [ ] 完成认证、上传、管理写操作、收藏和问答的端到端授权、输入限制、限速及失败降级；验证：匿名/reader/admin 三角色端到端测试通过，DB、对象存储和模型故障不泄漏内部信息。
- [ ] 按能力分阶段执行生产验收：注册/登录与 reader/admin 收藏依赖 Issue 04/06 和账号授权限速验收；管理员文章写操作依赖 Issue 05/11；管理员问答另依赖 Issue 07 及数据政策/配额验收。验证：各自记录开关状态、分角色 E2E、成本或 token 用量和回滚结果；公网验收保存完整安全组规则证据，标记负责人接受但未通过安全加固的风险；一个能力未通过不自动关闭其他已通过能力。
- [ ] 确认功能开关符合门槛；验证：目标环境未验收前不宣称公网开放；IP/HTTP 下注册、登录和 reader/admin 收藏可用；问答仅 admin 且未通过 API 数据政策核验时关闭；公开博客仍可匿名使用。不要求备份或恢复演练。
- [ ] 执行首发完整质量门禁；验证：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 全部通过，并完成目标环境匿名、reader、admin 验收。

### F. Wiki 页面与知识图谱

- [ ] 建立 Wiki 主题页、页面版本、文章版本来源和已审核页面关系的数据结构；验证：候选版本不覆盖已发布版本，来源和关系历史可追溯，运行 `npm test`。
- [ ] 为当前全部已发布文章生成初始 Wiki 候选页；验证：所有候选都关联有效文章版本，生成结果只在管理员后台可见，运行 `npm test`。
- [ ] 实现 `/admin/wiki` 手动建页、编辑、合并和按页面审核 AI 候选正文/来源/关系；验证：管理员授权、页面版本保留、一个页面的决定不改动无关页面，运行 `npm test`。
- [ ] 实现文章发布/新版本后的异步候选更新；验证：不阻塞文章发布，失败保留原页面，失去全部有效来源的页面从公开图谱及 QA 隐藏，运行 `npm test`。
- [ ] 实现访客/读者可访问的 Wiki 入口、可点击知识图谱和已发布主题详情；验证：草稿及待审核关系不出现在公开查询，现有文章首页不变，运行 lint、typecheck、test。
- [ ] 首版使用 PostgreSQL 搜索 Wiki 页面和原文片段，不引入向量数据库；不依赖上游 `llm_wiki` 桌面程序。

## 4. 完成定义

- 公共页面只暴露当前已发布版本，匿名访问不依赖账号；草稿、下架及已删除内容不进入公开查询。只有负责人本人作为唯一管理员可以上传、预览、发布、下架和恢复文章。
- 账号和收藏在服务端授权/限速验收后可通过公网 IP/HTTP 使用，reader/admin 均可收藏；问答仅 admin，且只有在 DeepSeek API 数据政策核验通过后开放，并按每日成功回答次数限额。需审计的管理操作须有服务端管理员授权、限速和审计；读者账号管理仅保留用户表字段。HTTPS 不是单独的关闭条件。目标环境未验收前不得宣称已公网开放。
- 数据迁移可重复应用；关键事务、授权、所有权、并发限额、失败回退和安全边界有自动化测试覆盖。
- `npm run lint`、`npm run typecheck`、`npm test`、`npm run build` 通过；目标环境发布和成本记录齐全。负责人不要求数据库或文章图片备份恢复，因此不要求恢复演练记录。
- Wiki 页面与知识图谱按 Issue 10 实施；管理员问答按 Issue 07 实施，优先检索 Wiki 并以少量原文检索兜底。Issue 09 比较评估维持 `wontfix`，不作为实施门槛。DeepSeek API 专属数据处理政策核验通过前，不向供应商发送问题、Wiki 内容或文章原文。

## 5. 决策来源

- [ADR-0001：独立博客仓库与 MDX 内容源](./adr/0001-separate-blog-repository-and-mdx.md)（独立仓库和旧 RAG 数据隔离仍有效；内容入口由 ADR-0004 更新）。
- [ADR-0002：CloudBase PostgreSQL 试点与费用核算](./adr/0002-cloudbase-postgresql-pilot.md)。
- [ADR-0003：Wiki 页面与管理员问答](./adr/0003-validate-llm-wiki-before-adoption.md)。
- [ADR-0004：通过管理页上传 MDX 维护文章](./adr/0004-admin-uploaded-mdx-articles.md)。
- [ADR-0005：密码账号不依赖邮件服务](./adr/0005-password-accounts-with-email-links.md)。
- [ADR-0006：公网 IP/HTTP 与角色功能边界](./adr/0006-ip-http-and-role-feature-boundaries.md)。
- [ADR-0007：头像存放在华为云服务器私有持久目录](./adr/0007-private-avatar-storage-on-huawei-server.md)。
- 相关实施细化与依赖：[`.scratch/personal-tech-blog/spec.md`](../.scratch/personal-tech-blog/spec.md) 及其中 Issue 01-11。出现冲突时以 ADR 和负责人明确决策为准；不要通过本规格静默改写架构决策。
