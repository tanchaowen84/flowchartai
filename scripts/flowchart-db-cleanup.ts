#!/usr/bin/env tsx

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import postgres, { type Sql } from 'postgres';
import { compactFlowchartContent } from '../src/lib/flowchart-content-cleanup';
import {
  type BackupShardMeta,
  type FlowchartBackupRow,
  createBackupShard,
  parseAndVerifyBackupShard,
  sha256,
} from './flowchart-db-cleanup-core';

const EMPTY_PRECREATED_CONTENT = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  source: 'https://excalidraw.com',
  elements: [],
  appState: { gridSize: null, viewBackgroundColor: '#ffffff' },
});

interface ObjectMeta {
  key: string;
  bytes: number;
  sha256: string;
}

interface ManifestShard extends BackupShardMeta {
  index: number;
  key: string;
}

interface BackupIndexRow {
  id: string;
  updatedAt: string;
  contentSha256: string;
  contentBytes: number;
  shardKey: string;
}

interface BackupManifest {
  schemaVersion: 1;
  status: 'complete';
  backupId: string;
  createdAt: string;
  source: {
    table: 'public.flowcharts';
    columns: string[];
    transactionIsolation: string;
    cutoffAt: string;
    databaseSizeBytes: number;
    flowchartsTableBytes: number;
  };
  totals: {
    rows: number;
    rawBytes: number;
    compressedBytes: number;
  };
  rowIdsSha256: string;
  index: ObjectMeta;
  shards: ManifestShard[];
}

interface VerificationRecord {
  schemaVersion: 1;
  status: 'passed';
  backupId: string;
  manifestKey: string;
  manifestSha256: string;
  verifiedAt: string;
  verifiedShards: number;
  verifiedRows: number;
  sampleRestoreRows: string[];
  transformVerifiedRows: string[];
}

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = 'help', ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--'))
      throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return { command, args };
}

function stringArg(args: Args, name: string, required = true): string {
  const value = args[name];
  if (typeof value === 'string' && value.length > 0) return value;
  if (!required) return '';
  throw new Error(`Missing --${name}`);
}

