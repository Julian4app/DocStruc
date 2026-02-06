import { SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

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

    const { data, error } = await client.storage
      .from(bucket)
      .upload(path, body, {
        upsert: true,
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw error;
    }

    const { data: publicData } = client.storage.from(bucket).getPublicUrl(path);
    return publicData.publicUrl;
  } catch (e) {
    console.error('Upload failed:', e);
    return null;
  }
};
