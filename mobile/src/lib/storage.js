import { supabase } from './supabaseClient';
import * as FileSystem from 'expo-file-system';

const BACKEND_URL = 'https://wishflow-backend-uyd2.onrender.com';

/**
 * Uploads a local file (from ImagePicker) to Supabase Storage via Backend Proxy
 * @param {string} uri Local URI of the file
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export const uploadMedia = async (uri) => {
  if (!uri) return null;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    // On Mobile, we read the file as base64 but for the proxy we can send it as a file/blob
    // However, fetch in React Native handles FormData files via their local URI
    const fileExt = uri.split('.').pop() || 'jpg';
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;

    const formData = new FormData();
    // @ts-ignore
    formData.append('file', {
      uri,
      name: fileName,
      type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`
    });
    formData.append('userId', userId);

    const response = await fetch(`${BACKEND_URL}/api/storage/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || 'Mobile upload proxy failed');
    }

    return result.publicUrl;
  } catch (err) {
    console.error('[Storage:MobileProxy] Upload error:', err);
    throw err;
  }
};
