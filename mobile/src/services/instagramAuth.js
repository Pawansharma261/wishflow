import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../lib/supabaseClient';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URI = AuthSession.makeRedirectUri({
  scheme: 'wishflow',
  path: 'settings'
});

const CLIENT_ID = '1960881724517689'; // Your Meta App ID

export const connectInstagram = async () => {
  const authUrl = `https://api.instagram.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=instagram_basic,instagram_manage_messages&response_type=code`;
  
  const result = await AuthSession.startAsync({ authUrl });
  
  if (result.type === 'success' && result.params.code) {
    // Exchange code for token on backend
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/integrations/instagram/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: result.params.code, userId: user.id, redirectUri: REDIRECT_URI })
      });
      
      const data = await response.json();
      return { success: true, data };
    } catch (e) {
      console.error('Mobile IG Auth Callback Error:', e);
      return { success: false, error: e.message };
    }
  }
  
  return { success: false, error: 'Authorization closed or failed.' };
};
