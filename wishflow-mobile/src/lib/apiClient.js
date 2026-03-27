// Central API client for the WishFlow backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

import { supabase } from './supabaseClient';

export const apiClient = {
  post: async (path, body) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { 
      'Content-Type': 'application/json' 
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
        return { error: 'Session expired', status: 401 };
    }

    return res.json();
  },
  get: async (path) => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = {};
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    const res = await fetch(`${BACKEND_URL}${path}`, { headers });
    return res.json();
  }
};

export const BACKEND_BASE_URL = BACKEND_URL;
