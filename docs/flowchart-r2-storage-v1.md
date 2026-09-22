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
Next.js 15 on Vercel, Drizzle/Postgres, Better Auth 1.1.19, AWS SDK S3; existing public R2 bucket `flowchart-ai`. Add FLOWCHART_ASSET_BUCKET for private objects. No schema migration is required. Browser: Ego Lite for product QA; Chrome dashboard access explicitly authorized by the user after local GitHub credentials returned HTTP 401. No subagents (user instruction).

## Completed steps
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
- Keep both readers available during rollout. Use an R2-compatible deployment for runtime rollback (`9c027f4`, deployment `dpl_AgcwmwtG7ThwbzjEcC5KafYAD564`, is retained). Do not point `af48f56` or another old reader at R2 references: this would require hydrating every current reference first, including newly created/edited data that is not covered by the historical backup. The guarded historical rollback intentionally skips subsequent user edits.
- Image data is only garbage-collected after a separate retention/rollback decision; this migration never deletes R2 assets.

## Verification
- Final full test suite: 38 files / 177 tests PASS (including thumbnail image regression and bounded transport retries).
- Production build PASS. Typecheck PASS after generating content collections. Scoped Biome PASS.
- Real local HTTP + production R2 + isolated QA DB rows: create/edit/reopen, byte-exact image/thumbnail readback, metadata, list projection, anonymous 401 and cross-user 404 PASS.
- Ego Lite visually opened the R2-backed QA diagram successfully.
- `flowchart-ai-private` created in existing R2 account; public development URL disabled, no custom domain. Existing `flowchart-ai-backups` is also private. Existing application credentials can access both.
- Added Vercel production `FLOWCHART_ASSET_BUCKET=flowchart-ai-private`; verified on the deployed runtime.

## Production operations (2026-09-22)
- Initial R2 runtime: `9c027f4`, deployment `dpl_AgcwmwtG7ThwbzjEcC5KafYAD564`. Current runtime: `22971dc`, deployment `dpl_RtVFy8ae2ZjHyNBG7fz1AaXrYt6c`, promoted to `flowchartai.org` with the thumbnail fix. Both local `vercel build --prod` and prebuilt deployments succeeded; the earlier stalled remote build was cancelled before promotion.
- Production HTTP acceptance PASS: create, private references, exact image bytes, metadata, lightweight list, authenticated thumbnail, anonymous 401, cross-owner 404, edit and reopen. Ego Lite also verified canvas edit/save/reload, PNG export containing the image, and dashboard thumbnail rendering.
- Full backup: private `flowchart-ai-backups/flowchartai/r2-storage-v1-2026-09-22/manifest.json`; 14,171 records, 57 shards, 807,406,994 raw bytes, 260,657,099 compressed bytes. All shards downloaded and SHA256 checked; 9 temporary-table restores passed. Verification manifest hash: `290124312306b5ca9b5e557cf56aeab6051c20d0d14dc86c5991aebbcf7eb963`.
- Added `exact-timestamps.json` in the same private prefix, with pre-migration microsecond timestamps and content/thumbnail MD5 pairing hashes for 14,174 current records. Downloaded SHA256: `ef0cf3757e43507d9c281fd3eba43f47e6e07a3902f62220b106e012d3d32ab7`. The base backup serializes dates to milliseconds; this supplement and per-migrated-row journals retain exact times. Migration/rollback do not write timestamps.
- Offline snapshot analysis: 8,737 image-bearing records, 251,371,290 raw bytes removable, no unsupported inline image data left after transformation. These are logical estimates, not physical disk space reclaimed.
- Canary found postgres-js timestamp parameter serialization truncating microseconds: 12 guarded updates were rejected, zero records changed. Fixed by binding as `::text::timestamp`; a real temporary-table regression reproduced the old failure, verified all six fractional digits, and rejected stale content.
- SQL compares and returns SHA256 hashes instead of downloading complete documents again. Thumbnail-only changes keep the existing content/TOAST value. Batches advance by the actual submitted size.
- Corrected 20-record canary: PASS, 20 migrated, zero drift. Guarded rollback drill: PASS, all 20 restored, zero drift.
- The 200-record canary completed as 186 + 14 after a transient R2 TLS failure. Resume correctly recognized 186 completed records. Transport-only retries were added and tested; authorization/integrity failures are not retried. Full migration uses up to 32 R2 operations with a separate four-connection PostgreSQL pool.
- Visual follow-up found an existing thumbnail bug: `exportToCanvas` was given `files: null`. Commit `22971dc` passes the current canvas image files; a regression test failed before the fix and passed afterward. Existing thumbnail bytes are preserved by the migration; corrected thumbnails are generated on subsequent saves.
- The thumbnail fix passed a production visual check: saving the R2-backed QA canvas now produces a dashboard thumbnail showing the actual image. Evidence: `production-dashboard-fixed.png`; the adjacent older QA thumbnail retains its original placeholder until saved again.

