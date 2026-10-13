# Native diagram upgrade acceptance

2026-10-13, isolated branch `codex/drawio-native-agent`, base `5004fce4`.

## Original browser acceptance before simplification

One complex refund scenario: 5 role groups, a nested retry subprocess, parallel approvals and an AND join, conditional returns and exception paths. Latest native creation produced 31 objects (25 business/fork/join objects plus 6 groups) through the real configured model in 43.3 seconds. Two real modification scenarios passed: bounded retry (26.1 seconds) and insertion of risk review (42.6 seconds). These are individual observations, not a reliability percentage or batch benchmark.

In the original implementation, retry was compiled as a tested semantic operation: initialization sits before the initial refund, outside the repeated failure path; eligible failures check the count, retry once, increment once and return to the refund action; three failed retries then enter the original manual handler. The original non-retryable and success paths remain. That implementation used business review and bounded correction. The current implementation exposes retry as an optional local-patch shortcut and keeps generic patches available; see the fresh simplification record below.

The risk edit redirects the entry before the existing parallel fork: low risk enters that fork; high risk enters manual review, approval resumes the same fork and rejection ends. Its original two branches and AND join remain. The original browser acceptance included group fitting, placement and affected-connection routing. Placement gates and automatic group relocation were subsequently removed.

## Evidence boundaries

- Ego Lite TaskSpace 3 / p1; the vanished TaskSpace 21 was replaced only after explicit user authorization.
- One authenticated HTTP AI generation completed using the existing auth/moderation/quota/SSE/usage path. It consumed the fixture's existing daily free allowance.
- Final creation and two edits used the actual native Agent SDK, then the same browser controller. They do not constitute a paid-plan HTTP entitlement test. No fake subscription or quota bypass was added.
- Normal authenticated Save and reopen used the existing POST/PUT/GET file APIs and one new fixture user only. No existing-user writes, payment rows, schema migrations or deletes.
- Undo restored every cell from before the second edit; saved/reopened cells matched the Undo result. Manual finance color, position and finance-group geometry matched the original manual state exactly.
- A forced post-commit validation failure restored the previous graph/revision/history without leaving the probe cell.
- Editable XML, SVG and PNG exported from the real canvas. Screenshots are actual product captures, not prototype renderings.

## Original local verification

- `pnpm test`: 46 files / 191 tests passed.
- `pnpm run typecheck --pretty false`: passed.
- Scoped `pnpm exec biome check`: 52 changed source/config files, passed without fixes.
- `env -u OPENROUTER_API_KEY pnpm build`: normal production build passed; 41 static pages generated. No mocked font resources were used.

## Architecture and deployment

Static draw.io v32.0.2 is SHA-pinned and downloaded during dev/build into ignored `public/drawio` (about 111 MB). Its Java/backend files are excluded. Keep the editor and bridge version aligned; an incompatible cached editor/download failure fails bootstrap. ELK runs as a JavaScript library in the existing server runtime. PNG rasterization runs in the browser. Existing auth, payments, data storage and usage rules are reused.

Both native and legacy execution now use Mastra Agent/createTool. Native passes the installed modern OpenRouter model instance directly into Mastra; actual Mastra chunks go through the existing SSE mapper. The SDK-only wrapper and stream adapter are removed. Text defaults to `deepseek/deepseek-v4-pro` with `FLOWCHART_NATIVE_TEXT_MODEL` as an optional override; the existing OpenRouter key is reused. Long thinking was too slow in real trials and is disabled by default. The original semantic-review call was removed in the subsequent simplification. OpenRouter rejected an OpenAI-model trial with 403 Terms of Service; no bypass was used and that model is not the default.

No independent server, Docker/Java runtime, database migration or new API credential is required. Production deployment was not requested and was not performed. Code review was Main self-review; independent subagent review was not authorized. Other diagram families have native object/style/connection contracts, but this acceptance covers complex flowcharts, not every family or device.

## Artifacts

- `generated-complex-refund.drawio`: latest real native creation.
- `after-two-edits.drawio`: real browser graph after both edits.
- `after-undo.drawio`, `after-undo.svg`, `after-undo.png`: exported saved/reopened state, retaining bounded retries and undoing risk insertion.
- `bounded-retry.png`, `risk-insertion.png`: actual focused canvas captures.

## Execution simplification — current implementation

The user requested fewer code hard gates. The current native execution path is:

User request + current canvas objects/selection → one Agent → native generation or field patch → file/target/revision/page integrity checks → atomic editor commit.

Removed the separate business-review model veto, singleton-entry/reachability check, keyword-based rebuild check, selection lock, overlap/header/container-placement veto, no-change veto and implicit merging of failed draft patches. Removed automatic relocation of expanded groups below siblings. Layout, group growth and affected connector routing are best effort; a layout error retains the valid original command and unroutable connectors use draw.io routing.

