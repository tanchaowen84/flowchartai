# FlowChart AI agent implementation

## Architecture

FlowChart AI uses one Mastra `FlowchartAgent` in
`src/lib/mastra/flowchart-agent.ts`. The Next.js route
`src/app/api/ai/chat/flowchart/route.ts` performs authentication, usage-limit
checks and Creem moderation before invoking the agent through Mastra's
OpenRouter Gateway.

The browser receives a stable SSE protocol:

- `text`: streamed assistant text.
- `tool-call`: one complete, server-validated `CanvasCommand`.
- `finish`: terminal success, including whether a tool completed.
- `error` / `aborted`: terminal failure with no canvas mutation or usage charge.

The browser never applies partial tool arguments. It keeps a cross-network-
chunk SSE buffer and commits a command only after both a valid tool result and
the terminal `finish` event are present.

## Models and environment

Mastra Gateway model IDs use `openrouter/<provider>/<model>`. Production model
selection is environment-configurable:

```env
OPENROUTER_API_KEY="sk-or-v1-..."
FLOWCHART_TEXT_MODEL="deepseek/deepseek-v4-flash"
FLOWCHART_IMAGE_MODEL="bytedance-seed/seed-2.0-mini"
```

`FLOWCHART_TEXT_MODEL` and `FLOWCHART_IMAGE_MODEL` may also be supplied with an
existing `openrouter/` prefix. Text mode and single-image mode are routed
separately.

## Canvas command contract

The `generate_flowchart` server tool returns one of two commands defined in
`src/lib/diagram/contracts.ts`:

- `render-mermaid`: create a diagram or fully replace one explicit target.
- `patch-diagram`: atomically apply semantic node/edge operations to one
  explicit `flowchart` / `graph` target and base revision.

The command executor in `src/lib/diagram/canvas-command-executor.ts` preserves
user-created elements and other AI diagrams. A local patch also preserves the
IDs and positions of unchanged semantic elements. Ambiguous targets, stale
revisions, invalid references and unsupported syntax fail before `updateScene`.

Local patching uses one shared editable Mermaid capability profile across the
Agent prompt, parser, contracts, serializer, renderer, executor, and tests. It
supports `flowchart` / `graph`; `LR`, `RL`, `TD`, and `BT`; stable semantic IDs;
rectangle, rounded, diamond, ellipse/stadium, and circle nodes; `-->` and
`-.->` edges with pipe labels; and explicit node `fill`, `stroke`, and
`stroke-width`. Node style updates replace the full style object, so retained
keys must be included. Each directed source-target pair appears at most once,
uses the canonical edge ID `source__target`, and changes endpoints through an
explicit remove plus add rather than `updateEdge`. HTML labels, subgraphs,
classes, edge styling, parallel edges, advanced connectors, unsupported shapes,
and other Mermaid families use targeted replacement so appearance or structure
is never silently degraded.

Patchability also requires the Excalidraw scene semantic IDs to align with the
stored `DiagramDocument`. Older generic Mermaid scenes using `full:*` IDs are
first upgraded through one targeted replacement; only the aligned result can be
patched later. This prevents a legacy edit from appending duplicate elements.
Older V1 document records that no longer satisfy the shared profile are migrated
record by record into full-replacement Mermaid records; unrelated valid metadata
is preserved instead of discarding the whole metadata envelope.

## Persistence, Undo and billing

Semantic documents and full-replacement records are stored in the existing
Excalidraw JSON under the top-level `flowchartAi` field. No database migration
is required. Save, reload and Excalidraw JSON export preserve this metadata;
legacy files without it remain loadable and are upgraded when safely targeted.

Each successful command uses one `updateScene` call with
`CaptureUpdateAction.IMMEDIATELY`, so Undo restores the pre-command canvas.
One managed element carries the diagram source and revision inside the same
Excalidraw history entry. The canvas `onChange` handler derives top-level
metadata from that carrier, keeping Undo/Redo, save, reload and the next Patch
on the same revision. Late saved-scene hydration uses
`CaptureUpdateAction.NEVER`, establishing the persisted scene as the history
baseline instead of merging it into the first new local Patch.
Usage is recorded once, and only after the canvas commit succeeds. Rendering
failures, stream errors and aborts record zero usage.

## Loading and runtime boundaries

- The edit route starts saved-flowchart data loading in its small client chunk
  while the editor chunk downloads.
- The editor displays one loading shell and applies late saved data without a
  second full-screen remount.
- The assistant and export modal are separate lazy chunks.
- Image helpers and Mermaid conversion load only when needed; the Mermaid
  converter is opportunistically preloaded during browser idle time.
- Local patches do not force a viewport zoom.

The application deploys to Vercel with a 60-second API function limit from
`vercel.json`. Cloudflare is retained only for DNS and the R2-backed
`cdn.flowchartai.org` asset path. The former OpenNext/Workers application deploy
chain is not part of this architecture. `@mastra/core` remains a traced Node
server package through Next.js `serverExternalPackages`, which keeps it out of
the webpack-minified route bundle while preserving it in Vercel functions.
