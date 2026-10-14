# BILLING-V1 · LOCKED
Source: 用户确认 2026-10-14；实现授权，不含上线授权。

## Goal
新销售接入 Waffo，按完整 Agent 任务的加权 Token 消耗积分；老 Creem 订阅和历史余额继续履约。

## Constraints
不写线上数据库、不改线上商品/环境、不发布。保留旧支付 ID、价格、周期、取消/续费/Portal、固定次数额度及历史流水。只追加账务表；旧余额导入永久来源。独立 provider 路由；返回 URL 不发积分。金额/额度来自服务端本地 offer。所有用户和任务归属来自登录态。

## Scope
Free 注册一次 200/30 天；Starter $9/$90、月发 2000；Pro $19/$190、月发 6000。积分包 $10/1500、$30/5000 永久。年付按周年月份发当月额度；取消仍享已付期。先到期先用。任务预留、逐次模型成本、成功结算、失败/取消释放、重连恢复、幂等 webhook。升降级下期生效。首次 7 天且对应额度未使用的退款检查。复用当前 Next/Mastra/Postgres，无额外常驻服务。

## Acceptance
真实本地 Postgres 验证支付重复投递、首付不同事件重复投递、拒绝跨环境/错误商品/身份、月底/闰年/年付取消、余额并发、失败释放、跨月结算、退款来源隔离。老有效/取消宽限/手工会员及旧 webhook/Portal 回归。Token 汇总含缓存、多步、一次取整、推理不重复。通过受影响测试/tsc/build；Ego 检查 pricing 和 billing 状态。SDK sandbox 收银台闭环独立记录，不以 mock 冒充真实支付。

## Technical context
现有 Vercel Next.js 15 / Mastra / Drizzle Postgres。新功能由 BILLING_V1_ENABLED 与 NEXT_PUBLIC_BILLING_V1_ENABLED 同步启用，默认关闭便于本地审核；正式配置完成前禁止开放新销售。新钱包由服务端事务锁、唯一来源键与任务状态实现；Creem 保留明确路由。

## Experience contract
只显示余额、预计/实际消耗、购买积分。保留现有视觉组件；订阅/积分包价格与有效期可见。老用户显示“Legacy plan · original benefits retained”与原价管理入口；有效订阅不再新建第二份订阅。支付新窗口保留输入，回到应用刷新可信余额后由用户主动继续。正常请求无额外确认；超过默认预算显示上限确认。错误不丢输入/图。Token 明细保存在服务端供成本核对，初版账单展示余额与积分流水。

## Plan
1. 本地 offer / 费率 / 周期与权益回归测试。
2. 追加 schema、事务钱包和逐次用量记录，真实本地 PG 测试。
3. Waffo SDK checkout /签名 webhook /订阅管理；保留 Creem。
4. Agent 预留/恢复/结算与简洁购买界面。
5. 整体验证、迁移 dry-run 与上线前配置清单；此轮不部署。
