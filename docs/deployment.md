# 自动部署

## 部署测试记录

2026-11-20：负责人已完成华为云服务器上的 CI/CD 部署测试。由提交 `5a106ca` 触发的 GitHub Actions 运行中，`Verify`、`Publish image` 和 `Deploy application` 三个 job 均成功：质量检查和 Linux/amd64 镜像构建通过，镜像按提交 SHA 发布到 SWR，服务器上的 Web 服务更新并通过健康检查；负责人确认服务器 IP/HTTP 地址可以正常访问。

本次记录证明 CI/CD、SWR 镜像发布、SSH 部署、Web 健康检查和基本访问链路已经跑通。它不替代 Issue 08 要求的匿名、reader、admin 分角色端到端验收，也不代表问答或 Wiki AI 功能已经启用；当前 AI 问答和 Wiki AI 生成仍保持关闭。CloudBase、域名、备案和 HTTPS 继续排除。

本次运行出现的 action Node.js 运行时弃用提示不影响结果；后续更新 workflow 使用的 action 版本时，应再次执行 CI 验证。部署凭据和服务器上的 SWR 拉取文件不写入仓库，自动部署、SWR 凭据和服务器部署方案以当前已验证配置为准，后续调整需单独确认。

## Issue 08 匿名线上验收

2026-11-20（Asia/Shanghai）：负责人在已部署的 IP/HTTP 地址 `http://113.46.135.254/` 完成匿名线上验收。本次只使用匿名访客，不修改服务器配置，不开启账号、收藏、Wiki 或 AI 功能。

- **通过**：首页、已上架文章详情、分类、标签、搜索、静态资源和文章封面可访问；抽检的公开页面没有明显 5xx，也没有发现 `DATABASE_URL`、`DEEPSEEK_API_KEY`、`postgresql://` 或 `WIKILOG_SWR_PASSWORD` 等敏感标记。
- **通过（匿名边界）**：匿名访问 `/admin`、`/admin/ai` 和 `/api/admin/qa/sessions` 均被拒绝并返回 404；`/account` 进入登录流程。缺失文章 ID 的直接访问返回 404，刷新后结果保持一致。
- **无法验证**：无法从匿名视角分别证明草稿、下架和删除文章三种状态；`/wiki` 可访问但当前没有已发布 Wiki 主题，无法验证已发布主题详情和图谱关系；服务器日志本次未读取。
- **未启用**：`AUTH_ENABLED=false` 下登录和注册页面明确提示账号功能尚未开放，因此没有进行账号、收藏、HTTP 会话、reader/admin 隔离或限速验收。读者账号管理同样未启用。
- **未启用/无法验证**：AI 问答入口和匿名问答 API 保持关闭且未调用 DeepSeek；实际 `ADMIN_QA_ENABLED`、`DEEPSEEK_DATA_POLICY_VERIFIED` 和 `WIKI_AI_GENERATION_ENABLED` 环境变量值无法从公开页面独立核实。Wiki AI 生成没有调用。
- **无法验证**：管理员文章写入、分类/标签维护、管理写接口限速和审计、保存失败回滚，以及管理员工作区流程需要有效 admin 会话，本次没有执行。

本地 `npm test` 同期通过 38 个测试文件、178 个测试；这属于自动化代码验证，不能替代上述线上手工验收。当前结论是匿名公开访问和匿名拒绝边界通过，账号/收藏、管理员管理、读者账号管理和 Wiki 实际内容验收尚未完成，因此 Issue 08 不能整体标记为通过。后续先继续本地功能实现，待负责人明确开启账号或 Wiki 后再分别进行目标环境验收。CloudBase、域名、备案和 HTTPS 继续排除；AI 问答和 Wiki AI 生成继续关闭。

仓库的 GitHub Actions 分为三个阶段：

- `verify` 在 Pull Request 和 `main` 推送执行测试、类型检查、lint、生产构建和 Linux/amd64 Docker 构建。此阶段不登录 SWR、不推送镜像、不连接服务器。
- `publish` 只在 `main` 推送且 `verify` 成功后运行，向华为云 SWR 推送 `registry/repository:<commit-sha>`。不使用 `latest`，也不执行数据库迁移。
- `deploy` 只在 `publish` 成功后运行，通过固定主机公钥的 SSH 连接服务器，调用 [`deploy/remote-deploy.sh`](../deploy/remote-deploy.sh)。脚本只更新 `web` 服务，使用 Compose override 指向新镜像；PostgreSQL 不在 Compose 命令中作为依赖重建。健康检查失败时自动恢复之前的 Web 镜像并再次检查健康状态，工作流会以失败状态结束并报告回滚结果。

