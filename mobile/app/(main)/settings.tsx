import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Linking, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, CheckCircle2, Phone, Instagram, User, QrCode, Wifi, WifiOff, Info, X, Smartphone, Server, Cloud } from 'lucide-react-native';
import { io } from 'socket.io-client';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

// Challenge 4 Helper: Instructions Modal for WhatsApp QR on phone
function WhatsAppGuideModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" presentationStyle="overFullScreen">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#1a1740', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingBottom: 44 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '900' }}>How to Link WhatsApp</Text>
            <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><X size={18} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
          </View>
          <View style={{ gap: 20 }}>
            {[
              { step: '1', icon: <Smartphone size={20} color="#ec4899" />, title: 'Tap "Generate QR"', desc: 'Tap the button below. WishFlow will generate a secure QR code on screen.' },
              { step: '2', icon: <QrCode size={20} color="#f97316" />, title: 'Use a Second Screen', desc: 'Open WhatsApp on your phone → Tap the 3 dots (⋮) → "Linked Devices" → "Link a Device".' },
              { step: '3', icon: <CheckCircle2 size={20} color="#22c55e" />, title: 'Scan the QR Code', desc: 'Point your phone camera at the QR code shown here (or open this app on a tablet/use your laptop\'s Expo app preview).' },
              { step: '4', icon: <Server size={20} color="#818cf8" />, title: 'WishFlow is a Companion', desc: 'Your phone sends wishes. You don\'t need the app open — our servers handle the scheduling automatically.' },
            ].map(item => (
              <View key={item.step} style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
                <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  {item.icon}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 14, marginBottom: 3 }}>{item.title}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 19 }}>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={{ backgroundColor: '#ec4899', borderRadius: 20, paddingVertical: 14, alignItems: 'center', marginTop: 24 }}>
            <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Got It!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Challenge 5: Background Execution Info Banner
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
  const [waStatus, setWaStatus] = useState('disconnected');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [waLoading, setWaLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showWaGuide, setShowWaGuide] = useState(false); // Challenge 4
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
      setQrDataUrl(data.qr);
      setWaStatus('qr_ready');
      setWaLoading(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Challenge 3
    });
    socket.on('whatsapp_status', (data: any) => {
      setWaStatus(data.status);
      if (data.status === 'connected') {
        setProfile((p: any) => ({ ...p, whatsapp_connected: true }));
        setWaLoading(false);
        setQrDataUrl('');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Challenge 3
      } else if (data.status === 'disconnected') {
        setProfile((p: any) => ({ ...p, whatsapp_connected: false }));
      }
    });
  };

  const connectWhatsApp = async () => {
    if (!userId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // Challenge 3
    setWaLoading(true);
    setWaStatus('connecting');
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/whatsapp/connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error('Failed');
    } catch {
      Alert.alert('Connection Error', 'Failed to initiate WhatsApp connection. Please check your network and try again.');
      setWaLoading(false);
      setWaStatus('disconnected');
    }
  };

  // Challenge 1: Full deep-link OAuth flow using expo-web-browser
  const connectInstagram = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // Challenge 3
    try {
      const response = await fetch(`${BACKEND_URL}/api/integrations/instagram/oauth`);
      const data = await response.json();
      const oauthUrl = data.url || data.data?.url;
      if (!oauthUrl) throw new Error('No OAuth URL');

      // Open in an in-app browser (not leaving the app). When the user finishes,
      // the browser auto-closes and the deep link in _layout.tsx handles the callback.
      const result = await WebBrowser.openAuthSessionAsync(oauthUrl, 'wishflow://oauth/instagram');

      if (result.type === 'success' && result.url) {
        // Extract code from the redirect URL and call backend
        const parsed = new URL(result.url);
        const code = parsed.searchParams.get('code');
        if (code) {
          const { data: { user } } = await supabase.auth.getUser();
          await fetch(`${BACKEND_URL}/api/integrations/instagram/callback`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, userId: user?.id }),
          });
          setProfile((p: any) => ({ ...p, instagram_access_token: 'active' }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Challenge 3
          Alert.alert('✅ Instagram Connected!', 'Your Instagram account is now linked for sending personal celebration messages.');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to connect Instagram. Please try again.');
    }
  };

  const handleSaveName = async () => {
    if (!userId || !profile.name?.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); // Challenge 3
    setSaving(true);
    await supabase.from('users').upsert({ id: userId, name: profile.name });
    setSaving(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); // Challenge 3
    Alert.alert('Saved!', 'Your name has been updated.');
  };

  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); // Challenge 3
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
      {/* Challenge 4: WhatsApp Guide Modal */}
      <WhatsAppGuideModal visible={showWaGuide} onClose={() => setShowWaGuide(false)} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', marginBottom: 20 }}>Settings</Text>

        {/* Challenge 5: Background Execution Banner */}
        <BackgroundBanner />

        {/* Account */}
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

        {/* WhatsApp Integration */}
        <View style={sectionStyle}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(34,197,94,0.15)', justifyContent: 'center', alignItems: 'center' }}>
                <Phone size={18} color="#22c55e" />
              </View>
              <Text style={{ fontSize: 17, fontWeight: '900', color: '#ffffff' }}>WhatsApp</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Challenge 4: info button opens guide */}
              <TouchableOpacity onPress={() => setShowWaGuide(true)} style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10 }}>
                <Info size={14} color="rgba(255,255,255,0.4)" />
              </TouchableOpacity>
              <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: waStatus === 'connected' ? 'rgba(34,197,94,0.15)' : waStatus === 'qr_ready' ? 'rgba(234,179,8,0.15)' : waStatus === 'connecting' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)' }}>
                <Text style={{ color: waStatus === 'connected' ? '#4ade80' : waStatus === 'qr_ready' ? '#fbbf24' : waStatus === 'connecting' ? '#60a5fa' : 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }}>
                  {waStatus === 'qr_ready' ? 'Scan QR' : waStatus === 'connecting' ? 'Connecting…' : waStatus}
                </Text>
              </View>
            </View>
          </View>

          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
            Link your real WhatsApp account. WishFlow acts as a companion device — it uses your number to send heartfelt personal messages on your behalf.
          </Text>

          {/* Challenge 4: QR secondary device instructions inline */}
          {waStatus !== 'connected' && (
            <View style={{ backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(234,179,8,0.2)', flexDirection: 'row', gap: 10 }}>
              <Smartphone size={16} color="#fbbf24" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: 'rgba(234,179,8,0.9)', fontSize: 12, lineHeight: 18, fontWeight: '600' }}>
                Since your app is on this phone, you'll need a second screen (laptop, PC, or another device) to scan the QR. Tap ⓘ above for step-by-step instructions.
              </Text>
            </View>
          )}

          {waStatus === 'connected' ? (
            <View>
              <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                <CheckCircle2 size={52} color="#22c55e" />
                <Text style={{ color: '#4ade80', fontWeight: '900', fontSize: 18, marginTop: 10 }}>WhatsApp Ready!</Text>
                <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4, textAlign: 'center' }}>Wishes will be sent from your personal number automatically.</Text>
              </View>
              <TouchableOpacity onPress={connectWhatsApp} style={{ borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 18, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '800' }}>Reconnect Device</Text>
              </TouchableOpacity>
            </View>
          ) : waStatus === 'qr_ready' ? (
            <View style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 20, alignItems: 'center' }}>
              <QrCode size={32} color="#1e1b4b" style={{ marginBottom: 10 }} />
              <Text style={{ color: '#1e1b4b', fontWeight: '900', fontSize: 16, marginBottom: 4 }}>QR Code Ready</Text>
              <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 12 }}>
                Open WhatsApp on another device → Menu (⋮) → Linked Devices → Link a Device → scan this screen.
              </Text>
              <View style={{ backgroundColor: '#f1f5f9', borderRadius: 14, padding: 14, width: '100%' }}>
                <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'center', fontFamily: 'monospace' }} numberOfLines={3}>{qrDataUrl?.substring(0, 80)}…</Text>
              </View>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 10 }}>Waiting for scan… (expires in 60s)</Text>
            </View>
          ) : (
            <TouchableOpacity onPress={connectWhatsApp} disabled={waLoading} style={{ backgroundColor: '#16a34a', borderRadius: 18, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 10, opacity: waLoading ? 0.7 : 1 }}>
              {waLoading ? <ActivityIndicator size="small" color="#fff" /> : <QrCode size={18} color="#fff" />}
              <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>{waLoading ? 'Generating QR…' : 'Generate Connection QR'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Instagram Integration — Challenge 1: Real OAuth with WebBrowser */}
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
