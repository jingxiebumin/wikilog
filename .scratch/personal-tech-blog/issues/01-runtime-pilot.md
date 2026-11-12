# Issue 01: 验证运行平台、数据库与配图存储

Status: ready-for-human
Type: research

## 目标

验收华为云 Flexus L 上的私有单机试点：以 Next.js App Router、单机 PostgreSQL 和可持久化配图目录验证公开内容的私下读取、数据持久性与恢复能力，并记录资源和费用。该 Flexus 方案是 CloudBase 方案的替代试点，不代表 CloudBase PostgreSQL 通过。

## 工作

- 在服务器上运行生产 Web 容器和 PostgreSQL；Web 仅绑定 `127.0.0.1:3000`，PostgreSQL 不映射宿主机端口。
- 通过本机请求和 SSH 隧道验证首页、已发布文章、分类、标签、搜索与关于页；确认草稿不可公开读取、账号功能关闭、数据库凭据未泄漏。
- 验证数据库迁移可重复执行、逻辑备份可下载并校验 SHA-256、可恢复至临时数据库并核对表/迁移/行数。
- 验证图片目录只读挂载及文件在容器重建、Docker 重启和主机重启后的持久性；真实上传流程不在本 Issue 范围。
- 记录主机资源、首年与续费价格、流量包和超额费用；本轮不把月费低于人民币 20 元作为硬门槛。
- 记录负责人接受的安全组风险例外；不修改安全组、不开放端口。

## 验收标准

- 私有单机试点的生产 Web/PostgreSQL 容器、迁移、已发布内容读取、草稿隔离、只读图片目录和备份恢复均有实测记录。
- Docker/主机重启后数据可读；资源和费用已记录；没有创建真实用户或管理员数据。
- 安全组由负责人决定暂不调整，作为已接受的风险例外记录；这不代表安全加固通过。
- 公网访问、ICP备案、HTTPS 和 CloudBase PostgreSQL 均不属于本次验收范围，不能记为已验证。
- Flexus 单机方案仅作为 CloudBase 方案的替代试点；不因此新增/修改长期架构 ADR。

## 验证记录

2026-11-09：完成仓库侧验证及供应商官方资料调研。Issue 01 尚未通过；没有将本地 PostgreSQL 证据当作 CloudBase 验收，也未创建线上用户或管理员数据。

### 部署平台