Artifacts and operation logs: `/Users/tcw/Documents/Codex/FlowchartAI-R2-2026-09-22/` (private directory containing customer backups; do not share its contents). Synthetic QA users, sessions and diagrams were removed, and the local QA credential file was deleted.

Current stage: COMPLETE. Production runtime, historical migration, physical space reclamation, provider quota readback and post-maintenance acceptance all verified.

## Live provider verification before maintenance
- Chrome reused an existing Supabase login. Free plan, grace period ended 2026-09-09. The organization dashboard reports database capacity as the exceeded quota; egress is 0.882 / 5 GB, other listed usage is within its allowance. Database card: 622.34 MiB, quota 0.5 GB. Dashboard refresh may lag by up to one hour.
- Infrastructure dashboard reports **8 GB provisioned disk, 0.90 GB used**, WAL 128 MiB, system 167.6 MiB. This measured physical headroom permits a bounded rewrite of the flowcharts table; the free database allowance remains 0.5 GB. No plan or disk setting was changed.
- Both private buckets only have the default rule aborting incomplete multipart uploads after seven days; completed backups and assets do not expire automatically.
- Current production commit `22971dc` passed HTTP acceptance again during migration (create/edit/readback/list/thumbnail/authorization).

## Final completion evidence
- Historical image migration: **8,737 records completed**. The full run migrated 8,536 records plus the 200-record canary. One snapshot record had a legitimate subsequent edit and was skipped; its latest version was separately backed up, downloaded/hash-verified, restored into a temporary table, and migrated with exact content/owner/timestamp compare-and-swap. Its new thumbnail and all microsecond timestamps were preserved. Delta backup, guarded rollback intent and receipt are under the same private backup prefix in `delta/`.
- Full snapshot consistency after maintenance: **14,171 checked; 14,170 exact expected content/thumbnail/metadata matches; one legitimate subsequent edit; zero missing records and zero unexplained mismatches**. The edited record has its independent delta verification. Every migrated image was verified on R2 readback before SQL mutation.
- Final live database after QA cleanup: **14,184 diagrams, zero inline image documents and zero inline thumbnails**, 8,745 R2 thumbnails and 259 image-containing R2 documents. Extra records are live creations since the snapshot. Phase one did not delete any real diagram, user, account or session.
- Ordinary VACUUM ANALYZE completed in 3.7 seconds and reduced the business database from 637,922,451 to 604,253,331 bytes. The initial 20-second VACUUM FULL timed out and rolled back. After confirming writability and no active client transactions, a session-mode maintenance connection with a one-second lock timeout and 60-second statement timeout completed VACUUM FULL ANALYZE in **26.9 seconds**, preserving all 14,186 then-present records (including QA data).
- Physical size after maintenance: business database **308,989,075 bytes**; all project databases **324,055,217 bytes**; flowcharts table including TOAST/indexes **128,311,296 bytes**. Investigation baselines were respectively 636,193,939, 651,260,081 and 455,606,272 bytes. All-project database capacity dropped about **50%**, with growth during execution included.
- Authenticated Supabase dashboard refreshed to **0.324 / 0.5 GB (65%)**, and the specific database quota exceeded warning disappeared. The generic notice that the old grace period ended remains; it is not a current over-quota reading. Egress remains **0.882 / 5 GB**. No paid plan or disk configuration was changed.
- Post-maintenance production HTTP acceptance PASS on `flowchartai.org`: create, byte-exact files/thumbnail, private references, metadata, list projection, unauthorized 401, cross-owner 404, edit and reopen. The same released runtime also passed visual canvas edit/save/reload/export and corrected-thumbnail checks before maintenance.
- Eight non-QA new user records were observed after the initial R2 release while migration ran. This is evidence of live registration writes, not a claim that the entire OAuth signup UI was manually exercised.
- Synthetic QA rows and session credentials cleaned up; R2 test objects are retained under the no-object-deletion rule. The original dirty checkout remains untouched. Git branch: `codex/flowchart-r2-storage-v1`; production runtime commit: `22971dc`.

Remaining growth work is outside this phase: pagination without changing dashboard search/sort semantics, retention/garbage collection for unreferenced R2 objects, and separate auth-token footprint analysis. Keep verified backups and the R2-compatible rollback runtime until an explicit retention decision.
