# Native diagram upgrade acceptance

2026-10-13, isolated branch `codex/drawio-native-agent`, base `5004fce4`.

## Result

One complex refund scenario: 5 role groups, a nested retry subprocess, parallel approvals and an AND join, conditional returns and exception paths. Latest native creation produced 31 objects (25 business/fork/join objects plus 6 groups) through the real configured model in 43.3 seconds. Two real modification scenarios passed: bounded retry (26.1 seconds) and insertion of risk review (42.6 seconds). These are individual observations, not a reliability percentage or batch benchmark.

Retry is compiled as a tested semantic operation: initialization sits before the initial refund, outside the repeated failure path; eligible failures check the count, retry once, increment once and return to the refund action; three failed retries then enter the original manual handler. The original non-retryable and success paths remain. Generic structural edits use field-level patches with current-state context, business review and bounded correction.

The risk edit redirects the entry before the existing parallel fork: low risk enters that fork; high risk enters manual review, approval resumes the same fork and rejection ends. Its original two branches and AND join remain. Native group fitting, placement and affected-connection routing run before committing.

## Evidence boundaries

- Ego Lite TaskSpace 3 / p1; the vanished TaskSpace 21 was replaced only after explicit user authorization.
- One authenticated HTTP AI generation completed using the existing auth/moderation/quota/SSE/usage path. It consumed the fixture's existing daily free allowance.
- Final creation and two edits used the actual native Agent SDK, then the same browser controller. They do not constitute a paid-plan HTTP entitlement test. No fake subscription or quota bypass was added.
- Normal authenticated Save and reopen used the existing POST/PUT/GET file APIs and one new fixture user only. No existing-user writes, payment rows, schema migrations or deletes.
- Undo restored every cell from before the second edit; saved/reopened cells matched the Undo result. Manual finance color, position and finance-group geometry matched the original manual state exactly.
- A forced post-commit validation failure restored the previous graph/revision/history without leaving the probe cell.
- Editable XML, SVG and PNG exported from the real canvas. Screenshots are actual product captures, not prototype renderings.

## Local verification

- `pnpm test`: 46 files / 191 tests passed.
- `pnpm run typecheck --pretty false`: passed.
- Scoped `pnpm exec biome check`: 52 changed source/config files, passed without fixes.
- `env -u OPENROUTER_API_KEY pnpm build`: normal production build passed; 41 static pages generated. No mocked font resources were used.

## Architecture and deployment

Static draw.io v32.0.2 is SHA-pinned and downloaded during dev/build into ignored `public/drawio` (about 111 MB). Its Java/backend files are excluded. Keep the editor and bridge version aligned; an incompatible cached editor/download failure fails bootstrap. ELK runs as a JavaScript library in the existing server runtime. PNG rasterization runs in the browser. Existing auth, payments, data storage and usage rules are reused.

Native tools now use the installed AI SDK 7 end to end; legacy Mermaid/Excalidraw invocation remains on Mastra. Existing SSE events are preserved through the native stream adapter. Text defaults to `deepseek/deepseek-v4-pro` with `FLOWCHART_NATIVE_TEXT_MODEL` as an optional override; the existing OpenRouter key is reused. Long thinking was too slow in real trials and is disabled by default. Semantic review adds a model call. OpenRouter rejected an OpenAI-model trial with 403 Terms of Service; no bypass was used and that model is not the default.

No independent server, Docker/Java runtime, database migration or new API credential is required. Production deployment was not requested and was not performed. Code review was Main self-review; independent subagent review was not authorized. Other diagram families have native object/style/connection contracts, but this acceptance covers complex flowcharts, not every family or device.

## Artifacts

- `generated-complex-refund.drawio`: latest real native creation.
- `after-two-edits.drawio`: real browser graph after both edits.
- `after-undo.drawio`, `after-undo.svg`, `after-undo.png`: exported saved/reopened state, retaining bounded retries and undoing risk insertion.
- `bounded-retry.png`, `risk-insertion.png`: actual focused canvas captures.
