import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  type FlowchartAssetStore,
  externalizeFlowchartAssets,
  hydrateFlowchartContent,
  readAssetDataUrl,
} from './flowchart-assets';

const png = 'data:image/png;base64,aGVsbG8=';
const jpeg = 'data:image/jpeg;base64,d29ybGQ=';
function fixture(): {
  store: FlowchartAssetStore;
  objects: Map<string, Buffer>;
} {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    store: {
      async put(key, bytes) {
        objects.set(key, Buffer.from(bytes));
      },
      async get(key) {
        const bytes = objects.get(key);
        if (!bytes) throw new Error('missing');
        return bytes;
      },
    },
  };
}
test('round-trips images and metadata; duplicate bytes use one object', async () => {
  const { store, objects } = fixture();
  const content = JSON.stringify({
    elements: [{ id: 'a', fileId: 'f' }],
    files: { f: { id: 'f', dataURL: png, created: 12, mimeType: 'image/png' } },
    flowchartAi: { source: 'keep' },
  });
  const result = await externalizeFlowchartAssets(
    'alice',
    { content, thumbnail: png },
    store
  );
  assert.equal(objects.size, 1);
  assert.ok(!result.content?.includes('base64'));
  assert.deepEqual(
    JSON.parse(await hydrateFlowchartContent('alice', result.content!, store)),
    JSON.parse(content)
  );
  assert.equal(await readAssetDataUrl('alice', result.thumbnail!, store), png);
  const again = await externalizeFlowchartAssets('alice', result, store);
  assert.deepEqual(again, result);
});
test('legacy URLs, non-JSON and unprovided fields are preserved without requests', async () => {
  const { store, objects } = fixture();
  assert.deepEqual(
    await externalizeFlowchartAssets(
      'a',
      { content: 'legacy', thumbnail: 'https://example.com/image.png' },
      store
    ),
    { content: 'legacy', thumbnail: 'https://example.com/image.png' }
  );
  assert.deepEqual(await externalizeFlowchartAssets('a', {}, store), {});
  assert.equal(objects.size, 0);
});
test('cross-owner references cannot be read or stored', async () => {
  const { store } = fixture();
  const saved = await externalizeFlowchartAssets(
    'alice',
    { thumbnail: jpeg },
    store
  );
  await assert.rejects(
    readAssetDataUrl('bob', saved.thumbnail!, store),
    /reference/
  );
  await assert.rejects(
    externalizeFlowchartAssets('bob', saved, store),
    /reference/
  );
});
test('missing or corrupted objects fail without dropping file entries', async () => {
  const { store, objects } = fixture();
  const saved = await externalizeFlowchartAssets(
    'a',
    { thumbnail: png },
    store
  );
  const key = [...objects.keys()][0];
  objects.set(key, Buffer.from('corrupt'));
  await assert.rejects(
    readAssetDataUrl('a', saved.thumbnail!, store),
    /integrity/
  );
  objects.clear();
  await assert.rejects(
    readAssetDataUrl('a', saved.thumbnail!, store),
    /missing/
  );
});
test('upload failure aborts transformation; unsupported data stays inline', async () => {
  const { store } = fixture();
  await assert.rejects(
    externalizeFlowchartAssets(
      'a',
      { thumbnail: png },
      {
        ...store,
        async put() {
          throw new Error('offline');
        },
      }
    ),
    /offline/
  );
  assert.equal(
    (
      await externalizeFlowchartAssets(
        'a',
        { thumbnail: 'data:image/png;base64,not canonical' },
        store
      )
    ).thumbnail,
    'data:image/png;base64,not canonical'
  );
});
