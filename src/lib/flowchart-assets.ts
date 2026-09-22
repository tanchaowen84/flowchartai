import { createHash } from 'node:crypto';

/** Private, owner-scoped references. Never treat arbitrary remote URLs as assets. */
const PREFIX = 'r2asset:v1:';
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
export interface FlowchartAssetStore {
  put(key: string, bytes: Buffer, mimeType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
}
export interface FlowchartAssetFields {
  content?: string;
  thumbnail?: string | null;
}
export function assetDigest(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}
export function isAssetReference(value: string): boolean {
  return value.startsWith('r2asset:');
}
export function decodeImageDataUrl(
  value: string
): { bytes: Buffer; mimeType: string } | null {
  const match =
    /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match || match[2].length > Math.ceil(MAX_ASSET_BYTES / 3) * 4)
    return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.toString('base64') !== match[2]) return null;
  return { bytes, mimeType: match[1] };
}
export function parseAssetReference(
  owner: string,
  value: string
): { key: string; mimeType: string; digest: string } {
  const match =
    /^r2asset:v1:(image\/[a-z0-9.+-]+):(flowcharts\/v1\/([a-f0-9]{64})\/([a-f0-9]{64}))$/.exec(
      value
    );
  if (!match || match[3] !== assetDigest(owner))
    throw new Error('Invalid asset reference or owner');
  return { key: match[2], mimeType: match[1], digest: match[4] };
}
function parseDocument(content: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(content);
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
async function mapContentFiles(
  content: string,
  transform: (value: string) => Promise<string>
): Promise<string> {
  const doc = parseDocument(content);
  if (
    !doc ||
    !doc.files ||
    typeof doc.files !== 'object' ||
    Array.isArray(doc.files)
  )
    return content;
  let changed = false;
  for (const file of Object.values(doc.files)) {
    if (!file || typeof file !== 'object' || Array.isArray(file)) continue;
    const record = file as Record<string, unknown>;
    if (typeof record.dataURL !== 'string') continue;
    const next = await transform(record.dataURL);
    if (next !== record.dataURL) {
      record.dataURL = next;
      changed = true;
    }
  }
  return changed ? JSON.stringify(doc) : content;
}
export async function externalizeFlowchartAssets(
  owner: string,
  fields: FlowchartAssetFields,
  store: FlowchartAssetStore
): Promise<FlowchartAssetFields> {
  const uploaded = new Set<string>();
  const externalize = async (value: string): Promise<string> => {
    if (isAssetReference(value)) {
      parseAssetReference(owner, value);
      await readAssetDataUrl(owner, value, store);
      return value;
    }
    const image = decodeImageDataUrl(value);
    if (!image) return value;
    const digest = assetDigest(image.bytes);
    const key = `flowcharts/v1/${assetDigest(owner)}/${digest}`;
    if (!uploaded.has(key)) {
      await store.put(key, image.bytes, image.mimeType);
      uploaded.add(key);
    }
    return `${PREFIX}${image.mimeType}:${key}`;
  };
  const result = { ...fields };
  if (fields.content !== undefined)
    result.content = await mapContentFiles(fields.content, externalize);
  if (typeof fields.thumbnail === 'string')
    result.thumbnail = await externalize(fields.thumbnail);
  return result;
}
export async function readAssetDataUrl(
  owner: string,
  value: string,
  store: FlowchartAssetStore
): Promise<string> {
  if (!isAssetReference(value)) return value;
  const ref = parseAssetReference(owner, value);
  const bytes = await store.get(ref.key);
  if (bytes.length > MAX_ASSET_BYTES || assetDigest(bytes) !== ref.digest)
    throw new Error('Asset integrity check failed');
  return `data:${ref.mimeType};base64,${bytes.toString('base64')}`;
}
export async function hydrateFlowchartContent(
  owner: string,
  content: string,
  store: FlowchartAssetStore
): Promise<string> {
  const cache = new Map<string, string>();
  return mapContentFiles(content, async (value) => {
    if (!isAssetReference(value)) return value;
    if (!cache.has(value))
      cache.set(value, await readAssetDataUrl(owner, value, store));
    return cache.get(value)!;
  });
}
export function thumbnailUrl(
  id: string,
  thumbnail: string | null
): string | null {
  return thumbnail && isAssetReference(thumbnail)
    ? `/api/flowcharts/${encodeURIComponent(id)}/thumbnail`
    : thumbnail;
}
