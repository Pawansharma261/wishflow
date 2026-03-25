import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Sparkles, Users, Send, Clock, TrendingUp, ChevronRight, Gift } from 'lucide-react-native';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { Link } from 'expo-router';

const getNextOccurrence = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(dateStr);
  next.setFullYear(today.getFullYear());
  if (isBefore(next, today)) next = addYears(next, 1);
  return next;
};

export default function Dashboard() {
  const [stats, setStats] = useState({ totalContacts: 0, sentWishes: 0, pendingWishes: 0 });
  const [profile, setProfile] = useState({ whatsapp_connected: false, has_instagram: false });
  const [radarEvent, setRadarEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) setProfile({ whatsapp_connected: userData.whatsapp_connected, has_instagram: !!userData.instagram_access_token });
    const { count: contactsCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { data: wishes } = await supabase.from('wishes').select('*, contacts(name)').eq('user_id', user.id);
    const sent = wishes?.filter(w => w.status === 'sent').length || 0;
    const pending = wishes?.filter(w => w.status === 'pending').length || 0;
    setStats({ totalContacts: contactsCount || 0, sentWishes: sent, pendingWishes: pending });
    const { data: contacts } = await supabase.from('contacts').select('name, birthday, anniversary').eq('user_id', user.id);
    let soonestEvent = null;
    let soonestDays = Infinity;
    for (const c of (contacts || [])) {
      const birthday = getNextOccurrence(c.birthday);
      const anniversary = getNextOccurrence(c.anniversary);
      if (birthday) {
        const diff = differenceInDays(birthday, new Date());
        if (diff < soonestDays) { soonestDays = diff; soonestEvent = { name: c.name, date: birthday, type: 'Birthday 🎂' }; }
      }
      if (anniversary) {
        const diff = differenceInDays(anniversary, new Date());
        if (diff < soonestDays) { soonestDays = diff; soonestEvent = { name: c.name, date: anniversary, type: 'Anniversary 💍' }; }
      }
    }
    setRadarEvent(soonestEvent ? { ...soonestEvent, daysAway: soonestDays } : null);
    setLoading(false);
  };

  if (loading) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#6d23d9' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ marginBottom: 30 }}><Text style={{ fontSize: 32, fontWeight: '900', color: '#ffffff' }}>Hey there! 👋</Text></View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: profile.whatsapp_connected ? '#22c55e' : 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <Send color="#ffffff" size={20} />
            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '900', marginTop: 10 }}>WHATSAPP</Text>
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{profile.whatsapp_connected ? 'CONNECTED' : 'OFFLINE'}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: profile.has_instagram ? '#ec4899' : 'rgba(255,255,255,0.1)', padding: 15, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <TrendingUp color="#ffffff" size={20} />
            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: '900', marginTop: 10 }}>INSTAGRAM</Text>
            <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: '800' }}>{profile.has_instagram ? 'CONNECTED' : 'OFFLINE'}</Text>
          </View>
        </View>
        <View style={{ gap: 15 }}>
          <Link href="/main/contacts" asChild>
            <TouchableOpacity style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center' }}>
               <View style={{ flex: 1 }}><Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800' }}>TOTAL CONTACTS</Text><Text style={{ color: '#0f172a', fontSize: 24, fontWeight: '900' }}>{stats.totalContacts}</Text></View><ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>
          </Link>
          <Link href="/main/wishes?filter=sent" asChild>
            <TouchableOpacity style={{ backgroundColor: '#ffffff', padding: 20, borderRadius: 25, flexDirection: 'row', alignItems: 'center' }}>
               <View style={{ flex: 1 }}><Text style={{ color: '#94a3b8', fontSize: 10, fontWeight: '800' }}>WISHES SENT</Text><Text style={{ color: '#0f172a', fontSize: 24, fontWeight: '900' }}>{stats.sentWishes}</Text></View><ChevronRight color="#cbd5e1" size={20} />
            </TouchableOpacity>
          </Link>
        </View>
        {radarEvent && (
          <View style={{ marginTop: 30, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 30, padding: 25 }}>
            <Gift color="#ffffff" size={32} /><Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900', marginTop: 5 }}>{radarEvent.name}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600', marginTop: 4 }}>{radarEvent.daysAway === 0 ? '🎉 TODAY!' : `In ${radarEvent.daysAway} days — ${format(radarEvent.date, 'MMM do')}`}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
