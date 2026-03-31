import { websiteConfig } from '@/config/website';
import { storageConfig } from './config/storage-config';
import { S3Provider } from './provider/s3';
import { SupabaseProvider } from './provider/supabase';
import type { StorageConfig, StorageProvider, UploadFileResult } from './types';

const API_STORAGE_UPLOAD = '/api/storage/upload';
const API_STORAGE_PRESIGNED_URL = '/api/storage/presigned-url';
const API_STORAGE_FILE_URL = '/api/storage/file-url';

/**
 * Default storage configuration
 */
export const defaultStorageConfig: StorageConfig = storageConfig;

/**
 * Global storage provider instance
 */
let storageProvider: StorageProvider | null = null;

/**
 * Get the storage provider
 * @returns current storage provider instance
 * @throws Error if provider is not initialized
 */
export const getStorageProvider = (): StorageProvider => {
  if (!storageProvider) {
    return initializeStorageProvider();
  }
  return storageProvider;
};

/**
 * Initialize the storage provider
 * @returns initialized storage provider
 */
export const initializeStorageProvider = (): StorageProvider => {
  if (!storageProvider) {
    if (websiteConfig.storage.provider === 's3') {
      storageProvider = new S3Provider();
    } else if (websiteConfig.storage.provider === 'supabase') {
      storageProvider = new SupabaseProvider();
    } else {
      throw new Error(
        `Unsupported storage provider: ${websiteConfig.storage.provider}`
      );
    }
  }
  return storageProvider;
};

/**
 * Uploads a file to the configured storage provider
 *
 * @param file - The file to upload (Buffer or Blob)
 * @param filename - Original filename with extension
 * @param contentType - MIME type of the file
 * @param folder - Optional folder path to store the file in
 * @returns Promise with the URL of the uploaded file and its storage key
 */
export const uploadFile = async (
  file: Buffer | Blob,
  filename: string,
  contentType: string,
  folder?: string
): Promise<UploadFileResult> => {
  const provider = getStorageProvider();
  return provider.uploadFile({ file, filename, contentType, folder });
};

/**
 * Deletes a file from the storage provider
 *
 * @param key - The storage key of the file to delete
 * @returns Promise that resolves when the file is deleted
 */
export const deleteFile = async (key: string): Promise<void> => {
  const provider = getStorageProvider();
  return provider.deleteFile(key);
};

/**
 * Generates a pre-signed URL for direct browser uploads
 *
 * @param filename - Filename with extension
 * @param contentType - MIME type of the file
 * @param folder - Optional folder path to store the file in
 * @param expiresIn - Expiration time in seconds (default: 3600)
 * @returns Promise with the pre-signed URL and the storage key
 */
export const getPresignedUploadUrl = async (
  filename: string,
  contentType: string,
  folder?: string,
  expiresIn = 3600
): Promise<UploadFileResult> => {
  const provider = getStorageProvider();
  return provider.getPresignedUploadUrl({
    filename,
    contentType,
    folder,
    expiresIn,
  });
};

/**
 * Uploads a file from the browser to the storage provider
 * This function is meant to be used in client components
 *
 * @param file - The file object from an input element
 * @param folder - Optional folder path to store the file in
 * @returns Promise with the URL of the uploaded file
 */
export const uploadFileFromBrowser = async (
  file: File,
  folder?: string
): Promise<UploadFileResult> => {
  try {
    // For small files (< 10MB), use direct upload
    if (file.size < 10 * 1024 * 1024) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder || '');

      const response = await fetch(API_STORAGE_UPLOAD, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = (await response.json()) as { message: string };
        throw new Error(error.message || 'Failed to upload file');
      }

      return await response.json();
    }
    // For larger files, use pre-signed URL

    // First, get a pre-signed URL
    const presignedUrlResponse = await fetch(API_STORAGE_PRESIGNED_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type,
        folder: folder || '',
      }),
    });

    if (!presignedUrlResponse.ok) {
      const error = (await presignedUrlResponse.json()) as { message: string };
      throw new Error(error.message || 'Failed to get pre-signed URL');
    }

    const { url, key } = (await presignedUrlResponse.json()) as {
      url: string;
      key: string;
    };

    // Then upload directly to the storage provider
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload file using pre-signed URL');
    }

    // Get the public URL
    const fileUrlResponse = await fetch(API_STORAGE_FILE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    if (!fileUrlResponse.ok) {
      const error = (await fileUrlResponse.json()) as { message: string };
      throw new Error(error.message || 'Failed to get file URL');
    }

    return await fileUrlResponse.json();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown error occurred during file upload';
    throw new Error(message);
  }
};
