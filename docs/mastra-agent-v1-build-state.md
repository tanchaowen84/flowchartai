# Mastra Agent V1 Build State

## Locked SPEC

### Goal

将现有 FlowchartAI AI 生成链路迁移为单一 `FlowchartAgent`，运行于 Mastra，并通过 Mastra 的 OpenRouter Gateway 调用环境变量配置的模型。同时在不新增产品功能的前提下，为 Mermaid `flowchart` / `graph` 实现真正的局部编辑，改善首屏画布加载、流式反馈和渲染提交体验。

### Constraints

- 部署保持 Vercel；Cloudflare 仅保留 DNS、R2 与 `cdn.flowchartai.org` CDN。
- 移除 OpenNext / Cloudflare Workers 的 Next.js 部署链，不修改 R2/CDN 存储实现。
- 不修改数据库 schema，不运行 `db:migrate` 或 `db:push`，不删除或更新已有生产数据。
- 保留现有登录、授权、配额、Creem 审核与用量语义：只有画布成功提交后记录一次用量；失败、取消和未渲染均为零次。
- 保留文字生成和单图生成能力；模型通过环境变量配置。
- 每个 Vercel 请求必须在现有 60 秒边界内结束，浏览器工具不得让服务端无限等待。
- 不引入节点数、Patch 数、变更比例等任意产品限制，不新增产品安全限制；沿用既有校验和依赖库默认限制。
- 浏览器验证仅使用 Chrome Skill，不使用 Playwright 或 DevTools。
- 只对变更文件运行 Biome，不运行全仓库写入式 lint。

### Scope

- 单一 `FlowchartAgent`、Mastra OpenRouter Gateway、文字/单图多模态输入、流式文本和完整画布命令。
- 保持前端已有 SSE 事件外形，由服务端将当前 Mastra `Agent.stream().fullStream` 映射为稳定协议；客户端修复跨网络 chunk 缓冲。
- `DiagramDocument` v1、稳定语义 ID、原子 `DiagramPatch`、revision 冲突与引用校验。
- `flowchart` / `graph` 对明确目标执行局部 Patch；未触及的 Excalidraw 元素 ID、位置和用户手绘元素保持不变。
- 其他 Mermaid 类型继续生成，并只全量替换明确目标图，不删除其他 AI 图或用户元素。
- 旧图在可安全识别单一目标时懒升级；目标歧义时不修改画布并提示用户选择。
- 在现有 flowchart `content` JSON 中写入可选 `flowchartAi` 扩展，无新表。
- 画布加载和 Agent 状态最小反馈：加载画布、思考中、修改中、渲染中、完成或错误。
- 页面性能标记与原子单次 `updateScene` 提交，避免不必要 remount、闪烁和整图跳转。

### Non-goals

- 不增加新的 Agent、Planner、Reviewer、长期记忆、审批流或新产品入口。
- 不为 sequence、class、ER、gantt 等非 flowchart Mermaid 类型实现局部 Patch。
- 不重写整套聊天 UI 为 AI SDK UI。
- 不改变套餐、用量额度、认证、支付或数据库结构。
- 不更换 R2/CDN provider，不迁移已有文件和数据。

### Contracts

`DiagramDocument` v1：

```ts
{
  schemaVersion: 1;
  diagramId: string;
  diagramType: 'flowchart';
  mermaidKeyword: 'flowchart' | 'graph';
  direction: 'LR' | 'RL' | 'TD' | 'BT';
  revision: number;
  sourceMermaid: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
}
```

`DiagramPatch`：

```ts
{
  patchId: string;
  diagramId: string;
  baseRevision: number;
  operations: Array<
    | AddNode | UpdateNode | RemoveNode
    | AddEdge | UpdateEdge | RemoveEdge
  >;
}
```

所有操作先应用到内存副本并校验最终引用，再一次性提交；删除节点不会猜测重连。AI 管理元素在 `customData` 中携带 `diagramId`、`semanticId`、`entityType`、`diagramType` 和 `revision`。

目标顺序：当前选中的 `diagramId` 优先，其次画布上唯一的可识别 AI 图；歧义时不改图。无目标时创建；明确重建或类型变化时替换；可 Patch 的 flowchart 目标执行 Patch；非 flowchart 只替换目标图。

### Acceptance Criteria

- 未登录与额度不足分别在模型调用前返回 401/429；审核拒绝不调用模型。
- 文字与单图输入都能进入环境变量指定的 OpenRouter 模型，Gateway 模型字符串是 `openrouter/<provider>/<model>`。
- SSE 映射只发送完整工具参数；abort 或断流不能产生局部画布提交或用量记录。
- `flowchart` / `graph` 的所有节点和边增删改、revision 冲突、无效引用与原子回滚有自动测试。
- 局部编辑后未触及元素 ID 与位置不变，用户元素不变；非 flowchart 只全量替换目标图。
- 工具渲染失败记录零次用量，成功提交恰好一次；Undo、保存、重新加载和导出保留兼容。
- 本地发送状态小于 100ms；固定环境中 API ready p95 ≤3s、保存场景可交互 p95 ≤4s、有效 Patch 收到至画布提交 p95 ≤1s。
- 通过 affected tests、typecheck、production build、changed-file Biome、Chrome 真路径和 Vercel Preview（若外部凭证可用）。

## Plan Research

