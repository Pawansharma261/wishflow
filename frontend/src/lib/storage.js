import { supabase } from './supabaseClient';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

/**
 * Uploads a file to Supabase Storage via Backend Proxy
 * @param {File} file The file object from input
 * @returns {Promise<string>} Public URL of the uploaded image
 */
export const uploadMedia = async (file) => {
  if (!file) return null;
  
  // SIZE LIMIT: 32MB check for media support
  if (file.size > 32 * 1024 * 1024) {
    throw new Error('File is too large! Please choose a file smaller than 32MB.');
  }

  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id || 'anonymous';

  // Prepare FormData for the backend proxy
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);

  const response = await fetch(`${BACKEND_URL}/api/storage/upload`, {
    method: 'POST',
    body: formData
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message || 'Upload proxy failed');
  }

  return result.publicUrl;
};
