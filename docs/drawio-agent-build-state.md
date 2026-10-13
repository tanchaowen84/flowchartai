# Native Diagram Agent Build State

SPEC ID: FAI-NATIVE-DIAGRAM-V1 / LOCKED. User authorized implementation on 2026-10-12.
Owner: Main. Subagents/independent code review were not authorized; review is Main self-review.
Base: main 5004fce4a2bd6888acef2d6100359c08da2529d3.
Branch: codex/drawio-native-agent. Resident dirty checkout was preserved.

## Goal and constraints

Complex native editable diagrams and reliable natural-language structural changes in the existing SaaS. No independent server, Java/Docker service, new auth/payment system or database migration. Keep nonempty legacy Excalidraw scenes and meaningful legacy metadata on their existing path. Invalid files are gated without autosaving empty replacements. Native changes preserve stable IDs, merge requested fields, validate document/revision/page, commit atomically and support one-step Undo/Redo. Usage is recorded after canvas commit.

## Experience contract

Canvas is the main result, with the existing AI sidebar, login/quota/pricing components and authenticated file endpoints. Header exposes title, Save, Undo/Redo, editable/SVG/PNG export, assistant toggle and Show changes. Loading, retry and save/edit errors remain explicit. New diagrams use native objects rather than flattened Mermaid SVG. Existing files are not silently migrated.

## Implementation

- Pinned/SHA-verified draw.io v32.0.2 is served from the same origin as static assets. Bridge internals are isolated to editor-bridge.ts.
- Structured graph plans compile into canonical native XML; new node-link graphs use ELK in the existing server runtime.
- One generic field-patch path handles structural edits, including cross-group changes. A compatible bounded retry loop can use an optional shortcut that compiles to the same field patch; other edits remain generic. The Agent interprets business intent and selection in its prompt; no second model veto, keyword-based rebuild gate, reachability/entry gate, overlap gate or request-local draft merging remains.
- New diagrams use ELK layout; patches grow affected containers and route affected connectors when possible. These are best effort. Layout failure retains the already-valid original command; blocked connector routing falls back to draw.io. Existing groups are no longer moved automatically to the bottom of siblings.
- Both native and legacy invocation use Mastra 1.51 Agent/createTool. Native passes the existing modern OpenRouter model instance directly into Mastra; the SDK-only Agent wrapper and stream adapter were removed. The existing SSE mapper consumes actual Mastra chunks.
- The native Agent attaches the in-memory drawio-native Skill with seven authored reference summaries. Three relevant references are preloaded from the request and current family; all references remain readable on demand. No filesystem workspace, embeddings, vector database or extra service. Soft reference selection does not restrict diagram families or edits.
- Native text defaults to DeepSeek V4 Pro, with optional FLOWCHART_NATIVE_TEXT_MODEL override. Existing OpenRouter key is reused. Long reasoning was too slow in live trials and is disabled by default. No separate semantic-review model call is required. Other native diagram families use the same object/style/connection contracts; they were not all visually accepted in this iteration.

## Original acceptance before simplification

One complex refund scenario, 5 role groups plus a nested retry subprocess, parallel approval/AND join, conditional returns and exceptions. Latest creation: 31 objects / 25 business objects plus groups, 43.3s. Two real changes: bounded retry 26.1s; risk-review insertion 42.6s. These are individual observations, not a batch reliability claim.

Actual Ego Lite canvas applied the commands and preserved manual finance color/position and finance-group geometry. Undo restored every cell from before the risk edit. Normal Save/reopen preserved all cells. A forced post-commit validation failure restored the old graph/revision/history. Editable XML, SVG, PNG and actual screenshots are linked in [QA record](qa/native-agent-upgrade/README.md).

