import { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Allowed MIME types for file uploads
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4',
  'video/mp4', 'video/webm',
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

/** Sanitize filename to prevent path traversal */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[\/\\:*?"<>|]/g, '_')  // Remove dangerous chars
    .replace(/\.\./g, '_')            // Prevent directory traversal
    .replace(/^\./, '_')              // No hidden files
    .substring(0, 255);               // Limit length
}

export const uploadFile = async (
  client: SupabaseClient,
  bucket: string,
  path: string,
  fileUri: string, // Blob or File object on web, file path on native
  webFile?: File // Optional direct file object for web
): Promise<string | null> => {
  try {
    let body: Blob | File;

    if (Platform.OS === 'web') {
      if (webFile) {
        body = webFile;
      } else {
        // Fetch blob if we only have a blob URI
        const response = await fetch(fileUri);
        body = await response.blob();
      }
    } else {
      // React Native
      const response = await fetch(fileUri);
      body = await response.blob();
    }

    // Validate file size
    if (body.size > MAX_FILE_SIZE) {
      console.error(`File too large: ${body.size} bytes (max ${MAX_FILE_SIZE})`);
      throw new Error(`Datei zu groß. Maximum: ${MAX_FILE_SIZE / 1024 / 1024} MB`);
    }

    // Validate MIME type
    if (body.type && !ALLOWED_MIME_TYPES.has(body.type)) {
      console.error(`Blocked file upload with MIME type: ${body.type}`);
      throw new Error(`Dateityp nicht erlaubt: ${body.type}`);
    }

    // Sanitize the path
    const sanitizedPath = path.split('/').map(sanitizeFilename).join('/');

    const { data, error } = await client.storage
      .from(bucket)
      .upload(sanitizedPath, body, {
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    const { data: publicData } = client.storage.from(bucket).getPublicUrl(sanitizedPath);
    return publicData.publicUrl;
  } catch (e) {
    console.error('Upload failed:', e);
    return null;
  }
};
