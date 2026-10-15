# API/MCP landing contract

Content status: DRAFT REVIEW. Owner authorized implementation and release in the handoff; no separate content lock is claimed. Review: main-agent self-review only.

Date: 2026-10-15, Asia/Shanghai. Shared shell: marketing layout, Navbar/getNavbarLinks, Footer. Independent API/MCP links appear in desktop and mobile navigation. Dashboard also links Developers. Pricing remains a direct global destination.

## Demand and current SERP

Ego Lite Google searches: `flowchart generation api`, `flowchart mcp server` (personalized Hong Kong results, not a country-ranking claim). API results included Lucid developer questions, Eraser, ChartQuery and FreeFlowcharts; MCP results included UIFlowchartCreator, draw.io, Mermaid Chart, SmartDraw and flowchart-mcp. Search snippets were used only for intent discovery, not as verified competitor implementation facts. Direct Ego inspection of https://www.chartquery.com/p/flowchart-api confirmed a request-first Hero, API-key CTA and Live Preview; this supports showing the request and actual output together. The SmartDraw candidate returned its 404 page, so no implementation claim is drawn from it. Subsequent Ego bootstrap/reconnect calls timed out; no unavailable page is treated as inspected.

| Requirement | Page surface | Product evidence |
| --- | --- | --- |
| Prompt -> actual file and request example | API Hero / output example | REST request and actual native Agent receipt |
| Editable result and subsequent changes | API workflow / MCP example | Native XML engine, content hash, saved website file |
| Output formats and integrations | API format section / docs | drawio + JSON API exports; SVG/PNG in website |
| API auth, cost and recovery | API budget / FAQ / Quickstart | scoped expiring keys, shared wallet, idempotent tasks |
| Remote client setup, transport and tool list | MCP Hero / connection choices / tools | URL, OAuth SDK, custom-header SDK |
| Hosted/local distinction and access boundaries | MCP FAQ / access section | remote execution and owner checks; no local-only claim |

Information increment over a generic endpoint description: real same-document generate/edit/reopen/export, current wallet and task receipts, version conflicts against website changes, explicit supported formats. No unverified competitor comparison or customer/logo/efficiency claims.

## Responsibilities and copy

API: Hero starts the integration; output example proves editability; task scenarios explain where a process diagram belongs; revision/formats explain the handoff; budget explains the paid decision; FAQ owns image limits, language clients, secret handling and uncertain requests. Primary CTA: Create API key. Secondary: Quickstart. Full copy lives in `src/components/developer/api-landing.tsx`.

MCP: Hero provides endpoint and first request; connection choices distinguish OAuth, custom headers and scripts; same-file example proves the next conversational change; task scenarios/tool list explain use in a review; access section explains authority and spend; FAQ owns local-hosting distinction, client prerequisites and token revocation. Full copy lives in `src/components/developer/mcp-landing.tsx`.

Expected indexable content: API 800–1150 words; MCP 750–1100. Default-visible: API 500–850, MCP 500–850. Developer pages need useful setup detail, while complete parameter reference belongs in docs. Exact phrase (`flowchart API`, `flowchart MCP server`) is a diagnostic only, not an owner-approved density quota; H1/title/meta identify the demand. Count page-local content including closed FAQ answers for indexable content; exclude shared shell, metadata, JSON-LD and alt text. Report visible copy separately, excluding closed answers. Server-rendered HTML counts for the final build: API 809 indexable / 573 default-visible words; MCP 855 / 625. One H1 and five FAQ entries per page; correct canonical and formal asset URLs. Browser-rendered confirmation remains pending, so these counts are not visual acceptance.

Images: actual native output from this task; original six-node generation 01aa63ad-2a0f-4db4-9208-d27f190e95de and final natural-language revision a3102734-cf0b-4d98-bcb4-ac663fa52758. No generated illustration used as product evidence. PNG is exported by the actual website editor, then converted to WebP and uploaded to FlowchartAI R2. Each image appears once on its relevant page. Request code and tool grouping are live text; a separate conceptual raster image would add no necessary information.

## Acceptance evidence

Pending final same-version rendered checks: 390px, 1440px, 1920px; first visit; desktop/mobile API/MCP/Pricing destinations; menu keyboard/focus; images after scrolling; FAQ/schema consistency; developer empty/create/reveal/dismiss/revoke/rotate; consent approved/revoked. Earlier local cold compilation and later Ego runtime bootstrap caused navigation timeouts; those attempts are not recorded as completed checks. Production and browser client compatibility remain separate proof layers.
