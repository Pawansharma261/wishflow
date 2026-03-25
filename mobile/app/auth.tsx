import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
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
        alert('Check your email for confirmation!');
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
           
          <View style={{ alignItems: 'center', marginBottom: 50 }}>
            <View style={{ width: 80, height: 80, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
               <Text style={{ fontSize: 40 }}>✨</Text>
            </View>
            <Text style={{ fontSize: 40, fontWeight: '900', color: '#ffffff' }}>WishFlow</Text>
            <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 10 }}>Automated Celebration Assistant</Text>
          </View>

          <View style={{ backgroundColor: '#ffffff', borderRadius: 35, padding: 30, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 25 }}>{isSignUp ? 'Create Account' : 'Welcome Back'}</Text>

            {error ? <Text style={{ color: '#ef4444', marginBottom: 15, fontWeight: '700', fontSize: 13 }}>{error}</Text> : null}

            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 8, marginLeft: 5 }}>EMAIL ADDRESS</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Mail size={20} color="#94a3b8" />
                <TextInput 
                  value={email} 
                  onChangeText={setEmail} 
                  placeholder="name@example.com" 
                  style={{ flex: 1, height: 55, paddingHorizontal: 15, fontSize: 15, fontWeight: '600' }}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={{ marginBottom: 30 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#94a3b8', marginBottom: 8, marginLeft: 5 }}>PASSWORD</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 15, borderWidth: 1, borderColor: '#e2e8f0' }}>
                <Lock size={20} color="#94a3b8" />
                <TextInput 
                  value={password} 
                  onChangeText={setPassword} 
                  placeholder="••••••••" 
                  secureTextEntry 
                  style={{ flex: 1, height: 55, paddingHorizontal: 15, fontSize: 15, fontWeight: '600' }}
                />
              </View>
            </View>

            <TouchableOpacity 
              onPress={handleAuth} 
              disabled={loading}
              style={{ backgroundColor: '#6d28d9', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#6d28d9', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', marginRight: 10 }}>{isSignUp ? 'Sign Up' : 'Log In'}</Text>
                   {isSignUp ? <UserPlus size={20} color="#ffffff" /> : <LogIn size={20} color="#ffffff" />}
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={{ marginTop: 25, alignItems: 'center' }}>
              <Text style={{ color: '#64748b', fontWeight: '700' }}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: '#6d28d9', fontWeight: '900' }}>{isSignUp ? 'Log In' : 'Sign Up'}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
