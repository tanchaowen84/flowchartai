# Flowchart R2 storage V1

SPEC: LOCKED by the user's 2026-09-22 approval of stage one.

## Goal
Move inline diagram files and thumbnails out of production PostgreSQL into private Cloudflare R2 while preserving diagrams and editor behavior. Production baseline: af48f56, database approximately 607 MiB.

## Constraints
Preserve diagram IDs, ownership, title, elements, metadata, timestamps and exact image data. No auth/token/usage cleanup. Never move private diagrams into the existing public application bucket. Do not fetch arbitrary URLs. Upload and verify objects before database references are committed. Existing inline and external URL data remains readable. Failed storage reads fail visibly rather than silently removing an image.

## Scope
Server-side image externalization and hydration, authenticated thumbnails, list projection without full content, verified backup, resumable optimistic migration and rollback, deployment and real acceptance. Preserve current complete-list search/sort behavior; pagination is deferred to avoid changing dashboard semantics in a storage migration. No automatic deletion of R2 objects during migration/rollback.

## Acceptance
- Round-trip exact canonical data URLs and all unrelated JSON fields; existing URL/legacy content remains unchanged.
- Reject cross-user or malformed storage references before R2 reads/writes.
- New writes store small references; upload failure cannot produce a broken DB record.
- Detail APIs hydrate legacy-compatible image content; list APIs omit full content; thumbnail reads authenticate ownership.
- Full backup is downloaded and hash-verified; a temporary-table restore succeeds before any historical mutation.
- Migration uses exact before content, thumbnail, user and timestamp compare-and-swap, durable per-row recovery records and bounded concurrency; drift is skipped.
- Read back every migrated row and verify image identity. Real create/open/edit/export and authorization checks pass on the deployed version.
- Measure actual database size after migration; plain VACUUM is not reported as physical shrink. Table rewrite requires a verified maintenance window/headroom.

## Technical context
Next.js 15 on Vercel, Drizzle/Postgres, Better Auth 1.1.19, AWS SDK S3; existing public R2 bucket `flowchart-ai`. Add FLOWCHART_ASSET_BUCKET for private objects. No schema migration is required. Browser: Ego Lite only. No subagents (user instruction).

## Plan / state
1. Isolate production checkout and inspect live storage configuration (done).
2. Unit RED, implement pure image transform and R2 adapter, integrate routes.
3. Test, typecheck, build, scoped lint, read-only code review.
4. Verify private bucket and full backup; deploy compatible runtime.
5. Test owned synthetic data; migrate 20-row and 200-row canaries, then bounded batches.
6. Verify all results, database capacity, deployment and rollback artifacts.

GROK_RESEARCH_UNAVAILABLE: requested grok-4.5 in a read-only PTY; Grok Build reported "You hit your weekly limit". No review result claimed. Main agent owns all implementation and review.

## Implementation decisions
- Retain the existing `files[id].dataURL` string contract at the editor boundary. PostgreSQL stores a versioned private reference; the authenticated detail endpoint reconstructs the original data URL. This preserves image rendering and export, including already-open clients saving legacy inline data.
- R2 stores binary bytes at owner-SHA256/content-SHA256 keys. Uploads are read back and checked. Existing external URLs are not fetched or altered.
- Thumbnails use an owner-authorized endpoint with no shared caching, nosniff and a sandbox CSP. The existing public media bucket remains unchanged.
- Migration stores a private, downloaded-and-verified per-row intent before updating SQL. Exact current content, thumbnail, owner and microsecond timestamp form the compare-and-swap. A crash can be reconciled from the intended after hashes. No migration changes diagram timestamps.
- Keep both readers available during rollout. After migration, rolling back to af48f56 requires restoring migrated rows first; do not point the old runtime at R2 references.
- Image data is only garbage-collected after a separate retention/rollback decision; this migration never deletes R2 assets.

## Verification so far
- Full test suite: 36 files / 173 tests PASS.
- Production build PASS. Typecheck PASS after generating content collections. Scoped Biome PASS.
- Real local HTTP + production R2 + isolated QA DB rows: create/edit/reopen, byte-exact image/thumbnail readback, metadata, list projection, anonymous 401 and cross-user 404 PASS.
- Ego Lite visually opened the R2-backed QA diagram successfully.
- `flowchart-ai-private` created in existing R2 account; public development URL disabled, no custom domain. Existing `flowchart-ai-backups` is also private. Existing application credentials can access both.
- Added Vercel production `FLOWCHART_ASSET_BUCKET=flowchart-ai-private` (takes effect with next deployment).

Current stage: full backup in progress, preparing deployment and migration canaries. Only isolated QA records were created; historical customer records are unchanged.
