# Wikilog

Next.js App Router + TypeScript 的个人技术博客。公开文章、分类和标签从服务端查询 PostgreSQL；没有配置 `DATABASE_URL` 时使用本地种子 fixture。数据库密码和查询只存在于服务器端，不会打包到浏览器。

## 本地运行

需要 Node.js 20.9+ 和 Docker Desktop（包含 Docker Compose）。

```powershell
npm install
Copy-Item .env.example .env.local
npm run db:setup
npm run dev
```

打开 `http://127.0.0.1:3000`。`.env.local` 和数据库卷只用于本地开发。Docker PostgreSQL 绑定到 `127.0.0.1:5432`，不会监听局域网接口。

`db:setup` 会启动数据库、应用 SQL 迁移，并写入示例分类、标签、文章和草稿。种子脚本用于空白本地开发库，不要拿它覆盖真实线上内容。Docker volume 会在停止容器后保留数据。

常用命令：

```powershell
npm run db:start
npm run db:migrate
npm run db:seed
npm run db:stop
```

## 数据模型

- `users` 保存邮箱、昵称、密码哈希、角色和账号状态；当前没有注册或登录 API，不创建真实用户。
- `categories`、`tags` 保存受控分类和标签。
- `articles` 保存稳定 slug 与当前已发布版本指针。
- `article_versions` 保存文章元数据、JSON 正文、搜索文本和草稿/已发布状态。
- `article_version_tags` 关联版本与标签。
- 所有业务表统一包含创建/修改时间、创建/修改用户和 `del_flag` 软删除标记；操作者字段可为空，直到账号与后台功能接入。文章原有 `deleted_at` 会在迁移时同步到 `del_flag`。

公开查询只通过文章的当前已发布版本读取，并排除草稿、下架和已删除文章。数据库 schema 在 `db/migrations/`，本地种子数据在 `lib/content.ts`。

## 检查

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

生产数据库、对象存储、备份与公开部署仍待 Issue 01/08 验证；此本地 PostgreSQL 配置不是线上供应商承诺。
