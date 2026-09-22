/** Backup-gated migration. Default: read-only dry run. See docs/flowchart-r2-storage-v1.md. */
import assert from 'node:assert/strict';
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import postgres from 'postgres';
import {
  assetDigest,
  externalizeFlowchartAssets,
  hydrateFlowchartContent,
  readAssetDataUrl,
} from '../src/lib/flowchart-assets';
import { createFlowchartAssetStore } from '../src/storage/flowchart-asset-store';
import {
  type BackupShardMeta,
  type FlowchartBackupRow,
  parseAndVerifyBackupShard,
} from './flowchart-db-cleanup-core';

const args = process.argv.slice(2);
function option(name: string, fallback = ''): string {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
}
const apply = args.includes('--apply');
const rollback = args.includes('--rollback');
const bucket = option('bucket', 'flowchart-ai-backups');
const manifestKey = option('manifest-key');
const limit = Number(option('limit', '20'));
const concurrency = Number(option('concurrency', '4'));
const output = resolve(option('output', '/tmp/flowchart-r2-migration'));
const sql = postgres(process.env.DATABASE_URL!, {
  prepare: false,
  max: concurrency,
  connect_timeout: 20,
  connection: { statement_timeout: 20000, lock_timeout: 3000 },
});
const s3 = new S3Client({
  endpoint: process.env.STORAGE_ENDPOINT,
  region: process.env.STORAGE_REGION || 'auto',
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY!,
  },
});
const store = createFlowchartAssetStore();
interface Manifest {
  status: string;
  createdAt: string;
  backupId: string;
  totals: { rows: number };
  rowIdsSha256: string;
  shards: (BackupShardMeta & { key: string })[];
}
interface Journal {
  id: string;
  userId: string;
  updatedAt: string;
  manifestSha256: string;
  beforeContentHash: string;
  beforeThumbnailHash: string;
  afterContentHash: string;
  afterThumbnailHash: string;
  afterContent: string;
  afterThumbnail: string | null;
}
async function getObject(key: string): Promise<Buffer> {
  const result = await s3.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!result.Body) throw new Error('Missing backup object');
  return Buffer.from(await result.Body.transformToByteArray());
}
async function putJournal(key: string, value: unknown): Promise<void> {
  const body = Buffer.from(JSON.stringify(value));
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
      Metadata: { sha256: assetDigest(body) },
    })
  );
  if (assetDigest(await getObject(key)) !== assetDigest(body))
    throw new Error('Journal readback mismatch');
}
function hashThumbnail(value: string | null): string {
  return assetDigest(JSON.stringify(value));
}
function equivalentContent(left: string, right: string): void {
  if (left === right) return;
  assert.deepEqual(JSON.parse(left), JSON.parse(right));
}
async function main(): Promise<void> {
  if (
    !manifestKey ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 8
  )
    throw new Error(
      'Require manifest-key, positive limit and concurrency 1..8'
    );
  if (
    bucket === process.env.STORAGE_BUCKET_NAME ||
    bucket === process.env.FLOWCHART_ASSET_BUCKET
  )
    throw new Error('Backup bucket must be separate');
  const manifestBody = await getObject(manifestKey);
  const manifestHash = assetDigest(manifestBody);
  const manifest = JSON.parse(manifestBody.toString()) as Manifest;
  const verification = JSON.parse(
    (
      await getObject(
        manifestKey.replace(/manifest\.json$/, 'verification.json')
      )
    ).toString()
  );
  if (
    manifest.status !== 'complete' ||
    verification.status !== 'passed' ||
    verification.manifestSha256 !== manifestHash ||
    verification.manifestKey !== manifestKey ||
    verification.verifiedRows !== manifest.totals.rows
  )
    throw new Error('Verified complete backup is required');
  const assertFresh = (): void => {
    if (!apply || rollback) return;
    for (const timestamp of [manifest.createdAt, verification.verifiedAt]) {
      const age = Date.now() - Date.parse(timestamp);
      if (!Number.isFinite(age) || age < 0 || age > 6 * 3600 * 1000)
        throw new Error('Backup freshness exceeded six hours');
    }
  };
  assertFresh();
  await mkdir(output, { recursive: true, mode: 0o700 });
  const journalPrefix = `${manifestKey.replace(/manifest\.json$/, '')}r2-migration-v1`;
  let candidates = 0;
  let migrated = 0;
  let unchanged = 0;
  let drifted = 0;
  let bytesSaved = 0;
  let stopped = false;
  let failure: unknown;

  async function processRow(row: FlowchartBackupRow): Promise<void> {
    const [current] =
      await sql`select id, user_id, content, thumbnail, updated_at::text as exact_updated_at from public.flowcharts where id=${row.id}`;
    if (!current) {
      drifted++;
      return;
    }
    const journalKey = `${journalPrefix}/${assetDigest(row.id)}.json`;
    if (rollback) {
      let record: Journal;
      try {
        record = JSON.parse((await getObject(journalKey)).toString());
      } catch (error) {
        if (
          error instanceof Error &&
          ['NoSuchKey', 'NotFound'].includes(error.name)
        ) {
          unchanged++;
          return;
        }
        throw error;
      }
      if (
        record.manifestSha256 !== manifestHash ||
        record.beforeContentHash !== assetDigest(row.content) ||
        record.beforeThumbnailHash !== hashThumbnail(row.thumbnail)
      )
        throw new Error('Rollback backup mismatch');
      if (
        assetDigest(current.content) !== record.afterContentHash ||
        hashThumbnail(current.thumbnail) !== record.afterThumbnailHash ||
        current.user_id !== row.userId ||
        current.exact_updated_at !== record.updatedAt
      ) {
        drifted++;
        return;
      }
      candidates++;
      if (!apply) return;
      const changed =
        await sql`update public.flowcharts set content=${row.content},thumbnail=${row.thumbnail} where id=${row.id} and user_id=${row.userId} and content=${current.content} and thumbnail is not distinct from ${current.thumbnail} and updated_at=${current.exact_updated_at}::timestamp returning id`;
      if (changed.length) migrated++;
      else drifted++;
      return;
    }
    // Resume accepts rows already converted under this same verified backup.
    if (
      current.content !== row.content ||
      current.thumbnail !== row.thumbnail ||
      current.user_id !== row.userId
    ) {
      if (current.user_id === row.userId) {
        try {
          const journal = JSON.parse(
            (await getObject(journalKey)).toString()
          ) as Journal;
          if (
            journal.manifestSha256 === manifestHash &&
            assetDigest(current.content) === journal.afterContentHash &&
            hashThumbnail(current.thumbnail) === journal.afterThumbnailHash &&
            current.exact_updated_at === journal.updatedAt
          ) {
            unchanged++;
            return;
          }
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !['NoSuchKey', 'NotFound'].includes(error.name)
          )
            throw error;
        }
      }
      drifted++;
      return;
    }
    const fields = { content: row.content, thumbnail: row.thumbnail };
    const transformed = await externalizeFlowchartAssets(
      row.userId,
      fields,
      apply
        ? store
        : {
            async put() {},
            async get() {
              throw new Error('Unexpected dry-run read');
            },
          }
    );
    if (
      transformed.content === fields.content &&
      transformed.thumbnail === fields.thumbnail
    ) {
      unchanged++;
      return;
    }
    candidates++;
    bytesSaved +=
      Buffer.byteLength(row.content) +
      Buffer.byteLength(row.thumbnail || '') -
      Buffer.byteLength(transformed.content!) -
      Buffer.byteLength(transformed.thumbnail || '');
    if (!apply) return;
    equivalentContent(
      await hydrateFlowchartContent(row.userId, transformed.content!, store),
      row.content
    );
    assert.equal(
      transformed.thumbnail === null
        ? null
        : await readAssetDataUrl(row.userId, transformed.thumbnail!, store),
      row.thumbnail
    );
    const record: Journal = {
      id: row.id,
      userId: row.userId,
      updatedAt: current.exact_updated_at,
      manifestSha256: manifestHash,
      beforeContentHash: assetDigest(row.content),
      beforeThumbnailHash: hashThumbnail(row.thumbnail),
      afterContentHash: assetDigest(transformed.content!),
      afterThumbnailHash: hashThumbnail(transformed.thumbnail ?? null),
      afterContent: transformed.content!,
      afterThumbnail: transformed.thumbnail ?? null,
    };
    // Intent is durable before SQL; exact after hashes allow crash recovery without relying on a receipt.
    await putJournal(journalKey, record);
    await appendFile(
      resolve(output, 'journal.jsonl'),
      `${JSON.stringify({ id: row.id, journalKey, beforeContentHash: record.beforeContentHash, afterContentHash: record.afterContentHash })}\n`,
      { mode: 0o600 }
    );
    assertFresh();
    const changed =
      await sql`update public.flowcharts set content=${transformed.content!},thumbnail=${transformed.thumbnail ?? null} where id=${row.id} and user_id=${row.userId} and content=${row.content} and thumbnail is not distinct from ${row.thumbnail} and updated_at=${current.exact_updated_at}::timestamp returning content,thumbnail,updated_at::text as exact_updated_at`;
    if (!changed.length) {
      drifted++;
      return;
    }
    assert.equal(assetDigest(changed[0].content), record.afterContentHash);
    assert.equal(
      hashThumbnail(changed[0].thumbnail),
      record.afterThumbnailHash
    );
    assert.equal(changed[0].exact_updated_at, record.updatedAt);
    migrated++;
  }

  outer: for (const shard of manifest.shards) {
    assertFresh();
    const rows = parseAndVerifyBackupShard(await getObject(shard.key), shard);
    // Only process potential image candidates; no transfer of unrelated user/account data.
    const possible = rows.filter(
      (row) =>
        row.thumbnail?.startsWith('data:image/') ||
        row.content.includes('data:image/') ||
        (rollback && (row.thumbnail || row.content.includes('files')))
    );
    for (let index = 0; index < possible.length; index += concurrency) {
      if (candidates >= limit || stopped) break outer;
      const batch = possible.slice(
        index,
        index + Math.min(concurrency, limit - candidates)
      );
      await Promise.all(
        batch.map(async (row) => {
          try {
            await processRow(row);
          } catch (error) {
            stopped = true;
            failure = error;
          }
        })
      );
      process.stdout.write(
        `${JSON.stringify({ candidates, migrated, unchanged, drifted, bytesSaved })}\n`
      );
      if (drifted > 10 && drifted / (candidates + unchanged + drifted) > 0.05) {
        stopped = true;
        failure = new Error('More than 5% drift: take a fresh backup');
      }
    }
  }
  const [sizes] =
    await sql`select pg_database_size(current_database()) as database_bytes,pg_total_relation_size('public.flowcharts') as flowcharts_bytes`;
  const report = {
    mode: rollback ? 'rollback' : apply ? 'apply' : 'dry-run',
    manifestHash,
    candidates,
    migrated,
    unchanged,
    drifted,
    bytesSaved,
    sizes,
    status: stopped ? 'failed' : 'complete',
    finishedAt: new Date().toISOString(),
  };
  await writeFile(
    resolve(output, `result-${Date.now()}.json`),
    JSON.stringify(report, null, 2),
    { mode: 0o600 }
  );
  console.log(JSON.stringify(report));
  if (failure) throw failure;
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'Migration failed');
    process.exitCode = 1;
  })
  .finally(() => sql.end());
