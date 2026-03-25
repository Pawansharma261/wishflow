import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Smartphone as PhoneIcon } from 'lucide-react-native';
import { io } from 'socket.io-client';

export default function Settings() {
  const [profile, setProfile] = useState({ email: '', whatsapp_connected: false });
  const [qr, setQr] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
    let socket;
    const setupSocket = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const SOCKET_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      socket = io(SOCKET_URL, { transports: ['websocket'] });
      socket.on('connect', () => socket.emit('register', user.id));
      socket.on('whatsapp_qr', (data) => setQr(data.qr));
      socket.on('whatsapp_status', (data) => {
        if (data.status === 'connected') {
           setProfile(p => ({ ...p, whatsapp_connected: true }));
           setQr(null);
        } else {
           setProfile(p => ({ ...p, whatsapp_connected: false }));
        }
      });
    };
    setupSocket();
    return () => { if (socket) socket.disconnect(); };
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setProfile({ email: user.email, whatsapp_connected: false });
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) setProfile(p => ({ ...p, whatsapp_connected: data.whatsapp_connected }));
  };

  const logout = () => supabase.auth.signOut();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a' }}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ backgroundColor: '#ffffff', borderRadius: 25, padding: 25, marginBottom: 20, borderWidth: 1, borderColor: '#f1f5f9' }}>
           <Text style={{ fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 }}>ACCOUNT</Text>
           <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f172a', marginTop: 10 }}>{profile.email}</Text>
           <TouchableOpacity onPress={logout} style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LogOut size={18} color="#ef4444" />
              <Text style={{ color: '#ef4444', fontWeight: '900' }}>Log Out</Text>
           </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: '#ffffff', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#f1f5f9' }}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 }}>WHATSAPP CONNECT</Text>
              <View style={{ backgroundColor: profile.whatsapp_connected ? '#f0fdf4' : '#fef2f2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 }}>
                 <Text style={{ fontSize: 10, fontWeight: '900', color: profile.whatsapp_connected ? '#22c55e' : '#ef4444' }}>{profile.whatsapp_connected ? 'CONNECTED' : 'DISCONNECTED'}</Text>
              </View>
           </View>

           {!profile.whatsapp_connected ? (
             <View style={{ alignItems: 'center', padding: 20 }}>
                {qr ? (
                  <View style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 15, elevation: 10 }}>
                     <Image source={{ uri: qr }} style={{ width: 200, height: 200 }} />
                     <Text style={{ fontSize: 12, textAlign: 'center', color: '#64748b', marginTop: 15, fontWeight: '600' }}>Scan this code with WhatsApp</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center' }}>
                     <View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                        <PhoneIcon color="#94a3b8" size={30} />
                     </View>
                     <Text style={{ fontSize: 16, textAlign: 'center', color: '#64748b', fontWeight: '700' }}>Waiting for connection...</Text>
                     <Text style={{ fontSize: 12, textAlign: 'center', color: '#94a3b8', marginTop: 5 }}>Connecting to wish-node cluster</Text>
                  </View>
                )}
             </View>
           ) : (
             <View style={{ alignItems: 'center', padding: 20 }}>
                <CheckCircle2 color="#22c55e" size={60} />
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0f172a', marginTop: 15 }}>Ready to Send!</Text>
                <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginTop: 10, fontWeight: '500' }}>Your account is linked and wishes will be sent via this number.</Text>
             </View>
           )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
