import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Send, Clock, TrendingUp, ChevronRight, Gift, Sparkles } from 'lucide-react-native';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { Link, useRouter } from 'expo-router';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

const getNextOccurrence = (dateStr: string | null) => {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let next = new Date(dateStr); next.setFullYear(today.getFullYear());
  if (isBefore(next, today)) { next = addYears(next, 1); }
  return next;
};

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState({ totalContacts: 0, sentWishes: 0, pendingWishes: 0 });
  const [upcomingWishes, setUpcomingWishes] = useState<any[]>([]);
  const [radarEvent, setRadarEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ whatsapp_connected: false, has_instagram: false });

  useEffect(() => {
    fetchDashboardData();
    let socket: any;
    const setupSocket = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        socket = io(BACKEND_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => socket.emit('register', user.id));
        socket.on('whatsapp_status', (data: any) => {
          setProfile(prev => ({ ...prev, whatsapp_connected: data.status === 'connected' }));
        });
      } catch (err) {
        console.warn('Socket connection error:', err);
      }
    };
    setupSocket();
    return () => { if (socket) socket.disconnect(); };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Safe fetch user data. .single() can throw if no rows.
      try {
        const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
        if (userData) {
          setProfile({ whatsapp_connected: userData.whatsapp_connected, has_instagram: !!userData.instagram_access_token });
        }
      } catch (userErr) {
        console.warn('User profile not created yet.', userErr);
      }

      const { count: contactsCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      
      const { data: wishes } = await supabase.from('wishes').select('*, contacts(name)').eq('user_id', user.id);
      const sent = wishes?.filter((w: any) => w.status === 'sent').length || 0;
      const pending = wishes?.filter((w: any) => w.status === 'pending').length || 0;
      setStats({ totalContacts: contactsCount || 0, sentWishes: sent, pendingWishes: pending });
      
      const upcoming = wishes?.filter((w: any) => w.status === 'pending')
        .sort((a: any, b: any) => new Date(a.scheduled_datetime).getTime() - new Date(b.scheduled_datetime).getTime())
        .slice(0, 3) || [];
      setUpcomingWishes(upcoming);
      
      const { data: contacts } = await supabase.from('contacts').select('name, birthday, anniversary').eq('user_id', user.id);
      let soonestEvent = null; let soonestDays = Infinity;
      for (const c of (contacts || [])) {
        const bday = getNextOccurrence(c.birthday); const anni = getNextOccurrence(c.anniversary);
        if (bday) { const diff = differenceInDays(bday, new Date()); if (diff < soonestDays) { soonestDays = diff; soonestEvent = { name: c.name, date: bday, type: 'Birthday 🎂' }; } }
        if (anni) { const diff = differenceInDays(anni, new Date()); if (diff < soonestDays) { soonestDays = diff; soonestEvent = { name: c.name, date: anni, type: 'Anniversary 💍' }; } }
      }
      setRadarEvent(soonestEvent ? { ...soonestEvent, daysAway: soonestDays } : null);

    } catch (e: any) {
      console.warn('Dashboard Fetch Error:', e);
    } finally {
      // Vital: GUARANTEE the loading spinner disappears no matter what happens
      setLoading(false);
    }
  };

  const occasionEmoji: Record<string, string> = { birthday: '🎂', christmas: '🎄', diwali: '🪔', valentine: '💝', eid: '🌙', holi: '🌈', new_year: '🎆', custom: '✨' };

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#ec4899" /></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <View>
            <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff' }}>Hey there! 👋</Text>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginTop: 2 }}>Your celebration assistant is ready.</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/scheduler')} style={{ backgroundColor: '#ec4899', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }}>
            <Sparkles size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>New Wish</Text>
          </TouchableOpacity>
        </View>

        {/* Connection Status Tiles */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.push('/settings')} style={{ flex: 1, backgroundColor: profile.whatsapp_connected ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: profile.whatsapp_connected ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.1)' }}>
            <Send size={18} color={profile.whatsapp_connected ? '#4ade80' : 'rgba(255,255,255,0.4)'} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '900', marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 }}>WhatsApp</Text>
            <Text style={{ color: profile.whatsapp_connected ? '#4ade80' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900' }}>{profile.whatsapp_connected ? 'CONNECTED' : 'OFFLINE'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/settings')} style={{ flex: 1, backgroundColor: profile.has_instagram ? 'rgba(236,72,153,0.3)' : 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: profile.has_instagram ? 'rgba(236,72,153,0.5)' : 'rgba(255,255,255,0.1)' }}>
            <TrendingUp size={18} color={profile.has_instagram ? '#f472b6' : 'rgba(255,255,255,0.4)'} />
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: '900', marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 }}>Instagram</Text>
            <Text style={{ color: profile.has_instagram ? '#f472b6' : 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '900' }}>{profile.has_instagram ? 'CONNECTED' : 'OFFLINE'}</Text>
          </TouchableOpacity>
        </View>

        {/* Stat Cards */}
        <View style={{ gap: 12, marginBottom: 28 }}>
          {[
            { title: 'Total Contacts', value: stats.totalContacts, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', route: '/contacts' },
            { title: 'Wishes Sent', value: stats.sentWishes, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', route: '/wishes' },
            { title: 'Pending', value: stats.pendingWishes, color: '#f97316', bg: 'rgba(249,115,22,0.1)', route: '/wishes' },
          ].map((s, i) => (
            <TouchableOpacity key={i} onPress={() => router.push(s.route as any)} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: s.bg, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: s.color }}>{s.value}</Text>
                </View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '800', fontSize: 14 }}>{s.title}</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Scheduled */}
        <View style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#ffffff' }}>Upcoming Scheduled</Text>
            <TouchableOpacity onPress={() => router.push('/wishes')}><Text style={{ color: '#ec4899', fontWeight: '800', fontSize: 13 }}>View All →</Text></TouchableOpacity>
          </View>
          {upcomingWishes.length === 0 ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed' }}>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '600' }}>No wishes scheduled yet.</Text>
              <TouchableOpacity onPress={() => router.push('/scheduler')} style={{ marginTop: 8 }}><Text style={{ color: '#ec4899', fontWeight: '800' }}>Schedule one now →</Text></TouchableOpacity>
            </View>
          ) : upcomingWishes.map((wish: any) => (
            <View key={wish.id} style={{ backgroundColor: '#ffffff', borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10 }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 22 }}>{occasionEmoji[wish.occasion_type] || '✨'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: '#0f172a', fontSize: 15 }}>{wish.contacts?.name}</Text>
                <Text style={{ color: '#64748b', fontSize: 12, textTransform: 'capitalize' }}>{wish.occasion_type} • {format(new Date(wish.scheduled_datetime), 'MMM do, h:mm a')}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Celebration Radar */}
        <View style={{ backgroundColor: '#6d28d9', borderRadius: 28, padding: 24, overflow: 'hidden' }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>Celebration Radar</Text>
          {radarEvent ? (
            <>
              <Gift size={32} color="rgba(255,255,255,0.8)" style={{ marginBottom: 8 }} />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' }}>{radarEvent.type}</Text>
              <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900', marginBottom: 4 }}>{radarEvent.name}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginBottom: 20 }}>
                {radarEvent.daysAway === 0 ? '🎉 Today!' : `In ${radarEvent.daysAway} day${radarEvent.daysAway > 1 ? 's' : ''} — ${format(radarEvent.date, 'MMM do')}`}
              </Text>
              <TouchableOpacity onPress={() => router.push('/scheduler')} style={{ backgroundColor: '#ffffff', borderRadius: 18, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#6d28d9', fontWeight: '900', fontSize: 15 }}>Schedule a Wish</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TrendingUp size={32} color="rgba(255,255,255,0.8)" style={{ marginBottom: 8 }} />
              <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '900', marginBottom: 6 }}>No Upcoming Events</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>Add contacts with birthdays & anniversaries to see celebrations here.</Text>
              <TouchableOpacity onPress={() => router.push('/contacts')} style={{ backgroundColor: '#ffffff', borderRadius: 18, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#6d28d9', fontWeight: '900', fontSize: 15 }}>Add Contacts</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
