import { supabase } from './supabaseClient';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';

/**
 * Uploads a local file (from ImagePicker) to Supabase Storage
 * @param {string} uri Local URI of the file
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export const uploadMedia = async (uri) => {
  if (!uri) return null;
  
  try {
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    // On Mobile, we need to read the file as base64 and upload as ArrayBuffer
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = decode(base64);

    const { error: uploadError } = await supabase.storage
      .from('wishing-media')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('wishing-media')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('[Storage:Mobile] Upload error:', err);
    throw err;
  }
};
