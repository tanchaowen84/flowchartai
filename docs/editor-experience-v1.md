# Editor experience V1

Authorized on 2026-10-13: implement the accepted single-editor inspector concept, persistent generation feedback and complex-diagram navigation. Branch: `codex/drawio-native-agent`, same draft PR #17. Main implements and self-reviews; subagents were not authorized.

## Scope and target

The native canvas, document tools and AI/Style inspector share one workspace. The document header spans the whole workspace; drawing actions occupy one host toolbar. The pinned draw.io renderer retains native objects, libraries, page tabs, keyboard handling and undo. Its redundant menu/tool chrome is hidden in the isolated bridge. Shapes default to expanded and can be toggled through Shapes. Host theme/font tokens are reflected in native chrome.

Selection updates both inspector modes. The Style panel edits labels, font size, text/fill/line color through native model operations and the existing undo/save path. Multi-selection style changes apply to all selected objects; a label edit binds to its original cell ID. Image input, AI modes, conversations, auth, quota, exports and legacy files retain their existing paths.

One compact footer holds zoom out/in, percentage and fit diagram. Task status appears there while active; an error stays visible after failure. Idle Ready/native-format labels and permanent shortcut instructions are omitted. Single-page diagrams hide native page tabs and reclaim their canvas space; multi-page diagrams retain them. Add page, overview, focus selection and View changes are available in More drawing tools. Selecting an object adds context to the inspector; Whole diagram does not occupy an empty context row. Focusing uses actual rendered bounds converted into graph coordinates, including nested containers. Pan mode works over cells as well as the background. Ordinary AI patches preserve the existing viewport. View changes brings a changed leaf to at least 100% and selects it.

## Processing contract

An active request remains visibly active after the first text delta. Native Mastra tool-input start and tool-call events expose building/preparation phases without exposing incomplete arguments. Text output, command preparation and canvas application are separate phases. Elapsed time is displayed, without invented completion percentages.

The footer remains visible when the inspector is closed or Style is active. Cancellation aborts the existing request and waits for cleanup before permitting another request. After a native command commits, cancellation cannot claim that the old diagram was kept. The canvas still receives only a complete validated command after the terminal stream event; no partial graph is applied. Successful native changes show an inline description and View changes. Long drawing requests and generated inventories can be expanded from compact conversation entries. The Agent is instructed to use one or two introductory sentences.

No business-rule veto, extra reviewer/model, vector database, server, auth/payment changes, migrations or package upgrades were added.

## Initial V1 verification and evidence boundaries

- Actual Ego Lite preview: selection synchronized with Style; text size 14 → 16; one Undo restored all 64 cells including values, styles, geometry, parent/endpoints.
- Final production preview: after autosave, reloading the saved file restored exactly the same 64 cells, including values, styles, geometry, hierarchy and endpoints. Pan over a node moved the viewport without changing its geometry; Shapes and inspector hide/show worked.
- Actual nested finance node focused at 125%, within a 1095 × 472 canvas viewport. The original unavailable bounds-method assumption was corrected to use native view states before acceptance.
- Browser-only paused-stream harness: after text output, building status and elapsed time remained visible for more than 200 seconds, including Style mode and a closed panel. Cancel aborted the reader; the empty document retained only its two root cells. Usage/SSE responses were simulated in that isolated browser tab; no model, entitlement, usage-record or canvas-write request was sent. Fetch/draft state was restored and that tab closed. This is UI-state evidence, not paid-plan or real HTTP generation acceptance.
- One real Mastra SDK generation: 32 vertices (26 flow objects + 6 groups), 31 edges, five departments, nested retry group and explicit parallel fork/AND join. 51.6 seconds; optional skill lookup plus one native drawing result. This is an individual observation outside HTTP auth/quota, not a reliability or latency promise.
- The signed-in preview user's existing free daily allowance was already exhausted (1/1). It was not changed. Fresh real HTTP generation/modification is therefore not claimed.

Validation passed: 43 files / 198 tests, `pnpm typecheck`, scoped Biome on all 13 affected TypeScript/CSS files, `git diff --check`, and the production build (41 static pages). Final browser QA used that production bundle at `http://127.0.0.1:3014`.

Fresh [AI inspector](qa/editor-experience-v1/inspector-ai.png) and [Style inspector](qa/editor-experience-v1/inspector-style.png) captures show the same selected finance node at 125%. The user's avatar was temporarily hidden in the DOM during capture and immediately restored. The actual SDK-generated [complex refund document](qa/editor-experience-v1/generated-complex-refund.drawio) remains editable.

Original browser acceptance in `qa/native-agent-upgrade/README.md` remains historical evidence; it is not relabelled as a new run. Unredacted local captures remain ignored. This iteration was self-reviewed, not independently reviewed, merged or deployed.

## Simplification follow-up — 2026-10-13

User requested Shapes open by default, less bottom chrome, and a test membership/credit grant. The layout changes above apply this follow-up without altering other accounts or quota rules. A user-authorized 30-day Professional trial and 1,000 gift credits were granted to the exact signed-in owner account in one database transaction, using existing payment, user and credit-history tables. The grant is marked manual, costs zero, has no provider subscription ID and creates no automatic charge. Private identity and grant receipts remain ignored locally. Authenticated `/api/ai/usage` readback returned Professional, monthly quota 9,999, and `canUse: true`.

Affected draw.io/Mastra tests: 21 files / 81 tests passed. Typecheck, scoped Biome, diff check and the production build (41 static pages) passed. Fresh Ego Lite production-preview checks:

- Shapes open after reload and can be toggled closed/open. The single-page tab strip is hidden and the native canvas extends to bottom 0; idle host footer contains only zoom and Fit diagram.
- More → Add page restores native tabs for two pages. One Undo restores one page, hides the tabs, and preserves exactly the original 64 cells.
- One real authenticated HTTP AI edit renamed only `n14` from 财务核算 to 财务金额核算. All styles, geometry, hierarchy and endpoints were unchanged. Real footer samples recorded Understanding, response preparation, Building diagram objects and canvas-applied completion across 23 seconds. This was one observed task, not a latency benchmark.
- View changes focused the changed node. One Undo restored all 64 cells exactly; autosave and reload preserved the restoration. Successful usage recording increased the owner's monthly count by one. API readback remained Professional and usable, with 9,997 requests left in the current monthly allowance. This verifies the manual-grant entitlement path, not a provider purchase or webhook.

The current [simplified workspace capture](qa/editor-experience-v1/simplified-workspace.png) shows the expanded palette and one bottom bar. The avatar was hidden only during capture. The tested graph is restored to its original content; grant and browser trace receipts are ignored locally.

## Ownership

- `native-diagram-workspace.tsx`: shared shell, inspector/selection, navigation and task footer.
- `native-style-panel.tsx` / `native-workspace.module.css`: native inspector fields and scoped visual integration.
- `drawio-editor.tsx` / `editor-bridge.ts`: pinned renderer initialization, native view/state/actions, reversible style changes and layout bounds.
- `ai-chat-sidebar.tsx`: existing client flow in embedded or legacy mode, persistent task state, cancellation and compact entries.
- `stream-protocol.ts` / `task-status.ts`: safe phase mapping and user-visible task states.
