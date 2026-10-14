# Waffo 审核记录 · 2026-10-14

状态：**已提交，Under Review（审核中）**。用户明确确认最终稿及费表后提交一次；获批后再切换新购买。

- 用户确认原文：`确认最终稿和费表，提交审核`。
- 审核申请：`TKT_1HztXEGuGjxLvmaOODdC0W`。
- 提交后刷新后台读回：`isSubmitted=true`、`reviewStatus=pending`、`confirmedFees=true`；界面显示 `Under Review`。
- 状态读取时间：2026-10-14 17:08:31（Asia/Shanghai）。后台提示通常需要 1–3 个工作日。
- [审核状态截图](screenshots/waffo-under-review.png)。

- 店铺：`STO_5I2J4YK9UUolwABxwPIhYa`，沿用已有测试店铺，显示名称已改为 FlowchartAI。测试商品和支付记录仍为 test，没有发布生产商品。
- 当前 slug：`flowchartai-rqm9pcec`。商品及 webhook 绑定继续使用原 store ID。
- 网站 `https://flowchartai.org` 与客服邮箱 `support@flowchartai.org` 均已通过 Waffo 验证。
- 已添加一条 `_waffo-challenge.flowchartai.org` TXT 验证记录，未修改其他 DNS 记录。
- 审核表单已填写产品、用途、现有客户、经营者、网站、服务条款、隐私政策和计费迁移说明。
- Waffo 网站自检显示：`No issues found — your website looks ready to submit.`（后台显示 2026-10-14 16:45:32）。这是平台自检结果，不能等同正式审核通过。
- 已提交的业务说明明确区分：线上目前仍为 Creem 旧方案；新 Waffo 套餐和政策在获批后、启用新收款前发布；旧合同、权益和退款承诺保留。
- 最终稿的经营者、网站、政策链接、产品说明、价格及声明与用户确认版本逐字段比较，未发现变更；按用户确认接受费表并点击 Submit。

[后台审核状态](https://pancake.waffo.ai/merchant/dashboard/STO_5I2J4YK9UUolwABxwPIhYa/settings/business-details)

实际费表：[Waffo Fees](https://docs.waffo.ai/mor/fees)。银行卡/数字钱包成功交易 3.9% + $0.50；微信支付 3.9%，无固定费。退款每次 $1，原手续费不退；提现 1%，每笔最低 $10；特定失败每次 $0.30；初次拒付 $25，选择抗辩另 $10，预仲裁另 $25。

完整经营者资料和最终稿只存放在本地忽略文件 `.env.waffo-review-package.md`、`.env.waffo-review-draft.json`；状态回执存放在 `.env.waffo-review-submission.json`，均不提交 Git。最终稿 SHA-256：`dcf57de0e686d9e1a1410e812edd275042a2df03a4c395b8d808678a8da14dc0`。

本轮已提交商户审核；没有部署产品、修改生产用户余额、迁移旧合同或启用正式收款。Under Review 不等于 Approved；只有实际 Approved 后才执行计费切换。
