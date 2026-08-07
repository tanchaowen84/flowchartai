import { describe, expect, it } from 'vitest';
import {
  type FlowchartBackupRow,
  createBackupShard,
  parseAndVerifyBackupShard,
  sha256,
} from './flowchart-db-cleanup-core';

const rows: FlowchartBackupRow[] = [
  {
    id: 'flow-1',
    title: 'First',
    content: '{"elements":[]}',
    thumbnail: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
    userId: 'user-1',
  },
  {
    id: 'flow-2',
    title: '胖数据',
    content: JSON.stringify({ elements: [{ text: '你好'.repeat(1_000) }] }),
    thumbnail: 'data:image/png;base64,abc',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
    userId: 'user-2',
  },
];

describe('flowchart backup shard', () => {
  it('round-trips exact rows with row and shard hashes', () => {
    const shard = createBackupShard(rows);
    const restored = parseAndVerifyBackupShard(shard.compressed, shard.meta);

    expect(restored).toEqual(rows);
    expect(shard.meta.rowCount).toBe(2);
    expect(shard.meta.firstId).toBe('flow-1');
    expect(shard.meta.lastId).toBe('flow-2');
    expect(shard.meta.compressedSha256).toBe(sha256(shard.compressed));
    expect(shard.meta.compressedBytes).toBeLessThan(shard.meta.rawBytes);
  });

  it('rejects a corrupted compressed object', () => {
    const shard = createBackupShard(rows);
    const corrupted = Buffer.from(shard.compressed);
    corrupted[corrupted.length - 1] ^= 1;

    expect(() => parseAndVerifyBackupShard(corrupted, shard.meta)).toThrow(
      /compressed sha256/i
    );
  });
});
