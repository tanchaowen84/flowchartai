# Billing V1 验收记录 · 2026-10-14

范围：独立 worktree `codex/billing-waffo-credits`，基于生产已合并的 native editor。未改动原工作区的并行改动，未部署。

## 真实 Waffo sandbox

经用户授权创建独立测试店铺、6 个 sandbox 商品、1 个测试 webhook。没有发布生产商品或正式收款。

| 验证 | 实际结果 |
| --- | --- |
| Hosted Pro 月付 $19 | sandbox 成功；签名 activated 和 payment_succeeded 回调均 HTTP 200；余额 200 → 6200 |
| Hosted 永久积分包 $10 | sandbox 成功；签名 order.completed 回调 HTTP 200；余额 6200 → 7700；1500 积分 expiresAt=null |
| 后台 Resend 积分包原事件 | provider attemptCount=2、HTTP 200；余额仍 7700；发放流水仍只有注册、订阅、积分包三条 |
| SDK 取消测试订阅续费 | canceling 签名回调 HTTP 200；paidThrough 保留 2026-11-14，余额保留 7700 |
| 未签名请求 | 实际 HTTP 401；不会发放权益 |

来源：Waffo merchant sandbox delivery 记录与独立本地 Postgres 读回。具体订单、事件 ID 见 [sandbox-payment-evidence.json](sandbox-payment-evidence.json)。测试卡由 Waffo sandbox 提供；没有真实扣款。测试取消采用官方 SDK；客户 Portal 是否可打开另行记录，不以 SDK 取消冒充 Portal 点击验收。

## 自动化与本地数据库

- 全量 Vitest：49 文件、232 项通过。其中 31 项是新增账务/用量检查，不是 30 次付费生成。
- Agent HTTP → 本地 Postgres 验证：模型返回后只预留；收到匹配结果回执才扣费；忽略客户端金额/Token 字段；重复回执与任务恢复不再次调用模型或扣款；取消释放；错误回执拒绝。
- 钱包验证：旧余额/旧流水保留、注册发放唯一、并发预留、到期优先、跨月释放、年付月发与取消、重复支付、错误环境/身份/金额拒绝、退款只撤销对应来源。旧用户文本解释不占生成额度，完成图操作才占原次数。
- 官方 SDK RSA raw body 验证：有效签名、篡改、跨店铺/环境、过期投递。
- 用量验证：多步模型调用汇总、缓存输入拆分、一次取整、推理不重复计费、失败收据保留为平台成本。复现并修复第一步超预估后中断后续生成的问题：预留控制扣费上限，Agent 沿用原步骤/时间边界完成复杂图，平台承担超额成本。图片预留按图片输入估算，不将 Base64 文件体积计为文本 Token，不会仅因 4 MiB 图片的编码体积触发默认预算确认。
- 测试独立本地 Postgres 数据库 `flowchart_billing_test`；套件拒绝连接非指定本地地址。迁移 0007–0009 仅在该库执行。
- 一次全量并行检查遇到机器资源竞争导致 5 秒超时；限制 2 个测试 worker 后 232 项全通过，没有放宽断言或测试超时。

TypeScript `tsc --noEmit` 通过；受影响的 35 个源码文件 Biome 检查通过；`git diff --check` 通过。构建复用本机既有实际字体缓存，解决该机器 Google Fonts 网络访问问题；没有修改生产字体源码或用假文件冒充构建。

## 老权益只读审计

只读线上原 payment 数据，发现 20 条有效权益记录：Hobby 15、Professional 5，含手工会员，不能等同于 20 名付费客户。未识别商品 ID 为 0。没有写入旧订阅、余额、积分流水或冻结字段。冻结脚本默认只读，真正上线时才执行已审阅的追加迁移与权益快照。

## 仍需正式切换前完成

Waffo 商户申请已在用户确认最终稿和费表后提交；刷新后台读回 Under Review，尚未获批。见 [审核记录](waffo-review.md)。生产 catalog/凭据与域名 webhook 配置尚未执行。新政策文案仅在当前分支。老 Creem 真正续费事件和 Portal 使用原链路保留，本轮没有制造真实扣款验证。部分退款需要人工按来源处理，首版不提供自动退款按钮。

原三类生成/修改的真实模型成本测量保存在 research 中。本轮没有再发起付费模型测试；Agent 金额结算以模拟模型传输加真实数据库验证，不冒充当前线上生成验收。没有授权独立 subagent 审查，本轮是本人代码复核、自动化与 Ego 验收。

## 最终构建

当前代码 `pnpm build` 通过，字体使用真实本机缓存并正确打包为 `_next/static/media`。本地生产构建预览用 `--hostname localhost` 运行，避免 Next.js 将 127.0.0.1 规范化为 localhost 引起重定向循环；不改生产中间件。

## Ego 页面验收

在生产构建下检查了定价、真实 sandbox 买家的 7700 余额和取消后有效期，以及本地旧手工会员的 1000 历史积分、原权益提示和禁止第二订阅。截图保存于 screenshots。定价内容用同源 iframe 实际视口检查 320/375/414/768 宽度，scrollWidth 分别等于视口宽度，无横向溢出；未使用 Playwright 或 DevTools。浏览器字体状态 loaded，4 个实际字体已加载。此项是定价内容的窄屏检查，不冒充整站移动设备验收。
