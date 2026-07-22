export interface PendingAuthAttachment {
  version: 1;
  name: string;
  type: string;
  lastModified: number;
  dataUrl: string;
}

const STORAGE_PREFIX = 'flowchart_ai_pending_auth_attachment';

export function getPendingAuthAttachmentStorageKey(
  flowchartId?: string
): string {
  return `${STORAGE_PREFIX}:${flowchartId || 'unsaved'}`;
}

export function serializePendingAuthAttachment(
  attachment: PendingAuthAttachment
): string {
  return JSON.stringify(attachment);
}

export function parsePendingAuthAttachment(
  serialized: string | null
): PendingAuthAttachment | null {
  if (!serialized) return null;

  try {
    const candidate = JSON.parse(serialized) as Partial<PendingAuthAttachment>;
    if (
      candidate.version !== 1 ||
      typeof candidate.name !== 'string' ||
      typeof candidate.type !== 'string' ||
      typeof candidate.lastModified !== 'number' ||
      typeof candidate.dataUrl !== 'string' ||
      !candidate.dataUrl.startsWith('data:')
    ) {
      return null;
    }

    return candidate as PendingAuthAttachment;
  } catch {
    return null;
  }
}
