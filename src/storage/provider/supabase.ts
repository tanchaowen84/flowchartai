import { supabase, supabaseAdmin } from '@/lib/supabase';
import type {
  PresignedUploadUrlParams,
  StorageProvider,
  UploadFileParams,
  UploadFileResult,
} from '../types';
import { ConfigurationError, UploadError } from '../types';

/**
 * Supabase storage provider implementation
 */
export class SupabaseProvider implements StorageProvider {
  private bucketName: string;

  constructor(bucketName = 'flowchart-files') {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      throw new ConfigurationError(
        'NEXT_PUBLIC_SUPABASE_URL is not configured'
      );
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      throw new ConfigurationError(
        'NEXT_PUBLIC_SUPABASE_ANON_KEY is not configured'
      );
    }

    this.bucketName = bucketName;
  }

  /**
   * Upload a file to Supabase storage
   */
  async uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
    const { file, filename, contentType, folder } = params;

    try {
      // Generate a unique filename with timestamp
      const timestamp = Date.now();
      const extension = filename.split('.').pop() || '';
      const baseName = filename.replace(`.${extension}`, '');
      const uniqueFilename = `${baseName}-${timestamp}.${extension}`;

      // Create the full path with optional folder
      const filePath = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

      // Convert file to the proper format for Supabase
      let fileData: File | Blob | ArrayBuffer;

      if (file instanceof Buffer) {
        fileData = new Blob([file], { type: contentType });
      } else if (file instanceof Blob) {
        fileData = file;
      } else {
        throw new UploadError('Unsupported file type');
      }

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, fileData, {
          contentType,
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new UploadError(`Failed to upload file: ${error.message}`);
      }

      // Get the public URL for the uploaded file
      const { data: publicUrlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(data.path);

      return {
        url: publicUrlData.publicUrl,
        key: data.path,
      };
    } catch (error) {
      if (error instanceof UploadError) {
        throw error;
      }
      throw new UploadError(
        `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete a file from Supabase storage
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([key]);

      if (error) {
        throw new Error(`Failed to delete file: ${error.message}`);
      }
    } catch (error) {
      throw new Error(
        `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate a pre-signed URL for client-side uploads
   */
  async getPresignedUploadUrl(
    params: PresignedUploadUrlParams
  ): Promise<UploadFileResult> {
    const { filename, contentType, folder, expiresIn = 3600 } = params;

    try {
      // Generate a unique filename with timestamp
      const timestamp = Date.now();
      const extension = filename.split('.').pop() || '';
      const baseName = filename.replace(`.${extension}`, '');
      const uniqueFilename = `${baseName}-${timestamp}.${extension}`;

      // Create the full path with optional folder
      const filePath = folder ? `${folder}/${uniqueFilename}` : uniqueFilename;

      // Create a signed URL for upload
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUploadUrl(filePath);

      if (error) {
        throw new Error(`Failed to create signed upload URL: ${error.message}`);
      }

      // Get the public URL that will be available after upload
      const { data: publicUrlData } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(filePath);

      return {
        url: data.signedUrl,
        key: filePath,
      };
    } catch (error) {
      throw new Error(
        `Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get the provider's name
   */
  getProviderName(): string {
    return 'supabase';
  }

  /**
   * Get the public URL for a file
   */
  getPublicUrl(key: string): string {
    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(key);

    return data.publicUrl;
  }

  /**
   * Create the storage bucket if it doesn't exist (requires admin client)
   */
  async createBucket(): Promise<void> {
    if (!supabaseAdmin) {
      throw new ConfigurationError('Supabase admin client not configured');
    }

    try {
      // Check if bucket exists
      const { data: buckets, error: listError } =
        await supabaseAdmin.storage.listBuckets();

      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`);
      }

      const bucketExists = buckets?.some(
        (bucket) => bucket.name === this.bucketName
      );

      if (!bucketExists) {
        const { error: createError } = await supabaseAdmin.storage.createBucket(
          this.bucketName,
          {
            public: true,
            allowedMimeTypes: ['image/*', 'application/json', 'text/*'],
            fileSizeLimit: 10 * 1024 * 1024, // 10MB
          }
        );

        if (createError) {
          throw new Error(`Failed to create bucket: ${createError.message}`);
        }

        console.log(`Created Supabase storage bucket: ${this.bucketName}`);
      }
    } catch (error) {
      console.error('Error creating bucket:', error);
      throw error;
    }
  }
}
