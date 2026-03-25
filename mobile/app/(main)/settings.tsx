import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Linking, Image } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, CheckCircle2, Phone, Instagram, User, Loader, QrCode } from 'lucide-react-native';
import { io } from 'socket.io-client';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

export default function Settings() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>({ name: '', email: '', whatsapp_connected: false, instagram_access_token: null });
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState('disconnected'); // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    fetchProfile();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) {
      setProfile({ ...data, email: user.email });
      if (data.whatsapp_connected) setWaStatus('connected');
    }
    setLoading(false);
    initSocket(user.id);
  };

  const initSocket = (uid: string) => {
    if (socketRef.current) return;
    const socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('register', uid));
    socket.on('whatsapp_qr', (data: any) => {
      // Use the raw QR string to show as text since we can't use qrcode lib easily
      setQrDataUrl(data.qr);
      setWaStatus('qr_ready');
      setWaLoading(false);
    });
    socket.on('whatsapp_status', (data: any) => {
      setWaStatus(data.status);
      if (data.status === 'connected') {
        setProfile((p: any) => ({ ...p, whatsapp_connected: true }));
        setWaLoading(false);
        setQrDataUrl('');
      } else if (data.status === 'disconnected') {
        setProfile((p: any) => ({ ...p, whatsapp_connected: false }));
      }
    });
  };

  const connectWhatsApp = async () => {
    if (!userId) return;
    setWaLoading(true);
    setWaStatus('connecting');
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error('Failed');
    } catch {
      Alert.alert('Error', 'Failed to initiate WhatsApp connection. Please try again.');
      setWaLoading(false);
      setWaStatus('disconnected');
    }
  };

  const connectInstagram = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/instagram/oauth`);
      const data = await response.json();
      if (data.url) Linking.openURL(data.url);
    } catch {
      Alert.alert('Error', 'Failed to get Instagram OAuth URL');
    }
  };

  const handleSaveName = async () => {
    if (!userId || !profile.name?.trim()) return;
    setSaving(true);
    await supabase.from('users').upsert({ id: userId, name: profile.name });
    setSaving(false);
    Alert.alert('Saved!', 'Your name has been updated.');
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() }
    ]);
  };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#ec4899" /></SafeAreaView>;

  const sectionStyle = { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 28, padding: 22, marginBottom: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' };
  const sectionTitle = { fontSize: 18, fontWeight: '900' as const, color: '#ffffff', marginBottom: 16 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', marginBottom: 24 }}>Settings</Text>

        {/* Account Info */}
        <View style={sectionStyle}>
          <Text style={sectionTitle}>Account</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20 }}>
            <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(236,72,153,0.2)', justifyContent: 'center', alignItems: 'center' }}>
              <User size={24} color="#ec4899" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>{profile.name || 'Your Name'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{profile.email}</Text>
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Display Name</Text>
          <TextInput value={profile.name || ''} onChangeText={t => setProfile((p: any) => ({ ...p, name: t }))} placeholder="Your Name" placeholderTextColor="rgba(255,255,255,0.3)" style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, color: '#ffffff', fontWeight: '600', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 12 }} />
          <TouchableOpacity onPress={handleSaveName} disabled={saving} style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#ffffff', fontWeight: '900' }}>Save Changes</Text>}
          </TouchableOpacity>
        </View>

        {/* WhatsApp Integration */}
        <View style={sectionStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Phone size={18} color="#22c55e" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#ffffff' }}>WhatsApp</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: waStatus === 'connected' ? 'rgba(34,197,94,0.2)' : waStatus === 'qr_ready' ? 'rgba(234,179,8,0.2)' : waStatus === 'connecting' ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)' }}>
              <Text style={{ color: waStatus === 'connected' ? '#4ade80' : waStatus === 'qr_ready' ? '#fbbf24' : waStatus === 'connecting' ? '#60a5fa' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }}>
                {waStatus === 'qr_ready' ? 'Ready to Scan' : waStatus === 'connecting' ? 'Connecting...' : waStatus}
              </Text>
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
            Connect your real WhatsApp account to send wishes directly from your phone number.
          </Text>
          {waStatus === 'connected' ? (
            <View>
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <CheckCircle2 size={52} color="#22c55e" />
                <Text style={{ color: '#4ade80', fontWeight: '900', fontSize: 18, marginTop: 10 }}>WhatsApp Ready!</Text>
              </View>
              <TouchableOpacity onPress={connectWhatsApp} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 18, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800' }}>Reconnect Device</Text>
              </TouchableOpacity>
            </View>
          ) : waStatus === 'qr_ready' && qrDataUrl ? (
            <View>
              <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 16, alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ color: '#1e1b4b', fontWeight: '900', textAlign: 'center', marginBottom: 10 }}>Scan with WhatsApp</Text>
                <Text style={{ color: '#475569', fontSize: 11, textAlign: 'center' }}>Open WhatsApp → Linked Devices → Link a Device</Text>
                <Text style={{ color: '#6d28d9', fontSize: 10, marginTop: 12, textAlign: 'center', fontWeight: '600' }}>QR Code received. Open WhatsApp to scan.</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={connectWhatsApp} disabled={waLoading} style={{ backgroundColor: '#16a34a', borderRadius: 18, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, opacity: waLoading ? 0.7 : 1 }}>
              {waLoading ? <ActivityIndicator size="small" color="#fff" /> : <QrCode size={18} color="#fff" />}
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>{waLoading ? 'Generating QR...' : 'Generate Connection QR'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Instagram Integration */}
        <View style={sectionStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(236,72,153,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Instagram size={18} color="#ec4899" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#ffffff' }}>Instagram</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: profile.instagram_access_token ? 'rgba(236,72,153,0.2)' : 'rgba(255,255,255,0.08)' }}>
              <Text style={{ color: profile.instagram_access_token ? '#f472b6' : 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '900' }}>{profile.instagram_access_token ? 'Connected' : 'Disconnected'}</Text>
            </View>
          </View>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 16, lineHeight: 20 }}>
            Connect your Instagram Professional account via Meta Graph API to send direct messages.
          </Text>
          <TouchableOpacity onPress={connectInstagram} style={{ backgroundColor: '#ec4899', borderRadius: 18, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Connect Instagram via Meta</Text>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10, textAlign: 'center', marginTop: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>Secure Meta OAuth Login</Text>
        </View>

        {/* Logout */}
        <TouchableOpacity onPress={handleLogout} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 20, paddingVertical: 16, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' }}>
          <LogOut size={18} color="#ef4444" />
          <Text style={{ color: '#ef4444', fontWeight: '900', fontSize: 16 }}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