- **推荐试点方向**：CloudBase 上海云托管运行 Next.js 容器，配 CloudBase PostgreSQL 与上海 COS 桶。CloudBase 官方文档说明云托管支持容器化框架、上海地域、代码/Git/镜像部署和按量计费，可自动缩至 0；相比静态托管，它与本项目 App Router SSR、Route Handler 和受保护写操作更匹配。来源：[云托管介绍](https://docs.cloudbase.net/run/introduction)、[静态托管介绍](https://docs.cloudbase.net/hosting/introduce)。这是候选配置，不代表已部署或长期选定。
- 官方 ICP 指引称个人版及以上、剩余有效期至少 6 个月且云托管需固定 IP；免费体验版不支持备案。免费体验版单次周期为 6 个月且仅可在到期前续期，不能作为持续生产依据。来源：[CloudBase ICP 备案指引](https://docs.cloudbase.net/icp/)、[CloudBase 定价](https://tcb.cloud.tencent.com/pricing)。
- CloudBase 定价页当前列出 FREE `¥0`（每月 3000 资源点、每账号 1 个免费环境、单次续期 6 个月）及 PERSONAL `¥19.9/月`（当前限时优惠、每月 40000 资源点）。页面没有给出该限时优惠截止时间/原价，且超额可按量计费；不能将 `¥19.9` 当作试用后的稳定总成本。
- Vercel 官方将 Hobby 标为免费、Pro 为 `$20/月`，后者单项即超过本项目 `¥20/月` 总目标。Vercel Next.js 支持能力充分，但没有目标中国大陆网络实测及备案/域名评估，不推荐作为当前大陆读者生产首选。来源：[Vercel 定价](https://vercel.com/pricing)、[Vercel Next.js 支持](https://vercel.com/docs/frameworks/full-stack/nextjs)。
- **未验证**：CloudBase 部署是否成功、App Router SSR/API 在上海目标环境能否正常运行、Git 部署/环境变量注入、大陆不同运营商的访问和延迟、真实备案路径及域名费用。没有供应商账号和部署环境，不能标为通过。正式部署必须将 `DATABASE_URL`、COS 凭据放在服务端运行时环境变量，禁止 `NEXT_PUBLIC_` 前缀。

### PostgreSQL

- **本地实际验证**：当前 Docker PostgreSQL 18.6 容器 healthy，监听只绑定 `127.0.0.1:5432`；`pg_isready` 成功，服务端 `max_connections=100`。仓储连接池配置 `max: 5`，迁移池 `max: 2`。`npm run db:migrate` 连续执行两次均报告 schema up to date。容器内 `pg_dump 18.6` 成功生成 schema-only dump（当前包含 16 条 CREATE TABLE/INDEX 语句）。Node `pg` 本地 `SELECT 1` 十次耗时为 1.57–39.49ms，均值 6.05ms；这是 Windows 本机 Docker 延迟，不代表上海云端访问延迟。来源为仓库 [docker-compose.yml](../../../docker-compose.yml)、[lib/db.ts](../../../lib/db.ts)、[scripts/migrate.ts](../../../scripts/migrate.ts) 及本轮命令输出。
- CloudBase 官方连接管理文档确认有实例直连和平台连接池入口；应按最大应用实例数 × 每进程 `pg.Pool.max` 评估直连连接占用。平台连接池适合短请求，但连接会话状态不连续，事务需固定在同一客户端。当前应用 `max: 5`，若部署平台水平扩容，仍需按上限核对实际实例连接额。来源：[CloudBase PostgreSQL 连接管理](https://docs.cloudbase.net/database/postgresql/connection-management)。
- 官方备份文档说明支持备份/回档能力，但实际保留时长、计划、费用、恢复入口和可恢复粒度以实例规格/控制台为准；恢复可能生成新数据库，需重新核验并迁移应用连接。逻辑备份可用 `pg_dump` 另行补充。官方能力不等于本项目已配置备份或通过恢复演练。来源：[CloudBase PostgreSQL 备份与回档](https://docs.cloudbase.net/database/postgresql/backup)。
- CloudBase PostgreSQL 费用由规格、存储和超赠送备份空间组成；官方计费说明称当前日志与流量费用暂免，但具体价格和资源点需账号/控制台核价。普通腾讯云 PostgreSQL 的公开规格价格不能替代 CloudBase 共享实例报价。来源：[CloudBase PostgreSQL 计费概述](https://cloud.tencent.com/document/product/409/49577)、[CloudBase 定价](https://tcb.cloud.tencent.com/pricing)。
- **未验证**：没有 CloudBase 实例，未验证连接串/TLS/网络访问、真实迁移、云端连接上限、备份任务及恢复、上海延迟、实例资源点/试用后价格。当前本地迁移只是迁移脚本和本地 PostgreSQL 兼容性的证据。

### 配图存储

- **候选方案**：COS 上海桶；文章内保存稳定对象 key，公开已发布图片从 COS 匿名读取。COS 官方说明对象默认私有读写，匿名 URL 读取需明确将桶/对象配置为公有读。公有读 URL 可被任何人访问，因此只适用于公开文章配图；草稿预览应由管理员鉴权后通过应用服务端读取，或使用短时预签名 URL。来源：[COS 授权与身份认证](https://cloud.tencent.com/document/product/436/68279)、[COS 临时密钥](https://cloud.tencent.com/document/product/436/68283)。
- 上传凭据应使用只允许指定桶/前缀读写的服务端 CAM 身份，长期 Secret 不进入浏览器；必要时由服务端签发受限 STS 凭据。COS 文档说明 STS 凭据有效期为 30 分钟至 36 小时，并可用 policy 收窄权限。首版可用应用服务端上传，简单且不暴露长期密钥；公开读取只对已发布 key 开放。
- 上传限制须由 Issue 05 应用层强制执行：扩展名/MIME 与文件签名联合检查，限制图片格式、单文件大小和单次数量；COS 策略再限制可写 key 前缀。供应商限制及桶策略目前未实测，具体大小上限由负责人在部署配置中定值。
- 删除策略建议：下架文章不立即删图，以便恢复；版本/文章永久删除后，事务记录待清理 key，由后台清理任务删除 COS 对象，并对孤儿对象定期对账。此为建议的生命周期策略，尚未实现。
- COS 新开通个人用户官方免费额度为 50GB 标准存储、有效 180 天，只抵标准存储容量，不抵扣请求、流量或非标准存储。到期后的月费和公网下行费用依赖实际使用量，无法据免费额度证明持续成本符合目标。来源：[COS 免费额度说明](https://cloud.tencent.com/document/product/436/6240)。
- **未验证**：没有 COS 桶或密钥，未实际上传、匿名读取、校验拒绝、删除对象、重部署后再读，也没有按预期图片大小/浏览量核算流量成本。

### 月成本和验收结论

- 目标 `网站 + 数据库 ≤ ¥20/月` **未通过/尚不能确认**。CloudBase PERSONAL 当前促销价 `¥19.9/月` 已占据几乎全部预算，但资源池还覆盖部署、数据库、存储、CDN 等消耗，不代表必然包含足够的目标用量；超资源点按量、COS 标准存储到期费用、请求/公网下行、域名、备案/固定 IP 或额外产品费用需另计并按实际价格核算。Vercel Pro `$20/月` 不符合目标；Vercel Hobby 免费档的大陆访问和条款适用性未验收。
- 成本估算应分为固定月费、套餐资源点消耗、超量按量费和非月付/未计费用。当前固定成本没有可承诺的≤¥20配置，因此不得上线读者账号或宣称成本门槛达标。
- **Issue 01 未通过**：缺目标云账号/项目、选定的 CloudBase 套餐/实例规格与价格确认、COS 桶及费用核算、实际部署、境内匿名访问/延迟测试、云端迁移、备份恢复演练、上传与匿名读图及重部署持久性测试。
- **负责人需决定/提供**：是否接受 CloudBase 上海云托管 + CloudBase PostgreSQL + COS 作为试点组合；提供可用的腾讯云项目/控制台访问或由负责人执行创建资源；确认域名/备案责任和月成本上限；在控制台确认长期（非促销）套餐、数据库规格/连接上限/备份保留及 COS 费用后，安排目标环境验收。不得提供密钥到聊天或仓库，应由负责人配置服务端环境变量。
- 公开博客 Issue 02 与读者账号 Issue 04 的代码状态不替代运行平台验收。**Issue 05 尚不满足开始条件**：Issue 01 未完成；Issue 04 已实现且可作为代码依赖，但账号入口必须继续受运行/发布门槛关闭。Issue 05 的实现可否先做离线代码工作由负责人决定；不得将其解释为已具备生产部署条件。

### 本轮检查

- `npm run lint`、`npm run typecheck`、`npm run build`：通过。
- `npm test` 首次默认并行运行有 3 个 PGlite 用例失败；使用单 worker 重跑 `npm test -- --maxWorkers=1 --minWorkers=1 --reporter=verbose` 后 9 个文件、20 个测试全部通过。初次失败疑似并行资源争用，本轮未改代码；需 CI/默认并行环境复核。
- 未新增或修改 ADR：目前只有候选推荐和未完成试点，没有形成长期架构承诺。

## 已购买服务器后的验证步骤

2026-11-09：负责人已购买华为云 Flexus 应用服务器 L 试点套餐。订单截图显示广州、2 核/2 GiB、40 GiB 系统盘、峰值带宽 2 Mbps、月流量 100 GB、1 年 ¥36。最终金额、到期日、续费价和超额流量单价以订单/费用中心为准。此机器是 CloudBase PostgreSQL 之外的**候选单机替代方案**；验证通过并由负责人接受前，不视为修改了 ADR-0002 的长期决策。

2026-11-09：负责人提供服务器终端截图，实际证据为 Ubuntu 24.04.4 LTS (Noble)、x86_64、2 vCPU、40 GiB 根盘（约 35 GiB 可用）、`free -h` 显示总内存 1.7 GiB/可用 1.4 GiB、Swap 0；执行 `docker --version` 返回 `Command 'docker' not found`。Docker 当前未安装。截图来自登录后的 root shell；公网 IP 已遮挡/未记录。本轮尚未验证网络安全组、SSH 来源限制、Docker 安装及容器运行。

2026-11-09：后续截图确认 Docker Engine `29.9.3`、Docker Compose `v5.7.0` 已安装，`systemctl is-active docker` 返回 `active`。`docker run hello-world` 已启动，但截图停留在 `Unable to find image 'hello-world:latest' locally`，这是首次运行尝试拉取镜像时的提示，不是成功或失败结果；等待 pull 完成并看到 hello-world 成功正文后，才记录容器运行测试通过。

2026-11-09：负责人补充 `hello-world` 拉取失败截图，Docker daemon 请求 `https://registry-1.docker.io/v2/library/hello-world/manifests/latest` 时，对解析出的地址 `104.244.43.136:443` 连接超时（`i/o timeout`）。这是 Docker Hub Registry 的出站 HTTPS 连通性失败证据，尚不能区分 Flexus L 出站安全组/本机网络策略与目标域名链路问题；不属于 Docker 未安装、镜像名错误或数据库问题。Docker Hub 拉取和容器成功运行仍未验收。

处理步骤：先用 `getent hosts registry-1.docker.io`、`curl -I --connect-timeout 10 --max-time 15 https://registry-1.docker.io/v2/` 与对 `https://download.docker.com` 的 HTTPS 请求区分 DNS、Registry 可达性和一般公网出站；检查实例关联安全组的出方向是否允许 TCP 443 到公网、Ubuntu `ufw` 是否拦截。Flexus L 默认安全组文档描述为出方向全放通，但需检查此实例实际关联的所有安全组。未确认前不配置不明来源的 registry mirror。若只阻断 Docker Hub 而华为云 SWR 可达，可考虑同地域 SWR 存镜像并从服务器拉取；SWR 官方文档支持 Docker 客户端登录和 pull。来源：[Flexus L 安全组概述](https://support.huaweicloud.com/usermanual-flexusl/security_admin_0003.html)、[SWR 登录问题](https://support.huaweicloud.com/intl/zh-cn/swr_faq/swr_faq_0016.html)、[SWR 拉取镜像](https://support.huaweicloud.com/usermanual-swr/swr_01_0017.html)。

2026-11-09：负责人提供网络诊断输出：`download.docker.com` InRelease 返回 HTTP 200、百度 HTTPS 返回 HTTP 200、`ufw` 为 inactive；Docker Hub Registry 超时。系统 `getent hosts registry-1.docker.io` 返回 `2a03:2880:f111:83:face:b00c:0:25de`；前次 Docker daemon 报错所用 IPv4 为 `104.244.43.136`。RIPE/APNIC 注册查询确认 IPv6 地址属于 `2a03:2880::/29`（Meta/Facebook），ARIN RDAP 查询确认 IPv4 地址属于 `104.244.40.0/21`（Twitter Network）；均不是 Docker Hub 正常 Registry 地址，强烈指向服务器当前 DNS/网络路径对该域名返回了异常地址，而非一般 HTTPS 出网故障。华为云 SWR 官方文档也明确提到运营商网络原因可导致 Docker Hub 拉取变慢或失败，并建议生产环境将所需镜像同步到 SWR 私有仓库。无需为此开放入站端口或改动 ufw；不应手工把域名绑定到猜测 IP。来源：[APNIC/RIPE 地址注册信息](https://wq.apnic.net/apnic-bin/whois.pl?searchtext=2A03%3A2880%3A0%3A0%3A0%3A0%3A0%3A0%2F32)、[华为云 SWR 镜像加速及生产建议](https://support.huaweicloud.com/usermanual-swr/swr_01_0045.html)。

下一步仅做诊断，不改服务器 DNS/安全组：分别检查 `getent ahostsv4 registry-1.docker.io` 与 `getent ahostsv6 registry-1.docker.io`；验证 IPv4/IPv6 HTTPS；并用云控制台或经批准的 DNS-over-HTTPS 查询对照 A/AAAA 记录。DNS 返回正常 Docker Registry/CDN 地址后再重试 `docker run --rm hello-world`。若只有 Docker Hub 域名链路被限制，优先评估同地域华为云 SWR 镜像仓库，不使用来源不明的公共镜像加速器。

2026-11-09：负责人后续诊断显示 `getent ahostsv4 registry-1.docker.io` 返回 `199.59.149.205`，`getent ahostsv6` 返回 `2001:6c0a:aa2b`；IPv4 HTTPS 仍在 10 秒后超时，IPv6 立即 `Couldn't connect to server`。与 `download.docker.com` 和百度均 HTTP 200 的结果合并判断：服务器一般公网 HTTPS 正常，但 Docker Hub Registry 的 IPv4/IPv6 连接均不可用；此前异常地址是历史 DNS 结果，当前不再作为结论依据。DNS/ufw 诊断阶段结束，Docker Hub 拉取仍未通过。

建议转入华为云 SWR 路径：在华为云广州区域控制台创建一个组织和私有仓库，使用控制台“获取登录或推拉镜像指令”生成准确的区域仓库地址及临时/长期登录命令；不要把密码或令牌贴进聊天。先从一台能访问 Docker Hub 的本机或 CI 构建/获取 `hello-world` 与后续应用镜像，按 SWR 指令 `docker tag`、`docker login`、`docker push`；回到服务器使用同一控制台生成的拉取命令 `docker pull`，再运行 `docker run --rm` 验证容器。华为云官方建议生产环境将依赖的 Docker Hub 镜像同步到 SWR 私有仓库，SWR 支持组织、私有镜像推送与拉取。来源：[SWR 创建组织](https://support.huaweicloud.com/usermanual-swr/swr_01_0014.html)、[SWR 推送镜像](https://support.huaweicloud.com/usermanual-swr/swr_01_0011.html)、[获取登录/推拉命令](https://support.huaweicloud.com/usermanual-swr/swr_01_1000.html)、[SWR 镜像加速建议](https://support.huaweicloud.com/usermanual-swr/swr_01_0045.html)。

2026-11-10：负责人已将 Docker Registry mirror 配置写入 `/etc/docker/daemon.json`，`docker info` 显示多个镜像地址；随后执行 `docker run hello-world` 成功拉取镜像并输出 `Hello from Docker!`。这证明服务器 Docker daemon、镜像拉取链路和容器运行均已通过基础验证。当前配置包含多个公共镜像地址，生产使用前仍需负责人确认其来源、可用性和信任边界；后续 CI/CD 推荐使用已确认的华为云 SWR 私有仓库，不把未知公共镜像站作为唯一生产依赖。

2026-11-10：负责人完成 Docker 命名卷持久化测试。`wikilog-pilot-check` 创建成功；使用 `alpine:3.20` 写入 `/data/check.txt` 后，临时容器删除并重新创建仍能读出 `issue-01-volume-ok`；执行 `systemctl restart docker` 后再次读出相同内容；最后测试卷已删除，`docker volume ls` 为空。该结果通过了“容器重建 + Docker daemon 重启”的卷持久化验证，但尚未验证真实应用数据目录、服务器整机重启、备份恢复或图片对象持久化。

2026-11-10：负责人完成服务器重启后的 Docker 卷与资源/监听检查。重新登录后 `systemctl is-active docker` 为 `active`；`wikilog-reboot-check` 卷仍存在，临时 Alpine 容器读出 `host-reboot-ok`，随后测试卷被删除。`ss -lntup` 显示 TCP 对公网监听只有 SSH `22`；DNS stub 与 Huawei `uniagent` 端口绑定在 `127.0.0.1`，没有 PostgreSQL `5432` 或应用 `3000` 监听。`free -h` 显示总内存约 1.7 GiB、available 1.4 GiB、Swap 0；根盘 40G、已用 3.9G、可用 34G、使用率 11%。因此服务器重启后 Docker 本地卷持久性通过，当前未见数据库/应用公网监听；云控制台安全组规则尚未单独核对。内存无 Swap，开始同时运行 Next.js 与 PostgreSQL 前需持续观察 OOM/内存余量。

2026-11-10：负责人完成 PostgreSQL 18.6 容器卷持久化测试。`postgres:18-alpine` 镜像拉取成功；首次启动因 `POSTGRES_PASSWORD` 为空而按官方镜像安全默认值退出，随后使用新的临时密码重新创建容器并成功初始化。容器日志显示 PostgreSQL 18.6 ready，容器内 `pg_isready -U postgres -d wikilog` 返回 accepting connections；创建 `pilot_check` 表并插入 `postgres-volume-ok` 后重启容器，查询仍返回该值。容器未使用 `-p` 发布端口，故该 PostgreSQL 未映射到宿主机公网。结论：数据库容器可运行，命名卷能保留数据库内容经过容器重启。当前仅是空白试点库，尚未跑项目迁移、整机重启后数据库读回或备份恢复。截图中曾把类似临时密码的字符串用作 `read -rsp` 提示文本显示；不要复用该字符串，正式部署前另设随机凭据。

2026-11-10：负责人在服务器 `wikilog-postgres-pilot` 容器的 `wikilog` 数据库中首次执行项目 SQL 迁移后，重跑迁移循环；截图显示 `app_migrations` 已存在，并依次输出“已跳过：`0001_initial.sql`”“已跳过：`0002_audit_fields.sql`”“已跳过：`0003_reader_accounts.sql`”。随后只读查询确认迁移登记仍为 3 条、`users` 行数为 `0`。因此，该服务器试点数据库上的项目迁移首次执行与重复执行跳过行为通过；这不代表备份恢复、应用部署或配图存储验收通过。

关于修改 Docker 默认下载地址：`registry-1.docker.io` 是 Docker Hub 的标准地址，当前错误是该地址在服务器上的连接不可用，不是仓库名称写错。Docker 官方支持在 `/etc/docker/daemon.json` 配置 `registry-mirrors`，但镜像加速器通常只覆盖 Docker Hub 的部分常用开源镜像。华为云当前文档明确建议生产环境把依赖镜像同步到 SWR 私有仓库，而不是依赖加速器；同时说明 SWR 镜像加速器推荐 Docker 18.06–28.5，Docker 29.x 存在兼容问题。当前服务器 Docker 为 29.9.3，因此不直接配置加速器作为生产方案。若仅为一次 hello-world 测试，必须从 SWR 控制台复制广州加速器地址；使用 Docker 29 还需按官方说明在 `daemon.json` 增加 `features.containerd-snapshotter:false` 并重启 Docker，配置前备份现有文件，失败时恢复。来源：[Docker Registry mirror](https://docs.docker.com/docker-hub/image-library/mirror/)、[SWR 镜像加速器限制](https://support.huaweicloud.com/usermanual-swr/swr_01_0045.html)、[SWR Docker 29 兼容说明](https://support.huaweicloud.com/intl/en-us/swr_faq/swr_faq_2010.html)。

负责人最新要求：本轮不把月费低于 ¥20 作为硬门槛，先追求优惠并记录实际首年价、续费价和按量费用。现有 `docs/SPEC.md` 与 ADR-0002 仍写有 ¥20 目标，项目级预算文字需在确定后统一；Issue 01 验收时不得遗漏这一处差异。

2026-11-11：负责人确认不再把网站与数据库 `¥20/月` 作为硬门槛；服务器已购买。保留以上历史调研和验证记录，不将其改写为通过。Issue 01 后续验收需记录服务器实际订单、续费价、按量费用、未计入项和目标环境访问/持久化证据，交由负责人决定是否接受。问答及获批后的 LLM Wiki 使用独立的 `¥20/月` 应用预算，见 Issue 07/09/10；不得将两种预算混算。

### 执行顺序

1. **核对实例与安全组**：在华为云 Flexus L 控制台记录实例 ID、广州地域、公网 IP、操作系统镜像、套餐剩余有效期、流量包、到期及续费金额。服务器执行 `cat /etc/os-release; uname -m; nproc; free -h; df -h /`，确认是预期 Ubuntu、x86_64、2 vCPU/2 GiB 和系统盘容量。安全组只允许负责人当前固定 IP 访问 TCP 22；保持 5432、3000 不对公网开放。网站 80/443 在备案/开放条件确认前也不开放。若负责人无法使用固定出口 IP，使用华为云 CloudShell 时只允许其当前代理 IP，不开放 22 给 `0.0.0.0/0`。来源：[配置 Flexus L 安全组规则](https://support.huaweicloud.com/intl/zh-cn/usermanual-flexusl/security_admin_0004.html)、[CloudShell 登录限制](https://support.huaweicloud.com/usermanual-flexusl/flexusl_0011.html)。
2. **确认备案路径**：华为云备案资料说明中国大陆节点提供互联网信息服务需依法备案，网站可以通过 IP 或域名访问；申请备案使用的 IP 必须是华为云公网 IP。负责人不买域名时，先在华为云备案控制台确认该实例和账号能否提交 IP 备案。备案/对外开放条件未满足前，用 SSH 隧道访问应用进行私下验证，不以公网 HTTP IP 访问作为已通过证据。来源：[备案基本概念](https://support.huaweicloud.com/icprb-icp/icp_01_0003.html)、[备案限制](https://support.huaweicloud.com/icprb-icp/icp_01_0008.html)。
3. **安装并核验容器运行时**：在干净的 Ubuntu 系统镜像上按华为云 Flexus L Docker 指南安装 Docker Engine/Compose；记录 `docker --version`、`docker compose version` 和 `systemctl is-active docker`。指南以 Ubuntu 22.04 为例；购买的是 Ubuntu 24.04 时，按其对应步骤安装，不直接照搬旧发行版命令。不要使用宝塔/WordPress 等应用镜像。来源：[Flexus L 手动部署 Docker](https://support.huaweicloud.com/bestpractice-flexusl/flexusl_bp_0046.html)。
4. **准备生产部署形态**：当前仓库的 `docker-compose.yml` 是本地 PostgreSQL 开发配置，未发现生产 Dockerfile、生产 Compose 或 `lib/storage/` 适配器。因此先新增并评审独立的生产配置，不把本地固定密码或本地端口映射直接用于服务器。应用监听容器网络；PostgreSQL 不发布宿主机公网端口；生产 `DATABASE_URL` 只放在服务器端环境文件。2 GiB 机器不承担 Next.js 构建，采用 Linux CI/构建机生成镜像或部署产物，再上传/拉取至服务器。
5. **部署并验证 PostgreSQL**：数据库容器数据目录挂载到服务器持久目录，数据库仅处于 Compose 私有网络。只执行 `npm run db:migrate` 两次，不运行 `admin:init`，不创建真实管理员/读者，也不导入真实数据。两次都应成功且第二次无新迁移。检查 `SHOW max_connections;`、`SELECT count(*) FROM pg_stat_activity;`、`SELECT count(*) FROM users;`；应用池当前为 `max: 5`，并记录服务空闲与公开页请求时的连接数。用应用同机连接重复执行 `SELECT 1`，记录至少 20 次的 p50/p95，作为单机应用到数据库延迟，不称作公网访问延迟。
6. **演练数据库备份恢复**：在服务器生成 PostgreSQL 自定义格式备份（`pg_dump -Fc`），将备份复制到服务器之外的负责人电脑/受控存储；在同机临时测试数据库执行 `pg_restore`，核对表、迁移版本和数据行数后清理测试库。不得只把唯一备份留在系统盘。若评估华为云整机备份，控制台启用 CBR 后确认备份成功并记录费用；Flexus L 官方说明可通过 CBR 做实例备份，且不支持使用快照恢复数据。来源：[Flexus L 云备份概述](https://support.huaweicloud.com/intl/zh-cn/usermanual-flexusl/cbr_admin_0001.html)、[备份 Flexus L 实例](https://support.huaweicloud.com/usermanual-flexusl/cbr_admin_0002.html)。
7. **验证图片目录持久性**：把上传目录设为应用部署目录之外的服务器持久路径（如 `/srv/wikilog/uploads`），只读挂载给服务；使用仓库现有公开样例图或无敏感测试图验证目录读取。重建/替换应用容器、重启 Docker、再重启服务器后分别检查文件仍存在且可读。可用绑定到 `127.0.0.1` 的临时只读静态服务经 SSH 隧道匿名读取测试文件，完成后删除临时服务和测试文件。当前没有文章上传接口，故 Issue 01 只能验证持久目录和读取路径；真实上传、MIME/文件签名伪装、大小限制及文章下架/删除清理需 Issue 05 实现后再验。发布图片可匿名读，草稿不可匿名读。
8. **验证应用与境内访问**：`AUTH_ENABLED=false`，不初始化管理员。确认 `/`、文章、分类、标签、搜索和关于页可匿名读取已发布文章；确认 `DATABASE_URL` 不出现在客户端构建产物、浏览器响应和日志。先经 SSH 隧道访问 `127.0.0.1:3000` 检查 SSR 与数据库读取。完成所需备案并确认可开放网站端口后，再从家庭宽带和手机蜂窝网络访问，记录时间、地域/运营商、HTTP 状态和响应时间；测试应至少覆盖公开首页、文章详情、图片。HTTP 下不测试登录/密码，账号入口保持关闭，直到 HTTPS 条件另行验收。
9. **核算试点成本与资源余量**：记录本次 ¥36/年的实付订单、套餐到期日、续费价、100 GB/月流量规则及超量单价；记录额外数据盘、CBR、主机安全、对象存储、备案/证书等实际启用费用（未购买也写明未计入）。华为云公开文档说明套餐外出网流量按地域阶梯按量计费，故超额单价以此订单费用中心为准。记录稳定运行和页面访问期间的 `docker stats`、`free -h`、`df -h` 及流量用量，确认 2 GiB/40 GiB 是否有余量。来源：[Flexus L 超额流量计费](https://support.huaweicloud.com/intl/zh-cn/flexusl_faq/faq_billing_0001.html)、[Flexus L 价格说明](https://www.huaweicloud.com/product/flexus/pricing.html)。

### 最终验收结果与限制

2026-11-11：新增独立生产镜像与 Compose 配置，Next standalone 镜像在本机以 Linux/amd64 构建成功，归档经 SHA-256 校验后导入服务器。生产 Web 容器以非 root 用户运行，仅绑定服务器 `127.0.0.1:3000`；PostgreSQL 未发布宿主机端口。应用使用 `wikilog_app` 非超级用户和服务器权限为 `600` 的 `.env`；导入 3 个仓库样例分类、13 个标签、6 篇文章（5 篇已发布、1 篇草稿），未创建用户。应用角色最终仅有业务表读取权限，无写权限或 schema CREATE 权限。重复执行 `npm run db:migrate` 两次均为 schema up to date；服务器上首页、文章、分类、标签、搜索、关于及登录/注册关闭提示均通过 SSR 检查。所有已发布分类和标签详情返回 200，未发布文章 `/articles/unpublished-preview` 返回 404；中文查询 `公开`、`版本`、`文章` 均返回已发布文章。客户端静态资源、HTML 响应和容器日志均未发现 `DATABASE_URL`。同机 `SELECT 1` 20 次 p50/p95 为 0.26/0.62 ms，`max_connections=100`；公开页请求后观察到应用连接最多 3 条 idle。Web/PostgreSQL 容器约 48/52 MiB，主机 available 内存约 1.2 GiB，根盘使用 13%。设置 `unless-stopped` 后手动重启原 PostgreSQL 容器，`pg_isready` 成功，6 篇文章和 0 用户保留，首页及图片测试端点均返回 200。

图片持久目录 `/srv/wikilog/uploads` 以只读方式挂载到 Web 容器，应用用户可读不可写。使用仓库样例 SVG 经绑定 `127.0.0.1:18080` 的临时静态服务和 SSH 隧道匿名读取，返回 200 且内容一致；Web 容器强制重建后文件仍在。2026-11-11 主机重启后测试文件仍存在，Web 与图片测试容器自动恢复；原 PostgreSQL 容器因此前没有 restart policy 而正常退出，数据卷内容完整，人工启动后读到 6 篇文章、0 个用户及 3 条迁移记录。负责人截图显示首次 `systemctl restart docker` 后应用曾返回 500。为原 PostgreSQL 容器设置 `unless-stopped` 后，负责人再次执行 Docker daemon 重启；截图及 SSH 复核均显示 Docker active、PostgreSQL accepting connections、首页和图片测试端点返回 200，数据库保留 6 篇文章、0 个用户。验证后已删除临时静态服务和测试 SVG，保留空的持久目录及 Web 服务。

代码检查：`npm run lint`、`npm run typecheck`、单 worker 的 `npm test -- --maxWorkers=1 --minWorkers=1 --reporter=verbose` 均通过；默认并行 `npm test` 有 5 个 PGlite hook 超过 10 秒超时。Docker 生产镜像构建和 7 个本地页面/封面冒烟检查通过；镜像依赖安装报告 8 个 moderate audit 项，未在本轮升级依赖。

2026-11-11：负责人提供 Flexus L 控制台信息：套餐到期日 `2027-11-09`、续费 `¥32.94/月`、月流量包 `100 GB`、超额 `¥0.8/GB`；CBR 云备份和主机安全未启用，其他额外服务费用为无。此前订单首年价为 `¥36/年`。公网访问、ICP备案与 HTTPS 不属于本次私有试点验收范围；备案状态未确认，也未测试或记为通过。

同日安全组截图共显示 10 条规则，其中可见 IPv4 允许规则包括固定来源 SSH、`0.0.0.0/0` SSH、FTP TCP 20–21、HTTP TCP 80、HTTPS TCP 443、RDP TCP 3389 和全部 ICMP；另有 IPv6 全拒绝规则。截图滚动位置未展示其余 2 条。负责人决定不调整安全组，并明确接受现有规则作为安全组风险例外。本次不修改安全组或开放端口；该例外不代表安全加固通过。Docker 检查确认 Web 仅绑定 `127.0.0.1:3000`，PostgreSQL `5432/tcp` 没有宿主机端口映射。公网访问不在验收范围。

负责人接受 Flexus L 单机自管 PostgreSQL 作为 CloudBase 方案的替代试点；本记录不代表 CloudBase PostgreSQL 已通过验证。私有单机试点在本次范围内验证通过；公网访问、ICP备案、HTTPS 和 CloudBase PostgreSQL 均未验证且不属于本次验收范围。安全组风险例外由负责人接受，但安全加固未通过。Issue 01 状态为 `ready-for-human`，供负责人后续决定是否进入公网部署与加固阶段。

2026-11-11：完成华为云 Flexus L 试点 PostgreSQL 备份恢复演练。通过 SSH 公钥登录 Ubuntu 24.04.4；`wikilog-postgres-pilot` 使用 PostgreSQL 18.6，数据库 `wikilog` 由 `postgres` 角色管理，当前 `app_migrations` 为 `0001_initial.sql`、`0002_audit_fields.sql`、`0003_reader_accounts.sql`，`users` 为 0。生成自定义格式备份（`pg_dump -Fc`，27,876 bytes），复制到本机临时目录并校验 SHA-256：`07bfae5cb6a7a2a292023908dce4938f243179b8763e61e007939f3237f11710`；再将本机副本传回服务器，恢复到临时数据库 `wikilog_restore_20261111_01a1c84b`。源库与恢复库的 11 张 public 表、迁移清单和逐表行数完全一致：`pilot_check=1`、`app_migrations=3`，其余表均为 0，`users=0`。演练通过，不代表云备份服务或自动备份策略已启用。

2026-11-11：样例内容导入后再次执行独立备份/恢复。自定义格式 dump 为 35,541 bytes，服务器与本机副本 SHA-256 一致：`e1460607aaaf4ebd4db407904e3155f677131973bdda52775ab64b25e8448061`。恢复到 `wikilog_restore_issue01_20261111` 后，11 张 public 表、3 条迁移记录和逐表行数均与源库一致：`articles=6`、`article_versions=6`、`article_version_tags=16`、`categories=3`、`tags=13`、`pilot_check=1`、`users=0`，其余表为 0。临时恢复库及服务器 dump 已清理；本机备份副本按负责人要求暂留至其余验收完成。

演练后已删除临时恢复数据库及服务器上的临时 dump；原数据库容器及 `wikilog-postgres-pilot` 命名卷保持存在。完成新范围验收后，已从服务器 `codex` 账户的 `authorized_keys` 精确撤销本次临时 SSH 公钥并确认匹配数为 0。已按负责人授权尝试删除本机临时私钥、公钥和两份备份副本，但执行环境自动审查拒绝文件删除命令；这四个文件仍需由负责人手动删除：私钥 `%TEMP%\wikilog-drill-815b92fd59974a9fb8ecba20542d5812`，公钥 `%TEMP%\wikilog-drill-815b92fd59974a9fb8ecba20542d5812.pub`，初始备份 `%TEMP%\wikilog-drill-20261111-01a1c84b.dump`，样例数据备份 `%TEMP%\wikilog-drill-issue01-postseed.dump`。登录前检查发现 `codex` 已属于 `docker` 组，本轮未新增或移除该组权限。Issue 01 状态为 `ready-for-human`。

- 私有单机试点的生产容器、数据库、可重复迁移、SSH 隧道读取、草稿隔离、凭据保密、图片目录只读持久性、逻辑备份下载/校验/恢复、Docker 与主机重启后数据可读，以及资源和费用记录均按本次范围验收通过。
- 负责人接受的安全组风险例外需继续明确标示为未通过安全加固；当前配置不代表 SSH 来源限制或公网入站规则符合安全基线。
- 公网访问、ICP备案、HTTPS、真实图片上传和 CloudBase PostgreSQL 不在本次验收范围，未验证。CloudBase 不是待验证候选方案；Flexus L 与自管 PostgreSQL 是当前运行环境。
- SSH 私钥、服务器密码、数据库密码和云访问密钥不要贴在聊天或提交到仓库；只需提供脱敏控制台信息与命令结果。

2026-11-12：负责人决定自行确认备案状态；不申请域名、不配置 HTTPS、不使用或验证 CloudBase，且之后不再考虑这些事项。该决定取代本 issue 中要求继续评估 CloudBase、域名及 HTTPS 的历史建议，但不改写既有验证记录。待办只保留负责人确认备案状态这一项；备案确认前不开放公网访问。若之后确认可通过 IP/HTTP 提供匿名只读博客，仍需完成相应的安全组、备份恢复和匿名边界验收。没有 HTTPS 时认证、账号管理、收藏、问答及公网管理员写操作不得启用；管理员通过 SSH 隧道管理。Issue 01 保持 `ready-for-human`，直到负责人确认备案状态。
