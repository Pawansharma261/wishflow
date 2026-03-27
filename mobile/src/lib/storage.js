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
    // SIZE LIMIT: 2MB check (Base64 length is approx 4/3 of file size)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `uploads/${userId}/${fileName}`;

    // On Mobile, we need to read the file as base64 and upload as ArrayBuffer
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
    const arrayBuffer = decode(base64);

    if (arrayBuffer.byteLength > 2 * 1024 * 1024) {
      throw new Error('Image is too large! Please choose a file smaller than 2MB.');
    }

    const { error: uploadError } = await supabase.storage
      .from('wishing-media')
      .upload(filePath, arrayBuffer, {
        contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}. (RLS Check Tip: Ensure 'INSERT' is allowed for 'authenticated' users on 'wishing-media' bucket)`);
    }

    const { data } = supabase.storage
      .from('wishing-media')
      .getPublicUrl(filePath);

    if (!data || !data.publicUrl) {
      throw new Error('Public URL generation failed for mobile media.');
    }

    return data.publicUrl;
  } catch (err) {
    console.error('[Storage:Mobile] Upload error:', err);
    throw err;
  }
};