The first valid command ends the Agent loop, without another model call just to summarize the tool result. One correction remains available for an invalid format/reference result. Stable IDs, field merging, stale-target protection, duplicate-commit prevention, rollback and one-step Undo/Redo remain.

A compatible existing retry loop can use an optional local-patch shortcut. Its five inputs identify the main action, retry step, eligibility decision, manual handler and retry limit; the container is inherited from the actual retry step. This prevents misplaced initialization and places limit/increment nodes inside the existing retry subgroup. Generic patches remain available, and explicitly supplied generic operations can be combined with the shortcut in one atomic command.

### Fresh small-scenario verification

| Task | Observation |
| --- | --- |
| Complex generation | 31 vertices: 25 flow nodes plus 5 role groups and 1 nested retry group; 30 labelled/structural connections; 25.8s |
| Bounded retry | One successful real Agent request using the shortcut; initialization before the first refund, eligible failure → limit → retry → increment → original refund; exhaustion/non-retryable → manual; 9.3s |
| Risk insertion | One successful real Agent request with a concise equivalent brief; low risk and approved manual review enter the original fork, rejection ends; both original parallel branches/AND join and retry cells preserved; 7.8s |

Generation used a fresh blank document. The two edits used the previously accepted complex refund document with manual finance styling/position. Finance node and finance-group snapshots matched exactly after both edits. These are individual successful observations, not latency guarantees or reliability percentages.

Freeform retry trials misplaced initialization; that is why the optional shortcut is retained rather than adding a generic business veto. A longer risk request also timed out at the SDK probe's 180-second limit without producing a command; the shorter equivalent request passed. Broader complex edits still need user review and iterative refinement.

Native text remains DeepSeek V4 Pro with the original fast provider settings. Full-thinking and alternative-model trials were not adopted: full thinking was too slow in an edit trial; a MiniMax proposal bypassed the requested fork; Kimi timed out; Gemini was rejected with provider Terms of Service 403 and was not bypassed. No remote model/env settings changed.

Fresh checks: 42 files / 192 tests passed, typecheck passed, scoped Biome passed on 13 source/test/script files, and production build passed with 41 static pages. The fresh scenarios exercise the real SDK and shared native-document engine; no new HTTP entitlement, browser Undo/Save/reopen or all-family visual acceptance is claimed. Original Ego Lite screenshots and browser evidence above remain labelled as pre-simplification evidence. The browser result space is user-owned and was not reclaimed.

Current editable outputs:

- [Generated complex refund diagram](simplified-generated-complex-refund.drawio)
- [After bounded retry](simplified-after-retry.drawio)
- [After risk insertion](simplified-after-risk.drawio)

Production merge/deployment was not requested and was not performed. The same draft PR #17 is updated.


## Mastra + bundled knowledge — current acceptance, 2026-10-13

Both paths now use Mastra 1.51. Native attaches an in-memory Skill with seven curated guides and preloads three relevant references per request. Other references are readable via Mastra skill tools. There is no workspace/embedding/vector database or new server. See [knowledge and sources](../../drawio-agent-knowledge.md).

| Task | Fresh observation |
| --- | --- |
| Complex generation | 35 vertices: 29 flow nodes + 5 departments + 1 nested retry group; 34 edges; independent supervisor/finance result decisions → labelled AND join; supplement/correction/retry loops and exceptions; 17.6s |
| Bounded retries | One atomic local patch combines the existing shortcut and a requested subgroup geometry change; initialization before first refund, limit before eligible retry, increment once, return without reset; exhaustion/non-retryable → manual, success unchanged; 10.7s |
| Risk before parallel phase | Reconnect old entrance; low risk and approved manual review resume at the original fork, rejection ends. Original branch/AND-join and bounded retry objects retained; 10.5s |

The two edits used the previously accepted complex native document with manual finance styling and position. Finance node and finance-group XML snapshots matched exactly after both edits; risk insertion retained the pre-existing retry cells and parallel/success connections. These are real Mastra/model/document-engine observations, not a new HTTP entitlement or browser Undo/Save/reopen run. One earlier generation used an ambiguous join label; the example was clarified and final generation rerun. No automatic business veto was added. All-family visual quality remains outside this small acceptance.

Transport regression tests run the actual Mastra Agent with a mocked provider transport, proving modern-model compatibility, immediate stop after success, stale-patch correction, actual skill activation/reference reading, and exactly one stable canvas event after knowledge lookups. Current checks: 42 files / 195 tests passed; typecheck, scoped Biome and normal production build passed with 41 static pages. No independent review, production merge or deployment.

Current editable outputs:

- [Mastra generated complex refund](mastra-generated-complex-refund.drawio)
- [Mastra bounded retry](mastra-after-retry.drawio)
- [Mastra risk insertion](mastra-after-risk.drawio)
