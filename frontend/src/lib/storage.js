import { supabase } from './supabaseClient';

/**
 * Uploads a file to Supabase Storage
 * @param {File} file The file object from input
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export const uploadMedia = async (file) => {
  if (!file) return null;
  
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('wishing-media')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage
    .from('wishing-media')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Failed to generate public URL for uploaded media.');
  }

  return data.publicUrl;
};
