import { Stack, router, useSegments } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../src/lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { View, ActivityIndicator, Text } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Required for expo-web-browser to correctly handle OAuth redirects on Android
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const segments = useSegments();

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
    }).catch(err => {
      console.warn('Session fetch failed:', err);
    }).finally(() => {
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

  // Handle protected routing
  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      // Redirect to Auth screen if not logged in
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      // Redirect to main app if logged in but on Auth screen
      router.replace('/');
    }
  }, [loading, session, segments]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0c29' }}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(236,72,153,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 }}>
        <Sparkles size={40} color="#ec4899" />
      </View>
      <Text style={{ fontSize: 32, fontWeight: '900', color: '#ffffff', letterSpacing: -1, marginBottom: 12 }}>WishFlow</Text>
      <ActivityIndicator size="large" color="#ec4899" />
    </View>
  );

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Screen name="(main)" />
      <Stack.Screen name="auth" />
    </Stack>
  );
}
