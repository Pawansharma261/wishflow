import { supabase } from './supabaseClient';

/**
 * Uploads a file to Supabase Storage
 * @param {File} file The file object from input
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export const uploadMedia = async (file) => {
  if (!file) return null;
  
  // SIZE LIMIT: 2MB check
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('File is too large! Please choose an image smaller than 2MB.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous'; // RLS usually prefers authenticated paths

  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `uploads/${userId}/${fileName}`; // Structured path for better RLS control

  const { error: uploadError } = await supabase.storage
    .from('wishing-media')
    .upload(filePath, file);

  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}. (Tip: Ensure RLS policy allows 'INSERT' on 'wishing-media' for authenticated users)`);
  }

  const { data } = supabase.storage
    .from('wishing-media')
    .getPublicUrl(filePath);

  if (!data?.publicUrl) {
    throw new Error('Failed to generate public URL for uploaded media.');
  }

  return data.publicUrl;
};
