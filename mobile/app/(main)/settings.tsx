import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Linking, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, CheckCircle2, Phone, Instagram, User, Wifi, WifiOff, Info, X, Smartphone, Server, Cloud, Copy } from 'lucide-react-native';
import { io } from 'socket.io-client';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

// Background Execution Info Banner
function BackgroundBanner() {
  return (
    <View style={{ backgroundColor: 'rgba(99,102,241,0.12)', borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderWidth: 1, borderColor: 'rgba(99,102,241,0.25)', marginBottom: 18 }}>
      <Cloud size={20} color="#818cf8" style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#818cf8', fontWeight: '900', fontSize: 13, marginBottom: 3 }}>🔒 Always-On Scheduling</Text>
        <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18 }}>
          Your wishes run on our secure cloud servers — you don't need to keep the app open. Wishes will be sent on time even if your phone is off.
        </Text>
      </View>
    </View>
  );
}

export default function Settings() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>({ name: '', email: '', whatsapp_connected: false, instagram_access_token: null });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const socketRef = useRef<any>(null);

  // WhatsApp Phone Pairing State
  const [waStatus, setWaStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'pairing_code_ready' | 'connected'
  const [waLoading, setWaLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');

  useEffect(() => {
    fetchProfile();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      
      const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (error) {
         console.warn("Profile fetch error:", error.message);
      }
      if (data) {
        setProfile({ ...data, email: user.email });
        if (data.whatsapp_connected) setWaStatus('connected');
      }
      initSocket(user.id);
    } catch (err) {
      console.warn('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const initSocket = (uid: string) => {
    if (socketRef.current) return;
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('register', uid));
    
    // Listen for the pairing code instead of QR
    socket.on('whatsapp_pairing_code', (data: any) => {
      setPairingCode(data.code);
      setWaStatus('pairing_code_ready');
      setWaLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    });

    socket.on('whatsapp_status', (data: any) => {
      setWaStatus(data.status);
      if (data.status === 'connected') {
        setProfile((p: any) => ({ ...p, whatsapp_connected: true }));
        setWaLoading(false);
        setPairingCode('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (data.status === 'disconnected') {
        setProfile((p: any) => ({ ...p, whatsapp_connected: false }));
      }
    });
  };

  const requestPairingCode = async () => {
    if (!userId) return;
    if (!phoneNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter your WhatsApp phone number.');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWaLoading(true);
    setWaStatus('connecting');
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/whatsapp/pair-phone`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, phoneNumber }),
      });
      if (!response.ok) throw new Error('Failed');
    } catch {
      Alert.alert('Connection Error', 'Failed to request pairing code. Please check your network and try again.');
      setWaLoading(false);
      setWaStatus('disconnected');
    }
  };

  const connectInstagram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/instagram/oauth`);
      const data = await response.json();
      const oauthUrl = data.url || data.data?.url;
      if (!oauthUrl) throw new Error('No OAuth URL');

      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, 'wishflow://oauth/instagram');

      if (result.type === 'success' && result.url) {
        const parsed = new URL(result.url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { data: { user } } = await supabase.auth.getUser();
          await fetch(`${BACKEND_URL}/api/integrations/instagram/callback`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, userId: user?.id }),
          });
          setProfile((p: any) => ({ ...p, instagram_access_token: 'active' }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('✅ Instagram Connected!', 'Your Instagram account is now linked for sending personal celebration messages.');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to connect Instagram. Please try again.');
    }
  };

  const handleSaveName = async () => {
    if (!userId || !profile.name?.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    await supabase.from('users').upsert({ id: userId, name: profile.name });
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Saved!', 'Your name has been updated.');
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ]);
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#ec4899" /></SafeAreaView>;

  const sectionStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 28, padding: 22, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' };
  const labelStyle = { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900' as const, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', marginBottom: 20 }}>Settings</Text>

        <BackgroundBanner />

        {/* Account Info */}
        <View style={sectionStyle}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffffff', marginBottom: 16 }}>Account</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18, padding: 14, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18 }}>
            <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(236,72,153,0.2)', justifyContent: 'center', alignItems: 'center' }}>
              <User size={22} color="#ec4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>{profile.name || 'Your Name'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{profile.email}</Text>
            </View>
          </View>
          <Text style={labelStyle}>Display Name</Text>
          <TextInput value={profile.name || ''} onChangeText={t => setProfile((p: any) => ({ ...p, name: t }))} placeholder="Your Name" placeholderTextColor="rgba(255,255,255,0.3)" style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, color: '#ffffff', fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />
          <TouchableOpacity onPress={handleSaveName} disabled={saving} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#ffffff', fontWeight: '900' }}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        {/* WhatsApp Phone Pairing */}
        <View style={sectionStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Phone size={18} color="#22c55e" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#ffffff' }}>WhatsApp</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: waStatus === 'connected' ? 'rgba(34,197,94,0.15)' : waStatus === 'pairing_code_ready' ? 'rgba(234,179,8,0.15)' : waStatus === 'connecting' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: waStatus === 'connected' ? '#4ade80' : waStatus === 'pairing_code_ready' ? '#fbbf24' : waStatus === 'connecting' ? '#60a5fa' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }}>
                {waStatus === 'pairing_code_ready' ? 'Code Ready' : waStatus === 'connecting' ? 'Loading…' : waStatus}
              </Text>
            </View>
          </View>

          {waStatus === 'connected' ? (
            <View>
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <CheckCircle2 size={52} color="#22c55e" />
                <Text style={{ color: '#4ade80', fontWeight: '900', fontSize: 18, marginTop: 10 }}>WhatsApp Linked!</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4, textAlign: 'center' }}>Wishes will be sent from your personal number automatically.</Text>
              </View>
              <TouchableOpacity onPress={() => setWaStatus('disconnected')} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 18, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '800' }}>Reconnect Device</Text>
              </TouchableOpacity>
            </View>
          ) : waStatus === 'pairing_code_ready' ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#1e1b4b', fontWeight: '900', fontSize: 18, marginBottom: 6 }}>Link with Phone Number</Text>
              
              {/* The Pairing Code */}
              <View style={{ backgroundColor: '#f1f5f9', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, marginVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ color: '#0f172a', fontWeight: '900', fontSize: 32, letterSpacing: 4 }}>{pairingCode}</Text>
                <TouchableOpacity onPress={() => { Clipboard.setStringAsync(pairingCode); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }} style={{ padding: 8, backgroundColor: '#e2e8f0', borderRadius: 10 }}>
                  <Copy size={20} color="#475569" />
                </TouchableOpacity>
              </View>

              <View style={{ width: '100%', gap: 10, marginBottom: 8 }}>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>1. Open WhatsApp</Text>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>2. Tap visually Menu (⋮) or Settings</Text>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>3. Tap "Linked Devices" → "Link a Device"</Text>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13, color: '#ec4899' }}>4. Tap "Link with Phone Number Instead"</Text>
                <Text style={{ color: '#334155', fontWeight: '700', fontSize: 13 }}>5. Enter the code above ☝️</Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
                Enter your WhatsApp number. We'll generate a pairing code for you to enter directly in WhatsApp (no QR scanning required).
              </Text>
              
              <Text style={labelStyle}>Your WhatsApp Number (with country code)</Text>
              <TextInput 
                value={phoneNumber} 
                onChangeText={setPhoneNumber} 
                keyboardType="phone-pad"
                placeholder="+91 98765 43210" 
                placeholderTextColor="rgba(255,255,255,0.3)" 
                style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, color: '#ffffff', fontWeight: '700', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 16, fontSize: 16 }} 
              />
              
              <TouchableOpacity onPress={requestPairingCode} disabled={waLoading} style={{ backgroundColor: '#16a34a', borderRadius: 18, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, opacity: waLoading ? 0.7 : 1 }}>
                {waLoading ? <ActivityIndicator size="small" color="#fff" /> : <Smartphone size={18} color="#fff" />}
                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>{waLoading ? 'Generating Code…' : 'Get Pairing Code'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Instagram Integration */}
        <View style={sectionStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(236,72,153,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Instagram size={18} color="#ec4899" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#ffffff' }}>Instagram</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: profile.instagram_access_token ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.06)' }}>
              <Text style={{ color: profile.instagram_access_token ? '#f472b6' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '900' }}>{profile.instagram_access_token ? '✓ Connected' : 'Disconnected'}</Text>
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
            Connect your Instagram account using Meta's secure OAuth. A browser will open briefly — after you approve, you'll return here automatically.
          </Text>
          {profile.instagram_access_token ? (
            <View style={{ alignItems: 'center', paddingVertical: 14 }}>
              <CheckCircle2 size={44} color="#f472b6" />
              <Text style={{ color: '#f472b6', fontWeight: '900', fontSize: 16, marginTop: 10 }}>Instagram Connected!</Text>
              <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>DMs will be sent via your linked account.</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={connectInstagram} style={{ backgroundColor: '#ec4899', borderRadius: 18, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Connect Instagram via Meta</Text>
            </TouchableOpacity>
          )}
          <Text style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10, textAlign: 'center', marginTop: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>
            Secure Meta OAuth — WishFlow never stores your password
          </Text>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', marginTop: 4 }}>
          <LogOut size={18} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 16 }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
