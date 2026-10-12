# Native Diagram Engine

| Module | Responsibility |
| --- | --- |
| contracts.ts | Native document/page identity, revision and explicit field-level operations. |
| native-document.ts | Strict uncompressed XML, stable IDs/references, selection scope, style merging and saved-format dispatch. |
| command.ts | Prepare a candidate against the current document/page/revision before browser commit. |
| graph-compiler.ts | Compile structured graph plans into canonical editable native XML. |
| layout-new-diagram.ts | Server-side ELK layout for new node-link diagrams; coordinates retain meaning in sequence/ER/timeline families. |
| fit-patch-groups.ts / place-patch.ts | Grow affected ancestors and place expanded containers without moving unrelated sibling vertices. |
| patch-placement.ts | Reject new overlaps, header collisions and children escaping their group. |
| route-patch.ts | Route new/reconnected/moved connections around native nodes; preserve other/manual paths. |
| editor-bridge.ts | Pinned same-origin draw.io transaction, rollback, undo/redo, selection, export and change focus. |
| retry-policy.ts | Tested bounded-retry transformation with one-time initialization outside the loop. |
| rebuild-intent.ts | Whole-diagram replacement requires explicit user intent. |
| model-settings.ts | Native reasoning and output budget. |

Upstream: the existing chat API, actual browser document and selection. Native Agent invocation and semantic review live beside the legacy Agent in `src/lib/mastra`; native tools use the installed AI SDK 7 runtime and normalize its events to the existing SSE contract. Downstream: native canvas workspace and existing authenticated save/usage endpoints. No database migration or independent service.

Native XML is stored as a versioned JSON document in the existing content field. New/empty canvases use native editing. Nonempty Excalidraw files and meaningful legacy metadata retain their editor. Invalid saved content is gated and never autosaved as an empty scene.

Changes to format, mutations, selection, renderer version or model execution must update contracts, prompts, browser bridge, this index and affected tests together. Fixtures/tests do not make paid calls; `scripts/qa-native-agent.ts` is an explicit single-task real-model probe.
