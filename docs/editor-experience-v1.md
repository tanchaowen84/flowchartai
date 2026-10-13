# Editor experience V1

Authorized on 2026-10-13: implement the accepted single-editor inspector concept, persistent generation feedback and complex-diagram navigation. Branch: `codex/drawio-native-agent`, same draft PR #17. Main implements and self-reviews; subagents were not authorized.

## Scope and target

The native canvas, document tools and AI/Style inspector share one workspace. The document header spans the whole workspace; drawing actions occupy one host toolbar. The pinned draw.io renderer retains native objects, libraries, page tabs, keyboard handling and undo. Its redundant menu/tool chrome is hidden in the isolated bridge. Shapes default to collapsed and remain available through Shapes. Host theme/font tokens are reflected in native chrome.

Selection updates both inspector modes. The Style panel edits labels, font size, text/fill/line color through native model operations and the existing undo/save path. Multi-selection style changes apply to all selected objects; a label edit binds to its original cell ID. Image input, AI modes, conversations, auth, quota, exports and legacy files retain their existing paths.

Zoom out/in, percentage selection, fit diagram and focus selection remain visible. Focusing uses actual rendered bounds converted into graph coordinates, including nested containers. Pan mode works over cells as well as the background; native overview and text insertion remain available. Ordinary AI patches preserve the existing viewport. View changes brings a changed leaf to at least 100% and selects it.

## Processing contract

An active request remains visibly active after the first text delta. Native Mastra tool-input start and tool-call events expose building/preparation phases without exposing incomplete arguments. Text output, command preparation and canvas application are separate phases. Elapsed time is displayed, without invented completion percentages.

The footer remains visible when the inspector is closed or Style is active. Cancellation aborts the existing request and waits for cleanup before permitting another request. After a native command commits, cancellation cannot claim that the old diagram was kept. The canvas still receives only a complete validated command after the terminal stream event; no partial graph is applied. Successful native changes show an inline description and View changes. Long drawing requests and generated inventories can be expanded from compact conversation entries. The Agent is instructed to use one or two introductory sentences.

No business-rule veto, extra reviewer/model, vector database, server, auth/payment changes, migrations or package upgrades were added.

## Fresh verification and evidence boundaries

- Actual Ego Lite preview: selection synchronized with Style; text size 14 → 16; one Undo restored all 64 cells including values, styles, geometry, parent/endpoints.
- Final production preview: after autosave, reloading the saved file restored exactly the same 64 cells, including values, styles, geometry, hierarchy and endpoints. Pan over a node moved the viewport without changing its geometry; Shapes and inspector hide/show worked.
- Actual nested finance node focused at 125%, within a 1095 × 472 canvas viewport. The original unavailable bounds-method assumption was corrected to use native view states before acceptance.
- Browser-only paused-stream harness: after text output, building status and elapsed time remained visible for more than 200 seconds, including Style mode and a closed panel. Cancel aborted the reader; the empty document retained only its two root cells. Usage/SSE responses were simulated in that isolated browser tab; no model, entitlement, usage-record or canvas-write request was sent. Fetch/draft state was restored and that tab closed. This is UI-state evidence, not paid-plan or real HTTP generation acceptance.
- One real Mastra SDK generation: 32 vertices (26 flow objects + 6 groups), 31 edges, five departments, nested retry group and explicit parallel fork/AND join. 51.6 seconds; optional skill lookup plus one native drawing result. This is an individual observation outside HTTP auth/quota, not a reliability or latency promise.
- The signed-in preview user's existing free daily allowance was already exhausted (1/1). It was not changed. Fresh real HTTP generation/modification is therefore not claimed.

Validation passed: 43 files / 198 tests, `pnpm typecheck`, scoped Biome on all 13 affected TypeScript/CSS files, `git diff --check`, and the production build (41 static pages). Final browser QA used that production bundle at `http://127.0.0.1:3014`.

Fresh [AI inspector](qa/editor-experience-v1/inspector-ai.png) and [Style inspector](qa/editor-experience-v1/inspector-style.png) captures show the same selected finance node at 125%. The user's avatar was temporarily hidden in the DOM during capture and immediately restored. The actual SDK-generated [complex refund document](qa/editor-experience-v1/generated-complex-refund.drawio) remains editable.

Original browser acceptance in `qa/native-agent-upgrade/README.md` remains historical evidence; it is not relabelled as a new run. Unredacted local captures remain ignored. This iteration was self-reviewed, not independently reviewed, merged or deployed.

## Ownership

- `native-diagram-workspace.tsx`: shared shell, inspector/selection, navigation and task footer.
- `native-style-panel.tsx` / `native-workspace.module.css`: native inspector fields and scoped visual integration.
- `drawio-editor.tsx` / `editor-bridge.ts`: pinned renderer initialization, native view/state/actions, reversible style changes and layout bounds.
- `ai-chat-sidebar.tsx`: existing client flow in embedded or legacy mode, persistent task state, cancellation and compact entries.
- `stream-protocol.ts` / `task-status.ts`: safe phase mapping and user-visible task states.
