// Use any types to avoid complex Excalidraw type imports
export interface ExcalidrawElement {
  id: string;
  type: string;
  [key: string]: any;
}

export interface AppState {
  [key: string]: any;
}

export interface ExcalidrawData {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
}

/**
 * Generate a thumbnail from Excalidraw canvas data
 * @param canvasData - The Excalidraw canvas data
 * @param width - Thumbnail width (default: 400)
 * @param height - Thumbnail height (default: 300)
 * @returns Base64 encoded thumbnail image
 */
export async function generateThumbnail(
  canvasData: ExcalidrawData,
  width = 400,
  height = 300
): Promise<string | null> {
  try {
    // Import Excalidraw's exportToCanvas function dynamically
    const { exportToCanvas } = await import('@excalidraw/excalidraw');

    // Create a canvas element
    const canvas = await exportToCanvas({
      elements: canvasData.elements,
      appState: {
        ...canvasData.appState,
        exportBackground: true,
        exportWithDarkMode: false,
        exportScale: 1,
        exportEmbedScene: false,
      },
      files: null,
      getDimensions: () => ({ width, height }),
    });

    // Convert canvas to base64
    const dataURL = canvas.toDataURL('image/jpeg', 0.8);
    return dataURL;
  } catch (error) {
    console.error('Failed to generate thumbnail:', error);
    return null;
  }
}

/**
 * Create a thumbnail from Excalidraw JSON content
 * @param content - Serialized Excalidraw content
 * @param width - Thumbnail width (default: 400)
 * @param height - Thumbnail height (default: 300)
 * @returns Base64 encoded thumbnail image
 */
export async function createThumbnailFromContent(
  content: string,
  width = 400,
  height = 300
): Promise<string | null> {
  try {
    const canvasData = JSON.parse(content) as ExcalidrawData;

    // Check if there are any elements to draw
    if (!canvasData.elements || canvasData.elements.length === 0) {
      return null;
    }

    return await generateThumbnail(canvasData, width, height);
  } catch (error) {
    console.error('Failed to create thumbnail from content:', error);
    return null;
  }
}

/**
 * Generate a default placeholder thumbnail
 * @param width - Thumbnail width (default: 400)
 * @param height - Thumbnail height (default: 300)
 * @returns Base64 encoded placeholder image
 */
export function generatePlaceholderThumbnail(
  width = 400,
  height = 300
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Create a simple placeholder design
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  // Add border
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Add icon/text
  ctx.fillStyle = '#64748b';
  ctx.font = '16px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Empty Canvas', width / 2, height / 2);

  return canvas.toDataURL('image/jpeg', 0.8);
}
