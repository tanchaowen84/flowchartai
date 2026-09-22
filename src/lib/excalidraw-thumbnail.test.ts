import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import { afterEach, expect, it, vi } from 'vitest';
import { generateThumbnail } from './excalidraw-thumbnail';

const { exportToCanvas } = vi.hoisted(() => ({ exportToCanvas: vi.fn() }));
vi.mock('@excalidraw/excalidraw', () => ({ exportToCanvas }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('includes restored image bytes in dashboard thumbnails', async () => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('document', {
    createElement: () => ({
      getContext: () => ({ drawImage: vi.fn() }),
      toDataURL: () => 'data:image/jpeg;base64,cHJldmlldw==',
    }),
  });
  exportToCanvas.mockResolvedValue({ width: 600, height: 400 });
  const files = {
    photo: {
      id: 'photo',
      dataURL: 'data:image/png;base64,aW1hZ2U=',
      mimeType: 'image/png',
      created: 1,
    },
  } as unknown as BinaryFiles;
  const scene = {
    elements: [{ id: 'image-element', type: 'image', fileId: 'photo' }],
    appState: {},
    files,
  };
  expect(await generateThumbnail(scene)).toBe(
    'data:image/jpeg;base64,cHJldmlldw=='
  );
  expect(exportToCanvas).toHaveBeenCalledWith(
    expect.objectContaining({ files })
  );
});
