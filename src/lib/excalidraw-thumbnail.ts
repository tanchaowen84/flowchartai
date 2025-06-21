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
 * @param maxWidth - Maximum thumbnail width (default: 300)
 * @param maxHeight - Maximum thumbnail height (default: 200)
 * @param quality - JPEG quality (0-1, default: 0.6 for smaller size)
 * @returns Base64 encoded thumbnail image
 */
export async function generateThumbnail(
  canvasData: ExcalidrawData,
  maxWidth = 300,
  maxHeight = 200,
  quality = 0.6
): Promise<string | null> {
  // Only run on client-side
  if (typeof window === 'undefined') {
    console.warn('⚠️ Thumbnail generation skipped on server-side');
    return null;
  }

  try {
    // Import Excalidraw's exportToCanvas function dynamically
    const { exportToCanvas } = await import('@excalidraw/excalidraw');

    // Create a full-size canvas first to capture the entire scene
    const fullCanvas = await exportToCanvas({
      elements: canvasData.elements,
      appState: {
        ...canvasData.appState,
        exportBackground: true,
        exportWithDarkMode: false,
        exportScale: 1,
        exportEmbedScene: false,
        // Don't crop, show full scene
        exportPadding: 20,
      },
      files: null,
    });

    // Create a smaller canvas for the thumbnail
    const thumbnailCanvas = document.createElement('canvas');
    const ctx = thumbnailCanvas.getContext('2d');

    if (!ctx) {
      console.error('Failed to get canvas context');
      return null;
    }

    // Calculate thumbnail dimensions while maintaining aspect ratio
    const aspectRatio = fullCanvas.width / fullCanvas.height;
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = maxHeight;

    if (aspectRatio > maxWidth / maxHeight) {
      // Wider than target ratio
      thumbnailHeight = Math.round(maxWidth / aspectRatio);
    } else {
      // Taller than target ratio
      thumbnailWidth = Math.round(maxHeight * aspectRatio);
    }

    thumbnailCanvas.width = thumbnailWidth;
    thumbnailCanvas.height = thumbnailHeight;

    // Draw the full canvas onto the thumbnail canvas (this will scale it down)
    ctx.drawImage(fullCanvas, 0, 0, thumbnailWidth, thumbnailHeight);

    // Convert to base64 with compression
    let dataURL = thumbnailCanvas.toDataURL('image/jpeg', quality);

    // If the thumbnail is still too large (>50KB), reduce quality further
    let currentQuality = quality;
    while (dataURL.length > 50000 && currentQuality > 0.3) {
      currentQuality -= 0.1;
      dataURL = thumbnailCanvas.toDataURL('image/jpeg', currentQuality);
    }

    console.log(
      `📸 Thumbnail generated: ${thumbnailWidth}x${thumbnailHeight}, quality: ${currentQuality.toFixed(1)}, size: ${Math.round(dataURL.length / 1024)}KB`
    );

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
  // Only run on client-side
  if (typeof window === 'undefined') {
    return '';
  }

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
