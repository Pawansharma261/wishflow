import { Stack } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, Text } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Required for expo-web-browser to correctly handle OAuth redirects on Android
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Challenge 1: Deep Link Handler — processes "wishflow://..." callbacks
  const handleDeepLink = useCallback(async (url: string) => {
    if (!url) return;
    const parsed = Linking.parse(url);

    // Instagram OAuth Callback: "wishflow://oauth/instagram?code=..."
    if (parsed.path?.includes('oauth/instagram') || parsed.path?.includes('integrations/instagram/callback')) {
      const code = parsed.queryParams?.code as string;
      if (!code) return;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await fetch(`${BACKEND_URL}/api/integrations/instagram/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, userId: user.id }),
        });
        // Supabase will reflect the updated token on next profile fetch
      } catch (err) {
        console.error('Instagram callback error:', err);
      }
    }
  }, []);

  useEffect(() => {
    // Handle deep link when app is already open (foreground)
    const subscription = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    // Handle deep link when app was opened FROM a URL (cold start)
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });

    // Auth state listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.remove();
      authSub.unsubscribe();
    };
  }, [handleDeepLink]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0c29' }}>
      <ActivityIndicator size="large" color="#ec4899" />
      <Text style={{ color: 'rgba(255,255,255,0.4)', marginTop: 16, fontWeight: '700' }}>Loading WishFlow...</Text>
    </View>
  );

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {session ? (
        <Stack.Screen name="(main)" />
      ) : (
        <Stack.Screen name="auth" />
      )}
    </Stack>
  );
}
