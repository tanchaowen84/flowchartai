# Native Diagram Engine

| Module | Responsibility |
| --- | --- |
| contracts.ts | Native document/page identity, revision and explicit field-level operations. |
| native-document.ts | Strict uncompressed XML, stable IDs/references, style merging and saved-format dispatch. |
| command.ts | Prepare a candidate against the current document/page/revision before browser commit. |
| graph-compiler.ts | Compile structured graph plans into canonical editable native XML. |
| layout-new-diagram.ts | Server-side ELK layout for new node-link diagrams; coordinates retain meaning in sequence/ER/timeline families. |
| fit-patch-groups.ts | Grow affected ancestors without moving existing child positions. |
| route-patch.ts | Route affected connections around nodes when possible; fall back to draw.io routing and preserve other/manual paths. |
| editor-bridge.ts | Pinned same-origin draw.io transaction, rollback, undo/redo, selection, export and change focus. |
| retry-policy.ts | Optional patch shortcut for a compatible existing bounded retry loop; generic patches remain available. |
| model-settings.ts | Native reasoning and output budget. |

Upstream: the existing chat API, actual browser document and selection. Native Agent invocation lives beside the legacy Agent in `src/lib/mastra`; native tools use the installed AI SDK 7 runtime and normalize its events to the existing SSE contract. Downstream: native canvas workspace and existing authenticated save/usage endpoints. No database migration or independent service.

Native XML is stored as a versioned JSON document in the existing content field. New/empty canvases use native editing. Nonempty Excalidraw files and meaningful legacy metadata retain their editor. Invalid saved content is gated and never autosaved as an empty scene.

Changes to format, mutations, selection, renderer version or model execution must update contracts, prompts, browser bridge, this index and affected tests together. Fixtures/tests do not make paid calls; `scripts/qa-native-agent.ts` is an explicit single-task real-model probe.

The Agent owns intent, business logic and selection interpretation through its current-state prompt. Code checks file integrity and stale targets only. Creation layout and local group/connector adjustments are best effort; a layout failure retains the valid original command. Each failed tool attempt is discarded, and any correction must resend its complete batch.
