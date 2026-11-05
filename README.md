# Wikilog

本地可运行的公开博客初版，使用 Next.js App Router、TypeScript 和本地种子文章。当前不连接数据库，也不提供持久化文章上传、账号或邮件功能。

## 本地运行

需要 Node.js 20.9 或更高版本。

```powershell
npm install
npm run dev
```

开发服务器默认地址为 `http://127.0.0.1:3000`。如需更改联系邮箱，可从 `.env.example` 创建本地 `.env.local` 并设置 `NEXT_PUBLIC_CONTACT_EMAIL`。

## 内容与检查

- 文章、分类、标签和公开查询位于 `lib/content.ts`。
- 技术主题封面位于 `public/covers/`。
- 运行 `npm run lint`、`npm run typecheck`、`npm test` 和 `npm run build` 执行项目检查。

数据库、对象存储、生产部署和 CI/CD 尚未确定；公开发版前按博客规格完成 Issue 01 和 Issue 08 的验证。