- Founder SPEC：LOCKED。
- Grok Plan Research：REVISE，范围不变。修正点：以实际安装的 Mastra 1.51 API 为准；保留现有 SSE 外形；只消费完整工具参数；覆盖 abort、鉴权、计费和多模态失败路径；Agent parity 通过后再移除旧 OpenRouter SDK 和 OpenNext。
- 官方文档检查：Mastra OpenRouter Gateway 使用 `openrouter/<provider>/<model>`；`Agent.stream()` 返回 `MastraModelOutput`，提供 `fullStream`、`textStream`、`abortSignal` 与工具配置。

## Task Graph and Ownership

| ID | Task | Depends on | Owner | State |
| --- | --- | --- | --- | --- |
| T0 | 基线、Locked SPEC、依赖与当前 Mastra 合约 | - | Main implementation owner | COMPLETED |
| T1 | RED contract tests | T0 | Test writer / Main integration | COMPLETED |
| T2 | Mastra Agent、Gateway、SSE 与 parity | T1 | Main implementation owner | COMPLETED |
| T3 | Document/Patch/renderer/legacy/persistence | T1 | Main implementation owner | COMPLETED |
| T4 | 加载、状态、性能与部署清理 | T2, T3 | Main implementation owner | COMPLETED |
| T5 | GEB、测试、类型、构建、scoped Biome | T2, T3, T4 | Main implementation owner | COMPLETED |
| T6 | 独立 Evaluator、Chrome QA、Vercel Preview | T5 | Evaluator / Main integration | IN_PROGRESS — Preview READY；认证真路径由 Main 接管 |

## Evidence Log

- Baseline commit: `d31db8b` on `codex/mastra-agent-v1`.
- Baseline worktree: clean.
- Runtime: Node `v22.22.2`, pnpm `10.7.0`.
- Current Mastra package checked: `@mastra/core@1.51.0`, Node `>=22.13.0`.
- Existing Vercel duration: `app/api/**/*` max 60 seconds.
- Existing database schema remains untouched.
- RED evidence: initial diagram/Mastra contract suites failed on missing modules before implementation; parser/renderer/executor suites followed the same RED-to-GREEN path.
- Initial implementation GREEN evidence: `pnpm test` passed 15 files / 56 tests, including guards, text/image request construction, SSE mapping and buffering, abort/usage gates, atomic patch/reconcile, target resolution, metadata, renderer and non-flow replacement.
- Evaluator RED evidence: the targeted resolver/parser/executor/metadata command produced 15 failures and 16 passes, reproducing metadata/Undo drift, partial legacy selection, non-faithful Patch syntax and ambiguous create.
- Evaluator repair GREEN evidence: `pnpm test` passed 16 files / 76 tests. Added coverage includes Preview base URL precedence, Undo -> save -> reload -> next Patch revision continuity, scene metadata removal after undoing create, complete legacy-generation targeting, identical-source generation separation, conservative Patch syntax fallback, ambiguity rejection and Excalidraw history version/nonce capture for the metadata carrier.
- Documentation generation: `pnpm docs` exited 0 and generated 7 collections / 25 documents during production build.
- Type safety: `pnpm typecheck` exited 0 after docs generation.
- Production build: `pnpm build` exited 0 on Next.js 15.2.6; compile, type validation, 41 static pages and trace collection completed. Canvas route shell First Load JS remained 113 kB. `@mastra/core` is listed in `serverExternalPackages` so Vercel traces the Node package directly instead of webpack-minifying it into the route bundle.
- Scoped lint: Biome checked 45 affected TypeScript files with no remaining diagnostics. Full-repository lint was intentionally not run.
- Deployment cleanup: removed OpenNext/Workers config, scripts and dependencies plus the legacy OpenRouter Agent/AI provider packages; retained Vercel `maxDuration: 60`, AWS SDK R2 storage and all CDN/R2 scripts.
- Performance implementation: edit data fetch starts in the small route chunk while the editor chunk downloads; the second full-screen wait/remount was removed; assistant/export/image/Mermaid paths are lazy and Mermaid conversion idle-preloads; local Patch does not zoom.
- Build warnings are limited to missing local `BETTER_AUTH_SECRET` and OAuth credentials; they are environment warnings, not compile failures.
- Chrome QA: local production canvas shell, Excalidraw drawing, Undo control and unauthenticated sign-in guard passed. The authenticated Agent/save/reload path remains unavailable without an authenticated localhost session.
- Vercel Preview: direct remote builds stalled during Next.js optimization and were cancelled without touching Production. The bounded fallback `vercel build --target preview` completed locally and `vercel deploy --prebuilt` produced READY deployment `dpl_EESikksc24vBSnYE9Ln6wf2yikq1` at `https://flowchartai-q6wq538tc-tanchaowens-projects.vercel.app`.
- Preview smoke: authenticated `vercel curl` followed `/en/canvas` to a `200` canvas response. `POST /api/ai/chat/flowchart` with a valid empty message array returned the expected `401 Authentication required`, proving the deployed Mastra route loads and rejects guests before any model invocation.
- Independent evaluator: `/root/v1_mastra_local_edit_spec/v1_evaluator` initially returned FAIL; every P1 received a reproducing RED test and repair. The final follow-up result is PASS with zero P0/P1 and no newly identified P2.

## Production Data Guardrail

Preview may use production-compatible environment configuration, but verification may only create one new test account and data owned by that account. It may update only newly created rows through normal product paths. It must never delete rows, update existing user rows, or run migration/push commands.

## Resume Point

Current stage: `VERIFIED`. Resume at T6 with the Main integration owner: run the authenticated Preview Agent -> canvas commit -> save -> reload -> next local Patch Chrome path, then complete UI review and final release. Preview deployment, unauthenticated Chrome path and independent evaluator are complete. No production data mutation, migration or delete is authorized.