One authenticated HTTP generation completed through the existing auth/moderation/quota/SSE/usage path. Because the new fixture's free plan allows one success/day, the final generation and two modifications used the actual SDK and browser controller; they are not paid-plan HTTP entitlement evidence. No paid subscription or quota bypass was fabricated. Only one new fixture user and its owned data were written, through normal product save APIs after fixture setup. No existing-user writes, schema changes or deletes.

Ego TaskSpace 21 vanished. The user explicitly authorized a replacement; all subsequent browser QA used agent-owned TaskSpace 3 / p1. Unrelated spaces were not used.

## Original checks before simplification

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

Original implementation is pushed in draft PR #17. The user subsequently requested fewer code hard gates; the same PR is being updated with the simplified path and fresh SDK acceptance. Preview and source changes are distinct from deployed production behavior.

## Simplification delivered — 2026-10-13

User authorization: simplify code hard gates while retaining complex generation/editing capability. Removed five heuristic/review modules plus selection locking, no-change rejection and implicit draft merging. The Agent chooses intent; code validates native file integrity and stale targets. Layout is best effort and successful native commands end the model loop immediately.

A compatible bounded retry has an optional five-field local-patch shortcut; it derives its container from the existing retry step. Generic structural edits remain available, and shortcut plus explicit generic operations compose into one atomic command. No new server, credential, schema, payment or model-routing system.

Fresh real SDK observations: generation 31 vertices/30 connections in 25.8s, bounded retry in 9.3s, risk insertion in 7.8s. Manual finance node/group preserved. Tests: 42 files / 192 PASS; typecheck, 13-file scoped Biome and production build PASS. A longer risk request timed out, so these observations are not a blanket reliability claim. Current SDK evidence and native files are in the QA record; browser evidence is the explicitly labelled original acceptance.

Delivered in the same draft PR #17. No production merge/deployment. Main self-review only.


## Mastra and bundled knowledge delivered — 2026-10-13

User authorization: add draw.io guidance and unify back to Mastra. Native now returns a real Mastra Agent with a createTool drawing tool and an inline Skill. Mastra receives the existing AI SDK 7 model instance, preserving provider settings. No package/version/model/env changes. The redundant native stream adapter is deleted.

Knowledge covers shapes/styles, real group parenting and relative geometry, connectors, complex flow patterns, ER, sequence/timeline, architecture/tree/UML. Sources and adaptation are recorded in [knowledge guide](drawio-agent-knowledge.md). References are available through skill/skill_read/skill_search, without a workspace. Relevant guidance is preloaded to avoid mandatory retrieval calls. MaxSteps is five to allow optional skill reads and a correction; the first valid drawing command stops immediately. Knowledge tool results never become canvas commands.

Fresh small acceptance: final generation has 35 vertices (29 flow nodes + 6 groups), 34 edges, explicit independent approval branches and a labelled AND join. Bounded retry and pre-fork risk insertion both passed on the accepted manual-style diagram; finance node/group, success branch, parallel branches and existing retry cells were preserved. Individual elapsed observations: 17.6s / 10.7s / 10.5s. One earlier generation had an ambiguous join label; the reference example was refined and the final generation rerun. These samples are not a reliability benchmark or all-family visual acceptance.

Transport tests use the actual Mastra loop plus modern model adapter: successful command stops after one request; a stale patch is corrected; skill activation and reference read can precede one canvas command. All events pass through the existing SSE mapper. Fresh checks: 42 files / 195 tests PASS; typecheck, scoped Biome and production build recorded in QA. Existing browser Undo/Save/reopen evidence is historical; this change does not alter the browser transaction code. Main self-review only; no production merge/deployment.


## Editor experience V1 — 2026-10-13

User approved the revised single-editor shell, shared AI/Style inspector, persistent task feedback and visible zoom/navigation. Implementation and current evidence are in [Editor experience V1](editor-experience-v1.md). Native/legacy model execution remains Mastra; the drawing kernel, billing rules and data format are retained. UI-state simulation is separated from actual native editor and real SDK evidence. No production deployment or independent review.
