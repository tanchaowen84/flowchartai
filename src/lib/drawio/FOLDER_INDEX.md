# Native Diagram Engine

| Module | Responsibility |
| --- | --- |
| contracts.ts | Native document/page identity, revision and explicit field-level operations. |
| diagram-title.ts | Apply generated file names after a successful command while preserving user names and ordinary-edit titles. |
| native-document.ts | Strict uncompressed XML, stable IDs/references, style merging and saved-format dispatch. |
| command.ts | Prepare a candidate against the current document/page/revision before browser commit. |
| graph-compiler.ts | Compile structured graph plans into canonical editable native XML. |
| layout-new-diagram.ts | Server-side ELK layout for new node-link diagrams; coordinates retain meaning in sequence/ER/timeline families. |
| fit-patch-groups.ts | Grow affected ancestors without moving existing child positions. |
| route-patch.ts | Route affected connections around nodes when possible; fall back to draw.io routing and preserve other/manual paths. |
| editor-bridge.ts | Pinned same-origin draw.io transaction, rollback, undo/redo, selection/view observation, host tool actions, style edits, zoom/fit/focus, export and change focus. |
| retry-policy.ts | Optional patch shortcut for a compatible existing bounded retry loop; generic patches remain available. |
| model-settings.ts | Native reasoning and output budget. |
| visible-additions.ts | External API/MCP delivery guard against near-total mutual overlap of a newly added process and another same-parent process; text and container layers remain valid. |

Upstream: the existing chat API, actual browser document and selection. Native Agent invocation lives beside the legacy Agent in `src/lib/mastra`; both paths use Mastra Agent/createTool and the existing Mastra SSE mapper. Native execution uses the existing modern OpenRouter model instance and attaches the bundled drawio-native Skill. Relevant references are preloaded; other references can be read on demand without a filesystem workspace or extra service. Downstream: native canvas workspace and existing authenticated save/usage endpoints. No database migration or independent service.

Native XML is stored as a versioned JSON document in the existing content field. New/empty canvases use native editing. Nonempty Excalidraw files and meaningful legacy metadata retain their editor. Invalid saved content is gated and never autosaved as an empty scene.

Changes to format, mutations, selection, renderer version or model execution must update contracts, prompts, browser bridge, this index and affected tests together. Fixtures/tests do not make paid calls; `scripts/qa-native-agent.ts` is an explicit single-task real-model probe.

The Agent owns intent, business logic and selection interpretation through its current-state prompt. Code checks file integrity and stale targets. External delivery additionally rejects a new process hiding another process at nearly the same rectangle, inside the existing tool loop; it does not add a review model or judge workflow rules. Website placement behavior is unchanged. Creation layout and local group/connector adjustments are best effort; a layout failure retains the valid original command. Each failed tool attempt is discarded, and any correction must resend its complete batch.

The host workspace owns document/tool chrome and a shared AI/Style inspector. The bridge alone touches pinned renderer internals, including theme synchronization. Native progress events describe work without sending incomplete drawing arguments; drawing commits remain atomic. See `docs/editor-experience-v1.md`.
