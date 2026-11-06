# Issue 03: 验证邮箱链接服务

Status: ready-for-human
Type: research

## 目标

选定可用于注册验证和忘记密码的一次性邮件链接服务，确认公众邮箱投递、免费额度、持续费用、反滥用能力和数据处理条款。

## 验收标准

- 在常见公众邮箱完成公开或等价生产环境的验证邮件与密码重置邮件投递和点击流程测试。
- 记录免费额度的计费周期、超额费用、发送域名要求、退信/失败状态、服务限制及持续成本；不把限时试用误判为免费长期额度。
- 给出邮箱和 IP 限速、链接有效期、单次使用、重发间隔及失败提示的初始参数建议，并记录可配置项。
- 若没有通过条件的服务，明确给出失败结论；账号功能保持关闭，公开博客工作继续。
- 不把 API 密钥、真实邮箱或可用重置链接写进仓库和报告。

## Comments

2026-11-06：完成官方公开资料初筛和本地供应商无关邮件边界。当前没有足够证据认定任何服务已通过验收，也没有选择供应商；真实公众邮箱投递、域名验证、账户审批与适用的数据处理条款需要人工完成。

| 候选 | 官方公开资料（2026-11-06 检查） | 初步成本/限制 | 未验证事项 |
| --- | --- | --- | --- |
| Resend | [Pricing](https://resend.com/pricing)、[Verified Domains](https://resend.com/docs/dashboard/domains/introduction)、[DPA](https://resend.com/legal/dpa) | 免费档显示 $0/月、3,000 封/月、100 封/日、3 个域名及 30 天数据保留；Pro 显示 $20/月含 50,000 封，超额 $0.90/1,000 封。官方 DPA 写明主要处理操作在美国。 | 未用本项目域名投递 QQ 邮箱、网易 163、Gmail、Outlook；DNS 验证、送达/垃圾箱表现、域名声誉和适用于中国大陆读者的跨境个人信息处理仍待核实。 |
| Brevo | [Pricing](https://www.brevo.com/pricing/)、[Transactional email API](https://developers.brevo.com/docs/send-a-transactional-email)、[Terms and DPA](https://www.brevo.com/legal/termsofuse/) | 官网称 Free forever、无信用卡；账户获准发送后最多 300 封/日。当前 Starter 显示 $9/月、5,000 封/月。事务邮件需注册发送者/配置发送域名；可配置投递、退信、无效邮箱、阻止和错误等 webhook 事件。 | 未用本项目域名投递 QQ 邮箱、网易 163、Gmail、Outlook；免费账户审批结果、跨境数据位置/分包商和中国大陆适用条款仍待核实。 |

以上为网页当前显示值，不构成报价、免费额度承诺或法律结论。没有证据证明免费计划在本项目目标的公众邮箱群中可以持续可靠投递；任何候选都尚未满足“公开或等价生产环境投递和点击流程”验收。也未做真实邮件发送，因此未产生或记录真实邮箱、API 密钥或可用链接。

本地实现和验证：

- `lib/email/service.ts` 定义供应商无关的事务邮件接口，仅覆盖邮箱验证/密码重置用途；所有 provider 异常统一映射为通用 `EMAIL_UNAVAILABLE` 提示，不保留或返回原异常文本；生产链接要求 HTTPS，本地开发仅允许 localhost HTTP；邮件 HTML 对链接做转义。
- `lib/email/config.ts` 配置项为 `EMAIL_FEATURE_ENABLED`、`EMAIL_PROVIDER`、`EMAIL_API_KEY`、`EMAIL_FROM_ADDRESS`，模块受 `server-only` 保护。默认关闭，且只有开关、凭据齐全并与已注册 provider adapter 名称匹配时才报告可用。当前没有 adapter，账号与邮件功能仍关闭。
- 初始可配置策略：邮箱验证链接 24 小时、密码重置链接 1 小时，token 单次使用，重发间隔 60 秒；每邮箱每小时最多 3 次、每 IP 每小时最多 10 次、每 IP 每日最多 30 次。参数由 `EMAIL_VERIFICATION_TTL_SECONDS`、`EMAIL_PASSWORD_RESET_TTL_SECONDS`、`EMAIL_RESEND_COOLDOWN_SECONDS`、`EMAIL_PER_ADDRESS_HOURLY_LIMIT`、`EMAIL_PER_IP_HOURLY_LIMIT`、`EMAIL_PER_IP_DAILY_LIMIT` 覆盖。代码只定义策略，不做进程内限流；Issue 04 必须在共享持久化存储实施原子/跨实例限流以及过期和一次性 token 消费。
- 失败提示固定为“邮件服务暂时不可用，请稍后重试。”；Issue 04 的请求重置接口还必须对已注册与未注册邮箱返回相同接受提示，避免账号枚举。
- `lib/email/service.test.ts` 使用 mock 验证默认关闭/adapter 匹配、策略默认值和覆盖、链接协议、异常脱敏；测试不代表供应商投递验证。
- 已执行并通过：`npm test`（4 个测试文件、16 个测试）、`npm run lint`、`npm run typecheck`。本轮不涉及路由或构建改动。

下一步由负责人选定候选并提供可验证的发送域名/测试收件箱及必要账户操作，然后在 QQ 邮箱、网易 163、Gmail、Outlook 等常见公众邮箱分别完成验证和密码重置端到端收信、点击、过期、重复使用及失败测试；核实 DNS、退信/投诉处理、账户限额/封禁规则、适用 DPA/分包商/数据区域与实际账单。完成前不得启用账号入口；公开博客继续可用。Issue 01 的网站/数据库/配图与总成本试点仍是公开发版的独立门槛。
