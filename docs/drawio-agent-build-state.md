# Native Diagram Agent Build State

SPEC ID: FAI-NATIVE-DIAGRAM-V1 / LOCKED. User authorized implementation on 2026-10-12.
Owner: Main. Subagents/independent code review were not authorized; review is Main self-review.
Base: main 5004fce4a2bd6888acef2d6100359c08da2529d3.
Branch: codex/drawio-native-agent. Resident dirty checkout was preserved.

## Goal and constraints

Complex native editable diagrams and reliable natural-language structural changes in the existing SaaS. No independent server, Java/Docker service, new auth/payment system or database migration. Keep nonempty legacy Excalidraw scenes and meaningful legacy metadata on their existing path. Invalid files are gated without autosaving empty replacements. Native changes preserve stable IDs, merge requested fields, validate revision/page/selection, commit atomically and support one-step Undo/Redo. Usage is recorded after canvas commit.

## Experience contract

Canvas is the main result, with the existing AI sidebar, login/quota/pricing components and authenticated file endpoints. Header exposes title, Save, Undo/Redo, editable/SVG/PNG export, assistant toggle and Show changes. Loading, retry and save/edit errors remain explicit. New diagrams use native objects rather than flattened Mermaid SVG. Existing files are not silently migrated.

## Implementation

- Pinned/SHA-verified draw.io v32.0.2 is served from the same origin as static assets. Bridge internals are isolated to editor-bridge.ts.
- Structured graph plans compile into canonical native XML; new node-link graphs use ELK in the existing server runtime.
- Generic field patches grow affected groups, avoid new overlaps/headings, reroute affected connections and run business review. Rejected mechanically valid proposals can be corrected as request-local working drafts; nothing is committed until the final candidate passes.
- A tested bounded-retry semantic operation places initialization outside the failure loop, limits retries and preserves the other branches.
- Native execution uses the installed AI SDK 7 ToolLoopAgent and OpenRouter adapter end to end, retaining the existing SSE contract. Legacy invocation remains on Mastra 1.51.
- Native text defaults to DeepSeek V4 Pro, with optional FLOWCHART_NATIVE_TEXT_MODEL override. Existing OpenRouter key is reused. Long reasoning was too slow in live trials and is disabled by default. Business review adds a model call. Other native diagram families use the same object/style/connection contracts; they were not all visually accepted in this iteration.

## Acceptance and evidence

One complex refund scenario, 5 role groups plus a nested retry subprocess, parallel approval/AND join, conditional returns and exceptions. Latest creation: 31 objects / 25 business objects plus groups, 43.3s. Two real changes: bounded retry 26.1s; risk-review insertion 42.6s. These are individual observations, not a batch reliability claim.

Actual Ego Lite canvas applied the commands and preserved manual finance color/position and finance-group geometry. Undo restored every cell from before the risk edit. Normal Save/reopen preserved all cells. A forced post-commit validation failure restored the old graph/revision/history. Editable XML, SVG, PNG and actual screenshots are linked in [QA record](qa/native-agent-upgrade/README.md).

One authenticated HTTP generation completed through the existing auth/moderation/quota/SSE/usage path. Because the new fixture's free plan allows one success/day, the final generation and two modifications used the actual SDK and browser controller; they are not paid-plan HTTP entitlement evidence. No paid subscription or quota bypass was fabricated. Only one new fixture user and its owned data were written, through normal product save APIs after fixture setup. No existing-user writes, schema changes or deletes.

Ego TaskSpace 21 vanished. The user explicitly authorized a replacement; all subsequent browser QA used agent-owned TaskSpace 3 / p1. Unrelated spaces were not used.

## Final checks

| Check | Result |
| --- | --- |
| Whole regression | 46 files / 191 tests PASS |
| Typecheck | PASS |
| Scoped Biome | 52 changed source/config files PASS |
| Normal production build | PASS; 41 static pages; no mocked font resources |
| Production preview | localhost:3014; saved native document loaded with no alerts |
| Independent code review | Not performed; not authorized |
| Production merge/deployment | Not requested; not performed |

Local environment files and QA credentials remain ignored/private. The inherited shell OpenRouter key differed from the project key, so preview startup uses env -u OPENROUTER_API_KEY. Development key was read from the existing linked Vercel project without modifying remote environment variables. OpenRouter rejected an OpenAI-model trial with a 403 Terms of Service response; it was not bypassed and is not selected.

## Delivery

Implementation and acceptance completed locally. Draft PR preparation/delivery is the final repository step. Preview and source changes are distinct from deployed production behavior.
