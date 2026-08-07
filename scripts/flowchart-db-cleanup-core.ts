import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';

export interface FlowchartBackupRow {
  id: string;
  title: string;
  content: string;
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

interface ChecksummedBackupRow extends FlowchartBackupRow {
  contentSha256: string;
  thumbnailSha256: string | null;
  rowSha256: string;
}

export interface BackupShardMeta {
  rowCount: number;
  firstId: string;
  lastId: string;
  rawBytes: number;
  compressedBytes: number;
  rawSha256: string;
  compressedSha256: string;
}

export function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function checksummedRow(row: FlowchartBackupRow): ChecksummedBackupRow {
  const contentSha256 = sha256(row.content);
  const thumbnailSha256 = row.thumbnail === null ? null : sha256(row.thumbnail);
  const rowWithoutChecksum = {
    ...row,
    contentSha256,
    thumbnailSha256,
  };
  return {
    ...rowWithoutChecksum,
    rowSha256: sha256(JSON.stringify(rowWithoutChecksum)),
  };
}

export function createBackupShard(rows: FlowchartBackupRow[]): {
  compressed: Buffer;
  meta: BackupShardMeta;
} {
  if (rows.length === 0) throw new Error('Cannot create an empty backup shard');
  const raw = Buffer.from(
    `${rows.map((row) => JSON.stringify(checksummedRow(row))).join('\n')}\n`,
    'utf8'
  );
  const compressed = gzipSync(raw, { level: 9 });
  return {
    compressed,
    meta: {
      rowCount: rows.length,
      firstId: rows[0].id,
      lastId: rows[rows.length - 1].id,
      rawBytes: raw.byteLength,
      compressedBytes: compressed.byteLength,
      rawSha256: sha256(raw),
      compressedSha256: sha256(compressed),
    },
  };
}

function verifyChecksummedRow(row: ChecksummedBackupRow): FlowchartBackupRow {
  const { contentSha256, thumbnailSha256, rowSha256, ...restoredRow } = row;
  if (sha256(restoredRow.content) !== contentSha256) {
    throw new Error(`Content SHA256 mismatch for ${restoredRow.id}`);
  }
  const actualThumbnailSha256 =
    restoredRow.thumbnail === null ? null : sha256(restoredRow.thumbnail);
  if (actualThumbnailSha256 !== thumbnailSha256) {
    throw new Error(`Thumbnail SHA256 mismatch for ${restoredRow.id}`);
  }
  if (
    sha256(
      JSON.stringify({ ...restoredRow, contentSha256, thumbnailSha256 })
    ) !== rowSha256
  ) {
    throw new Error(`Row SHA256 mismatch for ${restoredRow.id}`);
  }
  return restoredRow;
}

export function parseAndVerifyBackupShard(
  compressed: Buffer,
  meta: BackupShardMeta
): FlowchartBackupRow[] {
  if (compressed.byteLength !== meta.compressedBytes) {
    throw new Error('Compressed byte length mismatch');
  }
  if (sha256(compressed) !== meta.compressedSha256) {
    throw new Error('Compressed SHA256 mismatch');
  }
  const raw = gunzipSync(compressed);
  if (raw.byteLength !== meta.rawBytes) {
    throw new Error('Raw byte length mismatch');
  }
  if (sha256(raw) !== meta.rawSha256) {
    throw new Error('Raw SHA256 mismatch');
  }
  const lines = raw
    .toString('utf8')
    .split('\n')
    .filter((line) => line.length > 0);
  if (lines.length !== meta.rowCount) {
    throw new Error('Backup shard row count mismatch');
  }
  const rows = lines.map((line) =>
    verifyChecksummedRow(JSON.parse(line) as ChecksummedBackupRow)
  );
  if (rows[0]?.id !== meta.firstId || rows.at(-1)?.id !== meta.lastId) {
    throw new Error('Backup shard id bounds mismatch');
  }
  return rows;
}