function numberArg(args: Args, name: string, fallback: number): number {
  const raw = args[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return value;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function auditContext(): { operator: string; gitSha: string } {
  return {
    operator: env('FLOWCHART_CLEANUP_OPERATOR'),
    gitSha: env('FLOWCHART_CLEANUP_GIT_SHA'),
  };
}

function database(): Sql {
  return postgres(env('DATABASE_URL'), {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 20,
    prepare: false,
  });
}

function backupBucket(args: Args): string {
  const bucket =
    stringArg(args, 'bucket', false) || env('FLOWCHART_BACKUP_BUCKET');
  if (bucket === process.env.STORAGE_BUCKET_NAME) {
    throw new Error('Backup bucket must not be the public application bucket');
  }
  if (!bucket.toLowerCase().includes('backup')) {
    throw new Error('Backup bucket name must visibly contain "backup"');
  }
  return bucket;
}

function r2(): S3Client {
  return new S3Client({
    endpoint: env('STORAGE_ENDPOINT'),
    region: process.env.STORAGE_REGION || 'auto',
    credentials: {
      accessKeyId: env('STORAGE_ACCESS_KEY_ID'),
      secretAccessKey: env('STORAGE_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime()))
    throw new Error(`Invalid timestamp: ${value}`);
  return date.toISOString();
}

function asNumber(value: unknown): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Invalid non-negative integer: ${value}`);
  }
  return number;
}

function backupId(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function putObject(
  client: S3Client,
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ChecksumSHA256: Buffer.from(sha256(body), 'hex').toString('base64'),
    })
  );
  const head = await client.send(
    new HeadObjectCommand({ Bucket: bucket, Key: key })
  );
  if (Number(head.ContentLength) !== body.byteLength) {
    throw new Error(`R2 ContentLength mismatch after upload: ${key}`);
  }
}

async function getObjectBuffer(
  client: S3Client,
  bucket: string,
  key: string
): Promise<Buffer> {
  const object = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!object.Body) throw new Error(`R2 object body missing: ${key}`);
  return Buffer.from(await object.Body.transformToByteArray());
}

function rowFromDatabase(row: Record<string, unknown>): FlowchartBackupRow {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    thumbnail: row.thumbnail === null ? null : String(row.thumbnail),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
    userId: String(row.user_id),
  };
}

async function baseline(): Promise<void> {
  const sql = database();
  try {
    const [row] = await sql`
      select
        pg_database_size(current_database())::bigint as database_bytes,
        pg_total_relation_size('public.flowcharts')::bigint as flowcharts_bytes,
        (select count(*)::bigint from public.flowcharts) as flowcharts_rows,
        (select count(*)::bigint from public.flowcharts where content like '%"originalMermaid"%') as source_rows,
        (select count(*)::bigint from public.session where expires_at < now()) as expired_sessions,
        (select count(*)::bigint from public.verification where expires_at < now()) as expired_verifications,
        current_setting('transaction_read_only') as transaction_read_only
    `;
    process.stdout.write(`${JSON.stringify(row, null, 2)}\n`);
  } finally {
    await sql.end();
  }
}

async function backup(args: Args): Promise<void> {
  const outputDir = resolve(stringArg(args, 'output'));
  const batchSize = numberArg(args, 'batch-size', 250);
  const id = stringArg(args, 'backup-id', false) || backupId();
  const prefix = stringArg(args, 'prefix', false) || `flowchartai/${id}`;
  const bucket = backupBucket(args);
  const client = r2();
  const sql = database();
  const shards: ManifestShard[] = [];
  const indexRows: BackupIndexRow[] = [];
  const rowIdsHash = createHash('sha256');
  let source: BackupManifest['source'] | null = null;
  let totalRows = 0;
  let totalRawBytes = 0;
  let totalCompressedBytes = 0;

  await mkdir(outputDir, { recursive: true });
  await client.send(new HeadBucketCommand({ Bucket: bucket }));

  try {
    await sql.begin('isolation level repeatable read read only', async (tx) => {
      const [snapshot] = await tx`
        select
          now() as cutoff_at,
          current_setting('transaction_isolation') as isolation,
          pg_database_size(current_database())::bigint as database_bytes,
          pg_total_relation_size('public.flowcharts')::bigint as flowcharts_bytes,
          (select count(*)::bigint from public.flowcharts) as row_count
      `;
      source = {
        table: 'public.flowcharts',
        columns: [
          'id',
          'title',
          'content',
          'thumbnail',
          'created_at',
          'updated_at',
          'user_id',
        ],
        transactionIsolation: String(snapshot.isolation),
        cutoffAt: asIso(snapshot.cutoff_at),
        databaseSizeBytes: asNumber(snapshot.database_bytes),
        flowchartsTableBytes: asNumber(snapshot.flowcharts_bytes),
      };

      let cursor = '';
      let shardIndex = 0;
      while (true) {
        const result = await tx`
          select id, title, content, thumbnail, created_at, updated_at, user_id
          from public.flowcharts
          where id > ${cursor}
          order by id
          limit ${batchSize}
        `;
        if (result.length === 0) break;
        const rows = result.map(rowFromDatabase);
        const shard = createBackupShard(rows);
        const fileName = `flowcharts-${String(shardIndex).padStart(5, '0')}.ndjson.gz`;
        const key = `${prefix}/shards/${fileName}`;
        await writeFile(resolve(outputDir, fileName), shard.compressed, {
          flag: 'wx',
        });
        const meta: ManifestShard = { index: shardIndex, key, ...shard.meta };
        shards.push(meta);
        totalRows += rows.length;
        totalRawBytes += meta.rawBytes;
        totalCompressedBytes += meta.compressedBytes;
        for (const row of rows) {
          rowIdsHash.update(`${row.id}\n`);
          indexRows.push({
            id: row.id,
            updatedAt: row.updatedAt,
            contentSha256: sha256(row.content),
            contentBytes: Buffer.byteLength(row.content, 'utf8'),
            shardKey: key,
          });
        }
        cursor = rows.at(-1)?.id || cursor;
        shardIndex += 1;
        process.stdout.write(
          `captured shard=${shardIndex} rows=${totalRows}\n`
        );
      }
      if (totalRows !== asNumber(snapshot.row_count)) {
        throw new Error(
          `Snapshot row count mismatch: expected ${snapshot.row_count}, got ${totalRows}`
        );
      }
    });
  } finally {
    await sql.end();
  }

  if (!source) throw new Error('Backup snapshot metadata was not captured');
  const indexRaw = Buffer.from(
    `${indexRows.map((row) => JSON.stringify(row)).join('\n')}\n`,
    'utf8'
  );
  const indexBody = gzipSync(indexRaw, { level: 9 });
  const indexKey = `${prefix}/flowcharts-index.ndjson.gz`;
  const manifest: BackupManifest = {
    schemaVersion: 1,
    status: 'complete',
    backupId: id,
    createdAt: new Date().toISOString(),
    source,
    totals: {
      rows: totalRows,
      rawBytes: totalRawBytes,
      compressedBytes: totalCompressedBytes,
    },
    rowIdsSha256: rowIdsHash.digest('hex'),
    index: {
      key: indexKey,
      bytes: indexBody.byteLength,
      sha256: sha256(indexBody),
    },
    shards,
  };
  const manifestBody = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const manifestKey = `${prefix}/manifest.json`;
  await writeFile(resolve(outputDir, 'flowcharts-index.ndjson.gz'), indexBody, {
    flag: 'wx',
  });
  await writeFile(resolve(outputDir, 'manifest.json'), manifestBody, {
    flag: 'wx',
  });

  for (const shard of shards) {
    const body = await readFile(resolve(outputDir, basename(shard.key)));
    await putObject(client, bucket, shard.key, body, 'application/gzip');
    process.stdout.write(`uploaded ${shard.key}\n`);
  }
  await putObject(client, bucket, indexKey, indexBody, 'application/gzip');
  // Manifest is deliberately uploaded last; its presence marks a complete backup.
  await putObject(
    client,
    bucket,
    manifestKey,
    manifestBody,
    'application/json'
  );
  process.stdout.write(
    `${JSON.stringify({ status: 'complete', bucket, manifestKey, ...manifest.totals })}\n`
  );
}

function parseManifest(body: Buffer): BackupManifest {
  const manifest = JSON.parse(body.toString('utf8')) as BackupManifest;
  if (
    manifest.schemaVersion !== 1 ||
    manifest.status !== 'complete' ||
    !Array.isArray(manifest.shards)
  ) {
    throw new Error('Unsupported or incomplete backup manifest');
  }
  return manifest;
}

function parseIndex(body: Buffer, meta: ObjectMeta): BackupIndexRow[] {
  if (body.byteLength !== meta.bytes || sha256(body) !== meta.sha256) {
    throw new Error('Backup index checksum mismatch');
  }
  return gunzipSync(body)
    .toString('utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as BackupIndexRow);
}

async function verifyBackup(args: Args): Promise<void> {
  const bucket = backupBucket(args);
  const manifestKey = stringArg(args, 'manifest-key');
  const client = r2();
  const manifestBody = await getObjectBuffer(client, bucket, manifestKey);
  const manifest = parseManifest(manifestBody);
  const indexRows = parseIndex(
    await getObjectBuffer(client, bucket, manifest.index.key),
    manifest.index
  );
  const indexById = new Map(indexRows.map((row) => [row.id, row]));
  const targetSampleIds = new Set(
    [0, 0.25, 0.5, 0.75, 1]
      .map((ratio) => indexRows[Math.floor((indexRows.length - 1) * ratio)]?.id)
      .filter((id): id is string => Boolean(id))
  );
  const rowIdsHash = createHash('sha256');
  const samples = new Map<string, FlowchartBackupRow>();
  const transformSamples = new Map<string, FlowchartBackupRow>();
  let verifiedRows = 0;
  let largest: FlowchartBackupRow | null = null;
  let largestTransform: FlowchartBackupRow | null = null;
  let thumbnailSample: FlowchartBackupRow | null = null;

  for (const shardMeta of manifest.shards) {
    const body = await getObjectBuffer(client, bucket, shardMeta.key);
    const rows = parseAndVerifyBackupShard(body, shardMeta);
    for (const row of rows) {
      const index = indexById.get(row.id);
      if (
        !index ||
        index.shardKey !== shardMeta.key ||
        index.contentSha256 !== sha256(row.content)
      ) {
        throw new Error(`Backup index row mismatch: ${row.id}`);
      }
      rowIdsHash.update(`${row.id}\n`);
      if (!largest || row.content.length > largest.content.length)
        largest = row;
      if (!thumbnailSample && row.thumbnail) thumbnailSample = row;
      if (targetSampleIds.has(row.id)) samples.set(row.id, row);
      const transformed = compactFlowchartContent(row.content);
      if (transformed.status === 'changed') {
        if (transformSamples.size < 3) transformSamples.set(row.id, row);
        if (
          !largestTransform ||
          row.content.length > largestTransform.content.length
        ) {
          largestTransform = row;
        }
      }
    }
    verifiedRows += rows.length;
    process.stdout.write(`verified ${shardMeta.key} rows=${verifiedRows}\n`);
  }
  if (
    verifiedRows !== manifest.totals.rows ||
    indexRows.length !== verifiedRows ||
    rowIdsHash.digest('hex') !== manifest.rowIdsSha256
  ) {
    throw new Error('Full backup completeness verification failed');
  }
  if (largest) samples.set(largest.id, largest);
  if (thumbnailSample) samples.set(thumbnailSample.id, thumbnailSample);
  if (largestTransform)
    transformSamples.set(largestTransform.id, largestTransform);
  for (const [id, row] of transformSamples) samples.set(id, row);
  const uniqueSamples = [...samples.values()];
  const sql = database();
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(`
        create temporary table flowchart_restore_check (
          id text primary key,
          title text not null,
          content text not null,
          thumbnail text,
          created_at timestamptz not null,
          updated_at timestamptz not null,
          user_id text not null
        ) on commit drop
      `);
      for (const row of uniqueSamples) {
        await tx`
          insert into flowchart_restore_check
            (id, title, content, thumbnail, created_at, updated_at, user_id)
          values
            (${row.id}, ${row.title}, ${row.content}, ${row.thumbnail},
             ${row.createdAt}, ${row.updatedAt}, ${row.userId})
        `;
      }
      const restored = await tx`
        select id, content from flowchart_restore_check order by id
      `;
      for (const row of restored) {
        const expected = uniqueSamples.find((sample) => sample.id === row.id);
        if (
          !expected ||
          sha256(String(row.content)) !== sha256(expected.content)
        ) {
          throw new Error(`Temporary restore mismatch: ${row.id}`);
        }
      }
      for (const row of transformSamples.values()) {
        const transformed = compactFlowchartContent(row.content);
        if (transformed.status !== 'changed') {
          throw new Error(`Expected transformable restore sample: ${row.id}`);
        }
        const secondPass = compactFlowchartContent(transformed.content);
        if (secondPass.status !== 'unchanged') {
          throw new Error(
            `Transform is not idempotent for restored row: ${row.id}`
          );
        }
      }
    });
  } finally {
    await sql.end();
  }

  const verification: VerificationRecord = {
    schemaVersion: 1,
    status: 'passed',
    backupId: manifest.backupId,
    manifestKey,
    manifestSha256: sha256(manifestBody),
    verifiedAt: new Date().toISOString(),
    verifiedShards: manifest.shards.length,
    verifiedRows,
    sampleRestoreRows: uniqueSamples.map((row) => row.id),
    transformVerifiedRows: [...transformSamples.keys()],
  };
  const verificationKey = `${manifestKey.slice(0, -'manifest.json'.length)}verification.json`;
  await putObject(
    client,
    bucket,
    verificationKey,
    Buffer.from(`${JSON.stringify(verification, null, 2)}\n`),
    'application/json'
  );
  process.stdout.write(
    `${JSON.stringify({ verificationKey, ...verification })}\n`
  );
}

async function verifiedBackup(
  args: Args,
  requireFresh = false
): Promise<{
  client: S3Client;
  bucket: string;
  manifest: BackupManifest;
  indexById: Map<string, BackupIndexRow>;
}> {
  const bucket = backupBucket(args);
  const manifestKey = stringArg(args, 'manifest-key');
  const verificationKey = stringArg(args, 'verification-key');
  const client = r2();
  const manifestBody = await getObjectBuffer(client, bucket, manifestKey);
  const manifest = parseManifest(manifestBody);
  const verification = JSON.parse(
    (await getObjectBuffer(client, bucket, verificationKey)).toString('utf8')
  ) as VerificationRecord;
  if (
    verification.status !== 'passed' ||
    verification.backupId !== manifest.backupId ||
    verification.manifestKey !== manifestKey ||
    verification.manifestSha256 !== sha256(manifestBody)
  ) {
    throw new Error('Backup verification record does not match manifest');
  }
  if (requireFresh) {
    const verificationAgeMs =
      Date.now() - new Date(verification.verifiedAt).getTime();
    const backupAgeMs = Date.now() - new Date(manifest.createdAt).getTime();
    const maxAgeMs = 6 * 60 * 60 * 1_000;
    if (
      !Number.isFinite(verificationAgeMs) ||
      !Number.isFinite(backupAgeMs) ||
      verificationAgeMs < 0 ||
      backupAgeMs < 0 ||
      verificationAgeMs > maxAgeMs ||
      backupAgeMs > maxAgeMs
    ) {
      throw new Error(
        'Backup or verification is older than the 6-hour mutation SLA'
      );
    }
  }
  const indexRows = parseIndex(
    await getObjectBuffer(client, bucket, manifest.index.key),
    manifest.index
  );
  return {
    client,
    bucket,
    manifest,
    indexById: new Map(indexRows.map((row) => [row.id, row])),
  };
}

async function restoreRowsByIds(
  verified: Awaited<ReturnType<typeof verifiedBackup>>,
  ids: string[]
): Promise<Map<string, FlowchartBackupRow>> {
  const wanted = new Set(ids);
  const shardKeys = new Set<string>();
  for (const id of wanted) {
    const index = verified.indexById.get(id);
    if (!index) throw new Error(`Backup index does not contain ${id}`);
    shardKeys.add(index.shardKey);
  }
  const shardMetaByKey = new Map(
    verified.manifest.shards.map((shard) => [shard.key, shard])
  );
  const restored = new Map<string, FlowchartBackupRow>();
  for (const key of shardKeys) {
    const meta = shardMetaByKey.get(key);
    if (!meta) throw new Error(`Manifest does not contain shard ${key}`);
    const rows = parseAndVerifyBackupShard(
      await getObjectBuffer(verified.client, verified.bucket, key),
      meta
    );
    for (const row of rows) {
      if (wanted.has(row.id)) restored.set(row.id, row);
    }
  }
  if (restored.size !== wanted.size) {
    throw new Error(
      `Only restored ${restored.size}/${wanted.size} requested rows`
    );
  }
  return restored;
}

async function migrate(args: Args): Promise<void> {
  const apply = args.apply === true;
  const audit = apply ? auditContext() : null;
  const limit = numberArg(args, 'limit', 20);
  if (apply && limit > 200) {
    throw new Error('Each production transaction is capped at 200 rows');
  }
  const verified = await verifiedBackup(args, apply);
  const sql = database();
  const changes: Array<{
    id: string;
    updatedAt: string;
    beforeContent: string;
    afterContent: string;
    beforeHash: string;
    afterHash: string;
    removedSourceCopies: number;
    savedBytes: number;
  }> = [];
  let cursor = '';
  let invalid = 0;
  let changedAfterBackup = 0;

  try {
    while (changes.length < limit) {
      const rows = await sql`
        select id, content, updated_at
        from public.flowcharts
        where id > ${cursor}
          and content like '%"originalMermaid"%"originalMermaid"%'
        order by id
        limit 100
      `;
      if (rows.length === 0) break;
      for (const row of rows) {
        cursor = String(row.id);
        const content = String(row.content);
        const result = compactFlowchartContent(content);
        if (result.status === 'invalid') {
          invalid += 1;
          continue;
        }
        if (result.status !== 'changed') continue;
        const index = verified.indexById.get(String(row.id));
        const currentHash = sha256(content);
        if (
          !index ||
          index.contentSha256 !== currentHash ||
          index.updatedAt !== asIso(row.updated_at)
        ) {
          changedAfterBackup += 1;
          continue;
        }
        changes.push({
          id: String(row.id),
          updatedAt: asIso(row.updated_at),
          beforeContent: content,
          afterContent: result.content,
          beforeHash: currentHash,
          afterHash: sha256(result.content),
          removedSourceCopies: result.removedSourceCopies,
          savedBytes: result.beforeBytes - result.afterBytes,
        });
        if (changes.length >= limit) break;
      }
    }

    if (invalid > 0)
      throw new Error(`Abort: ${invalid} invalid candidate rows`);
    if (!apply) {
      process.stdout.write(
        `${JSON.stringify({ mode: 'dry-run', candidates: changes.length, changedAfterBackup, estimatedSavedBytes: changes.reduce((sum, row) => sum + row.savedBytes, 0) }, null, 2)}\n`
      );
      return;
    }
    if (changes.length === 0)
      throw new Error('No backed-up migration candidates found');
    if (changedAfterBackup > 0) {
      throw new Error(
        `Canary abort: ${changedAfterBackup} candidate rows changed after backup`
      );
    }

    const diskCapacityBytes = Number(stringArg(args, 'disk-capacity-bytes'));
    if (!Number.isSafeInteger(diskCapacityBytes) || diskCapacityBytes <= 0) {
      throw new Error('--disk-capacity-bytes must be a positive integer');
    }
    const [size] = await sql`
      select pg_database_size(current_database())::bigint as database_bytes
    `;
    const databaseBytes = asNumber(size.database_bytes);
    const batchAfterBytes = changes.reduce(
      (sum, change) => sum + Buffer.byteLength(change.afterContent, 'utf8'),
      0
    );
    const requiredHeadroomBytes = batchAfterBytes * 2 + 64 * 1_024 * 1_024;
    if (diskCapacityBytes - databaseBytes < requiredHeadroomBytes) {
      throw new Error(
        `Insufficient migration headroom: have ${diskCapacityBytes - databaseBytes}, require ${requiredHeadroomBytes}`
      );
    }

    await sql.begin(async (tx) => {
      const updateRows = changes.map((change) => [
        change.id,
        change.beforeContent,
        change.afterContent,
      ]);
      const updated = await tx`
        update public.flowcharts as flowchart
        set content = update_data.after_content
        from (values ${tx(updateRows)})
          as update_data (id, before_content, after_content)
        where flowchart.id = update_data.id
          and flowchart.content = update_data.before_content
        returning flowchart.id
      `;
      if (updated.length !== changes.length) {
        throw new Error(
          `Optimistic lock failed: updated ${updated.length}/${changes.length} rows`
        );
      }
    });

    const log = {
      schemaVersion: 1,
      operation: 'compact-original-mermaid',
      appliedAt: new Date().toISOString(),
      ...audit,
      backupId: verified.manifest.backupId,
      rows: changes.map(
        ({ beforeContent: _before, afterContent: _after, ...row }) => row
      ),
      totals: {
        rows: changes.length,
        removedSourceCopies: changes.reduce(
          (sum, row) => sum + row.removedSourceCopies,
          0
        ),
        estimatedSavedBytes: changes.reduce(
          (sum, row) => sum + row.savedBytes,
          0
        ),
      },
    };
    const logKey = `${stringArg(args, 'manifest-key').replace(/manifest\.json$/, '')}logs/migrate-${Date.now()}.json`;
    await putObject(
      verified.client,
      verified.bucket,
      logKey,
      Buffer.from(`${JSON.stringify(log, null, 2)}\n`),
      'application/json'
    );
    process.stdout.write(
      `${JSON.stringify({ status: 'applied', logKey, ...log.totals })}\n`
    );
  } finally {
    await sql.end();
  }
}

async function cleanup(args: Args): Promise<void> {
  const apply = args.apply === true;
  const audit = apply ? auditContext() : null;
  const verified = await verifiedBackup(args, apply);
  const cutoffAt = verified.manifest.source.cutoffAt;
  const sql = database();
  try {
    const [counts] = await sql`
      select
        (select count(*)::bigint from public.flowcharts
          where title = 'Untitled'
            and thumbnail is null
            and created_at < ${cutoffAt}::timestamptz - interval '30 days'
            and updated_at = created_at
            and content = ${EMPTY_PRECREATED_CONTENT}) as empty_flowcharts,
        (select count(*)::bigint from public.session
          where expires_at < ${cutoffAt}::timestamptz) as expired_sessions,
        (select count(*)::bigint from public.verification
          where expires_at < ${cutoffAt}::timestamptz) as expired_verifications
    `;
    if (!apply) {
      process.stdout.write(
        `${JSON.stringify({ mode: 'dry-run', cutoffAt, ...counts }, null, 2)}\n`
      );
      return;
    }

    let deletedFlowcharts = 0;
    const deletedFlowchartIds: string[] = [];
    while (true) {
      const candidates = await sql`
        select id, updated_at, content
        from public.flowcharts
        where title = 'Untitled'
          and thumbnail is null
          and created_at < ${cutoffAt}::timestamptz - interval '30 days'
          and updated_at = created_at
          and content = ${EMPTY_PRECREATED_CONTENT}
        order by id
        limit 500
      `;
      if (candidates.length === 0) break;
      for (const row of candidates) {
        const index = verified.indexById.get(String(row.id));
        if (
          !index ||
          index.updatedAt !== asIso(row.updated_at) ||
          index.contentSha256 !== sha256(String(row.content))
        ) {
          throw new Error(
            `Empty flowchart is not exactly covered by backup: ${row.id}`
          );
        }
      }
      const ids = candidates.map((row) => String(row.id));
      const deleted = await sql`
        delete from public.flowcharts
        where id = any(${ids})
          and title = 'Untitled'
          and thumbnail is null
          and created_at < ${cutoffAt}::timestamptz - interval '30 days'
          and updated_at = created_at
          and content = ${EMPTY_PRECREATED_CONTENT}
        returning id
      `;
      if (deleted.length !== ids.length) {
        throw new Error('Concurrent empty-flowchart delete conflict');
      }
      deletedFlowcharts += deleted.length;
      deletedFlowchartIds.push(...deleted.map((row) => String(row.id)));
      process.stdout.write(`deleted empty flowcharts=${deletedFlowcharts}\n`);
    }

    const deleteExpired = async (
      table: 'session' | 'verification'
    ): Promise<number> => {
      let total = 0;
      while (true) {
        const deleted = await sql.unsafe(
          `with candidates as (
             select id from public."${table}"
             where expires_at < $1::timestamptz
             order by id limit 1000
           )
           delete from public."${table}" target
           using candidates
           where target.id = candidates.id
           returning target.id`,
          [cutoffAt]
        );
        total += deleted.length;
        if (deleted.length < 1_000) break;
      }
      return total;
    };
    const deletedSessions = await deleteExpired('session');
    const deletedVerifications = await deleteExpired('verification');
    const log = {
      schemaVersion: 1,
      operation: 'delete-expired-and-strict-empty',
      appliedAt: new Date().toISOString(),
      ...audit,
      backupId: verified.manifest.backupId,
      cutoffAt,
      deletedFlowcharts,
      deletedFlowchartIds,
      deletedSessions,
      deletedVerifications,
    };
    const logKey = `${stringArg(args, 'manifest-key').replace(/manifest\.json$/, '')}logs/cleanup-${Date.now()}.json`;
    await putObject(
      verified.client,
      verified.bucket,
      logKey,
      Buffer.from(`${JSON.stringify(log, null, 2)}\n`),
      'application/json'
    );
    process.stdout.write(
      `${JSON.stringify({
        status: 'applied',
        logKey,
        cutoffAt,
        deletedFlowcharts,
        deletedSessions,
        deletedVerifications,
      })}\n`
    );
  } finally {
    await sql.end();
  }
}

async function rollbackMigrate(args: Args): Promise<void> {
  if (args.apply !== true) throw new Error('Rollback requires --apply');
  const verified = await verifiedBackup(args);
  const logKey = stringArg(args, 'log-key');
  const log = JSON.parse(
    (await getObjectBuffer(verified.client, verified.bucket, logKey)).toString(
      'utf8'
    )
  ) as {
    backupId: string;
    operation: string;
    rows: Array<{
      id: string;
      updatedAt: string;
      beforeHash: string;
      afterHash: string;
    }>;
  };
  if (
    log.operation !== 'compact-original-mermaid' ||
    log.backupId !== verified.manifest.backupId
  ) {
    throw new Error('Migration log does not match the verified backup');
  }
  const restored = await restoreRowsByIds(
    verified,
    log.rows.map((row) => row.id)
  );
  const sql = database();
  try {
    await sql.begin(async (tx) => {
      for (const row of log.rows) {
        const backupRow = restored.get(row.id);
        if (!backupRow || sha256(backupRow.content) !== row.beforeHash) {
          throw new Error(`Backup rollback hash mismatch: ${row.id}`);
        }
        const [current] = await tx`
          select content, updated_at from public.flowcharts where id = ${row.id}
        `;
        if (
          !current ||
          sha256(String(current.content)) !== row.afterHash ||
          asIso(current.updated_at) !== row.updatedAt
        ) {
          throw new Error(`Rollback precondition failed: ${row.id}`);
        }
        const updated = await tx`
          update public.flowcharts
          set content = ${backupRow.content}
          where id = ${row.id}
            and content = ${String(current.content)}
          returning id
        `;
        if (updated.length !== 1) {
          throw new Error(`Rollback optimistic lock failed: ${row.id}`);
        }
      }
    });
    process.stdout.write(
      `${JSON.stringify({ status: 'rollback-complete', logKey, rows: log.rows.length })}\n`
    );
  } finally {
    await sql.end();
  }
}

async function rollbackCleanup(args: Args): Promise<void> {
  if (args.apply !== true) throw new Error('Rollback requires --apply');
  const verified = await verifiedBackup(args);
  const logKey = stringArg(args, 'log-key');
  const log = JSON.parse(
    (await getObjectBuffer(verified.client, verified.bucket, logKey)).toString(
      'utf8'
    )
  ) as {
    backupId: string;
    operation: string;
    deletedFlowchartIds: string[];
  };
  if (
    log.operation !== 'delete-expired-and-strict-empty' ||
    log.backupId !== verified.manifest.backupId ||
    !Array.isArray(log.deletedFlowchartIds)
  ) {
    throw new Error('Cleanup log does not match the verified backup');
  }
  const restored = await restoreRowsByIds(verified, log.deletedFlowchartIds);
  const sql = database();
  try {
    for (
      let offset = 0;
      offset < log.deletedFlowchartIds.length;
      offset += 250
    ) {
      const ids = log.deletedFlowchartIds.slice(offset, offset + 250);
      await sql.begin(async (tx) => {
        for (const id of ids) {
          const row = restored.get(id);
          if (!row) throw new Error(`Missing restored row: ${id}`);
          const existing = await tx`
            select id from public.flowcharts where id = ${id}
          `;
          if (existing.length > 0) {
            throw new Error(`Refusing to overwrite existing flowchart: ${id}`);
          }
          await tx`
            insert into public.flowcharts
              (id, title, content, thumbnail, created_at, updated_at, user_id)
            values
              (${row.id}, ${row.title}, ${row.content}, ${row.thumbnail},
               ${row.createdAt}, ${row.updatedAt}, ${row.userId})
          `;
        }
      });
      process.stdout.write(
        `restored empty flowcharts=${Math.min(offset + ids.length, log.deletedFlowchartIds.length)}\n`
      );
    }
    process.stdout.write(
      `${JSON.stringify({ status: 'cleanup-rollback-complete', logKey, rows: log.deletedFlowchartIds.length, note: 'Expired sessions and verifications are intentionally not restored' })}\n`
    );
  } finally {
    await sql.end();
  }
}

async function vacuum(args: Args): Promise<void> {
  if (args.apply !== true) {
    throw new Error(
      'VACUUM requires --apply; VACUUM FULL is intentionally unsupported'
    );
  }
  const sql = database();
  try {
    await sql.unsafe('vacuum (analyze) public.flowcharts');
    await sql.unsafe('vacuum (analyze) public.session');
    await sql.unsafe('vacuum (analyze) public.verification');
    process.stdout.write('{"status":"vacuum-analyze-complete"}\n');
  } finally {
    await sql.end();
  }
}

function help(): void {
  process.stdout.write(`
FlowchartAI DB cleanup (safe by default)

  baseline
  backup --output ABS_DIR --bucket PRIVATE_BUCKET [--batch-size 250]
  verify-backup --bucket PRIVATE_BUCKET --manifest-key KEY
  migrate --bucket PRIVATE_BUCKET --manifest-key KEY --verification-key KEY --limit 20 [--apply --disk-capacity-bytes N]
  cleanup --bucket PRIVATE_BUCKET --manifest-key KEY --verification-key KEY [--apply]
  rollback-migrate --bucket PRIVATE_BUCKET --manifest-key KEY --verification-key KEY --log-key KEY --apply
  rollback-cleanup --bucket PRIVATE_BUCKET --manifest-key KEY --verification-key KEY --log-key KEY --apply
  vacuum --apply

Mutation commands require --apply. VACUUM FULL is not automated.
`);
}

async function main(): Promise<void> {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'baseline') return baseline();
  if (command === 'backup') return backup(args);
  if (command === 'verify-backup') return verifyBackup(args);
  if (command === 'migrate') return migrate(args);
  if (command === 'cleanup') return cleanup(args);
  if (command === 'rollback-migrate') return rollbackMigrate(args);
  if (command === 'rollback-cleanup') return rollbackCleanup(args);
  if (command === 'vacuum') return vacuum(args);
  help();
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.stack : String(error)}\n`
  );
  process.exitCode = 1;
});
