import { describe, expect, it } from 'vitest';
import {
  getPendingAuthAttachmentStorageKey,
  parsePendingAuthAttachment,
  serializePendingAuthAttachment,
} from './pending-auth-attachment';

describe('pending auth attachment storage', () => {
  it('keeps a canvas-scoped attachment across an auth redirect', () => {
    const serialized = serializePendingAuthAttachment({
      version: 1,
      name: 'process.png',
      type: 'image/png',
      lastModified: 123,
      dataUrl: 'data:image/png;base64,YWJj',
    });

    expect(parsePendingAuthAttachment(serialized)).toEqual({
      version: 1,
      name: 'process.png',
      type: 'image/png',
      lastModified: 123,
      dataUrl: 'data:image/png;base64,YWJj',
    });
    expect(getPendingAuthAttachmentStorageKey('flow-1')).toBe(
      'flowchart_ai_pending_auth_attachment:flow-1'
    );
  });

  it('rejects malformed or incomplete stored data', () => {
    expect(parsePendingAuthAttachment('{"version":1}')).toBeNull();
    expect(parsePendingAuthAttachment('not-json')).toBeNull();
  });
});
