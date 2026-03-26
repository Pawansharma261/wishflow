// Central API client for the WishFlow backend
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

export const apiClient = {
  post: async (path, body) => {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
  get: async (path) => {
    const res = await fetch(`${BACKEND_URL}${path}`);
    return res.json();
  }
};

export const BACKEND_BASE_URL = BACKEND_URL;
