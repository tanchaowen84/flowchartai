# FlowchartAI database cleanup V1

## Goal and boundary

Reduce the production Supabase database from the 2026-08-07 baseline of
662 MB to below the Free-plan 500 MB database-size limit, with a preferred
buffer of 450–480 MB.

V1 changes only:

- new Mermaid metadata writes;
- duplicated `customData.originalMermaid` in existing flowchart content;
- byte-exact abandoned pre-created flowcharts older than 30 days;
- sessions and verification records expired before the backup cutoff;
- standard `VACUUM (ANALYZE)`.

V1 does not move thumbnails/files, change account/id-token/AI-usage data,
migrate to D1, or automate `VACUUM FULL`.

## Invariants

- The application write fix is deployed and verified before backup or cleanup.
- A complete manifest is the only completion marker for a backup. Objects not
  listed by that manifest are ignored.
- `verification.json` must name the same manifest key and SHA-256 digest.
- A production mutation requires a backup and verification both younger than
  six hours.
- Migration preserves `id`, title, thumbnail, files, user, created time, and
  updated time. Only redundant `originalMermaid` fields are removed.
- Managed diagrams retain one carrier per `diagramId + exact source`.
- Legacy diagrams use the exact same grouping function as the runtime target
  resolver. The cleanup therefore cannot merge groups differently from the
  editor's existing recovery behavior.
- Every UPDATE uses `id + updated_at + exact before content` as an optimistic
  lock. Every strict-empty DELETE repeats the full candidate predicate.
- `updated_at` intentionally remains unchanged because the migration is a
  storage-only normalization with no user-visible diagram change. A live
  edit changes content and therefore fails the exact-content lock.

## Backup and restore gate

1. Read all seven `flowcharts` columns inside one `REPEATABLE READ READ ONLY`
   transaction, ordered by `id`.
2. Write 250-row NDJSON gzip shards locally. A failed/incomplete capture has no
   manifest and is never eligible for use.
3. Record per-row content/thumbnail/row hashes; per-shard raw/compressed sizes,
   hashes, and ID bounds; global ordered-ID hash; and a separate index.
4. Upload to the private, non-application R2 bucket under a unique backup ID.
   Upload `manifest.json` last.
5. Download every listed object from R2 and verify all hashes, row counts,
   index mappings, and the global ordered-ID hash.
6. Restore stratified small/middle/large rows, a thumbnail row, and several
   transformable rows into an `ON COMMIT DROP` temporary Postgres table. Read
   them back and compare hashes. Verify the cleanup transform is idempotent.
7. Only then write `verification.json` bound to the manifest digest.

## Execution gates

1. Run a read-only migration dry run.
2. Apply 20 rows in one transaction. Abort and roll back on any invalid row,
   backup mismatch, concurrent edit, failed lock, or semantic validation.
3. Verify affected diagrams open, can be Mermaid-edited, save successfully,
   and retain exactly one carrier without per-element duplication.
4. Repeat with 200 rows and the same checks.
5. Continue in transactions of at most 100 rows. The script hard-caps any
   transaction at 200 rows; no unbounded/full-table transaction exists.
6. Each successful transaction writes an R2 log before the next transaction.
   Stop globally on any failed batch. Run standard vacuum and remeasure between
   larger groups of batches so dead TOAST space can be reused.
7. Before every apply, provide the currently verified disk capacity. The tool
   checks current database size against a conservative per-batch rewrite
   headroom (`2 × after-content bytes + 64 MiB`). Dashboard disk headroom must
   also be checked before continuing past the 200-row canary.
8. If more than 5% of candidates drift from the backup, stop and create a new
   full backup and verification. Never bypass the index mismatch.

## Deletion and rollback

Strict empty means all of the following at delete time:

- `title = 'Untitled'`;
- `thumbnail IS NULL`;
- `created_at < backup_cutoff - interval '30 days'`;
- `updated_at = created_at`;
- content is byte-for-byte equal to the pre-creation empty JSON.

Every deleted flowchart ID is logged. It can be restored from the verified
backup only if the ID is still absent. Migration rollback restores exact backup
content only when live content still equals the logged `afterHash` and
`updated_at` is unchanged.

Expired sessions and verification codes are intentionally not backed up or
restored; the cutoff is frozen at backup time and their credentials are already
expired.

## Vacuum decision

Run only standard `VACUUM (ANALYZE)` in V1. It makes dead space reusable but may
not reduce the physical/database-size reading. If the final database remains
at or above 500 MB, stop. `VACUUM FULL` requires a separate decision after
checking a maintenance window, exclusive-lock impact, and enough temporary disk
for a table rewrite; it is deliberately absent from the cleanup tool.

## Abort conditions

Stop without advancing to the next phase if any of these occur:

- missing/incomplete manifest or any R2/hash/row-count mismatch;
- temporary restore or transform/idempotence failure;
- backup or verification older than six hours;
- invalid JSON, unexpected grouping, carrier count mismatch, or application
  open/edit/save failure;
- optimistic-lock failure or live/backup drift above 5%;
- insufficient disk headroom, database becoming read-only, elevated errors, or
  unexpected table/database growth.
