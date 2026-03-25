import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { supabase } from '../src/lib/supabaseClient';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, User, ArrowRight, Sparkles } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !name)) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        // Sign Up Flow
        const { data, error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: { data: { name } } // Saves name to user metadata
        });
        if (error) throw error;
        
        // Ensure user is created in the public.users table via trigger or manual insert
        if (data.user) {
          await supabase.from('users').upsert({ id: data.user.id, email: data.user.email, name });
          Alert.alert("Success", "Account created successfully! Welcome to WishFlow.");
        }
      } else {
        // Login Flow
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      const redirectUrl = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl },
      });
      if (error) throw error;
      if (data?.url) {
        await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      }
    } catch (e: any) {
      Alert.alert("OAuth Error", e.message);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 60 }}>
          
          <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 20 }}>
            <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(236,72,153,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Sparkles size={32} color="#ec4899" />
            </View>
            <Text style={{ fontSize: 40, fontWeight: '900', color: '#ffffff', letterSpacing: -1 }}>WishFlow</Text>
            <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 8, fontWeight: '600' }}>Never miss a celebration again.</Text>
          </View>
          
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 32, padding: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ fontSize: 26, fontWeight: '900', color: '#ffffff', marginBottom: 6 }}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24, fontWeight: '600' }}>
              {isSignUp ? 'Sign up to start scheduling auto-wishes.' : 'Log in to manage your scheduled wishes.'}
            </Text>

            {error ? (
              <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 13 }}>{error}</Text>
              </View>
            ) : null}

            {isSignUp && (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <User size={18} color="rgba(255,255,255,0.4)" />
                <TextInput value={name} onChangeText={setName} placeholder="Full Name" placeholderTextColor="rgba(255,255,255,0.3)" style={{ flex: 1, height: 55, color: '#ffffff', paddingHorizontal: 12, fontWeight: '600' }} />
              </View>
            )}

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Mail size={18} color="rgba(255,255,255,0.4)" />
              <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor="rgba(255,255,255,0.3)" style={{ flex: 1, height: 55, color: '#ffffff', paddingHorizontal: 12, fontWeight: '600' }} autoCapitalize="none" keyboardType="email-address" />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, paddingHorizontal: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Lock size={18} color="rgba(255,255,255,0.4)" />
              <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="rgba(255,255,255,0.3)" secureTextEntry style={{ flex: 1, height: 55, color: '#ffffff', paddingHorizontal: 12, fontWeight: '600' }} />
            </View>

            <TouchableOpacity onPress={handleAuth} disabled={loading} style={{ backgroundColor: '#ec4899', height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: '#ec4899', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
              {loading ? <ActivityIndicator color="#ffffff" /> : (
                <>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>{isSignUp ? 'Create Account' : 'Log In'}</Text>
                  <ArrowRight size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 30 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
              <Text style={{ color: 'rgba(255,255,255,0.3)', paddingHorizontal: 16, fontWeight: '800', fontSize: 12, textTransform: 'uppercase' }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.1)' }} />
            </View>

            <TouchableOpacity onPress={() => handleOAuth('google')} style={{ backgroundColor: '#ffffff', height: 55, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 12, marginBottom: 16 }}>
              <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 15 }}>Continue with Google</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 6 }}>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>{isSignUp ? 'Already have an account?' : "Don't have an account?"}</Text>
              <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(''); }}><Text style={{ color: '#ec4899', fontWeight: '900' }}>{isSignUp ? 'Log In' : 'Sign Up'}</Text></TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
