/**
 * Image processing utilities for AI chat functionality
 */

// Supported image formats
export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Maximum file size (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Convert an image file to base64 data URL
 * @param file - The image file to convert
 * @returns Promise that resolves to base64 data URL
 */
export async function encodeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    if (!SUPPORTED_IMAGE_FORMATS.includes(file.type)) {
      reject(
        new Error(
          `Unsupported file format: ${file.type}. Supported formats: ${SUPPORTED_IMAGE_FORMATS.join(', ')}`
        )
      );
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      reject(
        new Error(
          `File size too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum allowed: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        )
      );
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as data URL'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    // Read file as data URL (includes the data:image/...;base64, prefix)
    reader.readAsDataURL(file);
  });
}

/**
 * Validate if a file is a supported image format
 * @param file - The file to validate
 * @returns boolean indicating if the file is a supported image
 */
export function isValidImageFile(file: File): boolean {
  return (
    SUPPORTED_IMAGE_FORMATS.includes(file.type) && file.size <= MAX_FILE_SIZE
  );
}

/**
 * Get human-readable file size
 * @param bytes - File size in bytes
 * @returns Formatted file size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Number.parseFloat((bytes / k ** i).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Create a thumbnail preview of an image file
 * @param file - The image file
 * @param maxWidth - Maximum width of the thumbnail
 * @param maxHeight - Maximum height of the thumbnail
 * @returns Promise that resolves to a thumbnail data URL
 */
export async function createImageThumbnail(
  file: File,
  maxWidth = 200,
  maxHeight = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    if (!ctx) {
      reject(new Error('Failed to create canvas context'));
      return;
    }

    img.onload = () => {
      // Calculate thumbnail dimensions
      let { width, height } = img;

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw the image on canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to data URL
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    // Create object URL for the image
    img.src = URL.createObjectURL(file);
  });
}