部署脚本要求服务器已有 `/srv/wikilog/.swr-pull.env`，权限为 `600`，内容格式如下。真实值只在服务器上填写，不提交仓库，不放入 GitHub workflow：

```dotenv
WIKILOG_SWR_USERNAME=<pull-only-SWR-username>
WIKILOG_SWR_PASSWORD=<pull-only-SWR-password-or-token>
```

服务器需预先准备专用部署账号（例如 `wikilog-deploy`），只允许使用专用 Ed25519 公钥登录；该账号需要读取 `/srv/wikilog` 下的生产 Compose、`.env` 和 SWR 拉取文件，并对 `/srv/wikilog/deploy-state` 有写权限。加入 `docker` 组即可完成 Docker 操作，但 Docker 组等同于高权限，必须把该账号和私钥仅用于本项目部署。不要复用临时 SSH 密钥，也不要使用 root 私钥。

服务器还需保持以下前置条件：`wikilog-pilot` 外部网络存在，`wikilog-postgres-pilot` 正常运行，Nginx 已监听 80 并把请求转发到 `127.0.0.1:3000`，`curl` 和 Docker Compose 可用。部署脚本不会执行迁移、创建管理员、修改数据库权限或启动 PostgreSQL。

## GitHub 手动配置

在仓库 Settings 中配置以下 Actions Variables：

| 名称 | 内容 |
| --- | --- |
| `WIKILOG_SWR_REGISTRY` | SWR 区域 registry 主机，例如 `swr.cn-south-1.myhuaweicloud.com` |
| `WIKILOG_SWR_IMAGE` | SWR 组织和仓库路径，例如 `my-org/wikilog` |
| `WIKILOG_DEPLOY_HOST` | 服务器公网 IP 或 DNS 主机名 |
| `WIKILOG_DEPLOY_PORT` | SSH 端口，通常为 `22`；留空时 workflow 使用 `22` |
| `WIKILOG_DEPLOY_USER` | 专用部署账号，例如 `wikilog-deploy` |

在 Secrets 中配置以下值。不要把值贴到聊天或提交到仓库：

| 名称 | 内容 |
| --- | --- |
| `WIKILOG_SWR_USERNAME` | 具备推送权限的 SWR 用户或机器人用户名 |
| `WIKILOG_SWR_PASSWORD` | 对应的 SWR 密码或令牌 |
| `WIKILOG_DEPLOY_SSH_PRIVATE_KEY` | 专用部署账号的 Ed25519 私钥，GitHub Actions 只在 runner 临时目录使用 |
| `WIKILOG_DEPLOY_KNOWN_HOSTS` | 从可信控制台或已核验 SSH 连接取得的服务器主机公钥行，完整写入该 Secret；workflow 使用 `StrictHostKeyChecking=yes`，不会运行 `ssh-keyscan` 自动信任未知主机 |

SWR 推送账号和服务器上的 SWR 拉取账号应分开，拉取账号只授予目标仓库的 pull 权限。部署账号的 SSH 公钥、SWR 拉取文件和 GitHub Secret 由负责人手动创建和撤销。首次启用前，先在 GitHub Actions 的测试分支验证 `verify`，再确认 `main` 保护规则要求 workflow 成功后才能合并；本次不会代为推送、部署或创建任何 Secret。

回滚由远程脚本在健康检查失败时自动完成。服务器会保留 `/srv/wikilog/deploy-state/.wikilog-previous-image` 和 Compose override；若自动回滚也失败，workflow 会失败并输出 `ROLLBACK_FAILED`，需要负责人登录服务器检查容器状态后按该文件中的上一镜像引用手动恢复。数据库卷和内容数据不会被回滚脚本删除或重建。

自动回滚失败时，可由负责人在服务器上执行以下手动恢复步骤；命令只更新 `web`，不会启动迁移或操作 PostgreSQL：

```sh
previous_image=$(cat /srv/wikilog/deploy-state/.wikilog-previous-image)
cat > /srv/wikilog/deploy-state/docker-compose.deploy.override.yml <<EOF
services:
  web:
    image: ${previous_image}
EOF
docker compose -p wikilog \
  -f /srv/wikilog/docker-compose.production.yml \
  -f /srv/wikilog/deploy-state/docker-compose.deploy.override.yml \
  up -d --no-deps --pull never web
curl --fail --silent --show-error --max-time 10 http://127.0.0.1/
```
