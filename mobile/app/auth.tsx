import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../src/lib/supabaseClient';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, LogIn, UserPlus } from 'lucide-react-native';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async () => {
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#6d28d9' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 30 }}>
          <View style={{ alignItems: 'center', marginBottom: 50 }}><Text style={{ fontSize: 40, fontWeight: '900', color: '#ffffff' }}>WishFlow</Text></View>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 35, padding: 30 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 25 }}>{isSignUp ? 'Create Account' : 'Welcome'}</Text>
            {error ? <Text style={{ color: '#ef4444', marginBottom: 15, fontWeight: '700' }}>{error}</Text> : null}
            <TextInput value={email} onChangeText={setEmail} placeholder="Email" style={{ height: 55, backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 15, marginBottom: 15 }} autoCapitalize="none" />
            <TextInput value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry style={{ height: 55, backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 15, marginBottom: 30 }} />
            <TouchableOpacity onPress={handleAuth} style={{ backgroundColor: '#6d28d9', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>{isSignUp ? 'Sign Up' : 'Log In'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{ marginTop: 25, alignItems: 'center' }}><Text style={{ color: '#6d28d9', fontWeight: '900' }}>{isSignUp ? 'Log In' : 'Sign Up'}</Text></TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
