import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { type FlowchartAssetStore, assetDigest } from '../lib/flowchart-assets';

/** Separate bucket: the existing STORAGE_BUCKET_NAME may be publicly accessible. */
export function createFlowchartAssetStore(): FlowchartAssetStore {
  const bucket = process.env.FLOWCHART_ASSET_BUCKET;
  const client = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || 'auto',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    },
    maxAttempts: 3,
  });
  const requireBucket = (): string => {
    if (!bucket || bucket === process.env.STORAGE_BUCKET_NAME)
      throw new Error('Private FLOWCHART_ASSET_BUCKET must be configured');
    return bucket;
  };
  const get = async (key: string): Promise<Buffer> => {
    const response = await client.send(
      new GetObjectCommand({ Bucket: requireBucket(), Key: key })
    );
    if (!response.Body || (response.ContentLength ?? 0) > 10 * 1024 * 1024)
      throw new Error('Invalid asset object');
    return Buffer.from(await response.Body.transformToByteArray());
  };
  return {
    get,
    async put(key, bytes, mimeType): Promise<void> {
      const digest = assetDigest(bytes);
      try {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: requireBucket(), Key: key })
        );
        if (
          head.ContentLength === bytes.length &&
          head.Metadata?.sha256 === digest
        )
          return;
        throw new Error(
          'Immutable asset object does not match expected content'
        );
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !['NotFound', 'NoSuchKey'].includes(error.name)
        )
          throw error;
      }
      await client.send(
        new PutObjectCommand({
          Bucket: requireBucket(),
          Key: key,
          Body: bytes,
          ContentType: mimeType,
          Metadata: { sha256: digest },
          CacheControl: 'private, max-age=31536000, immutable',
        })
      );
      if (assetDigest(await get(key)) !== digest)
        throw new Error('Uploaded asset integrity check failed');
    },
  };
}
