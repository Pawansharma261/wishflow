import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Alert, Image, FlatList } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, Send, Clock, TrendingUp, ChevronRight, Gift, Sparkles, Image as ImageIcon, X, Check, Search, Globe, UserCheck, RefreshCw } from 'lucide-react-native';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { Link, useRouter } from 'expo-router';
import { io } from 'socket.io-client';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { uploadMedia } from '../../src/lib/storage';

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
  const [profile, setProfile] = useState({ id: '', whatsapp_connected: false, has_instagram: false });
  const [allContacts, setAllContacts] = useState<any[]>([]);
  
  // Status Hub State
  const [statusDraft, setStatusDraft] = useState({ 
    message: '', 
    media_url: '', 
    media_type: 'text' as 'text' | 'image' | 'video' | 'audio',
    recipients: [] as string[] 
  });
  const [isPosting, setIsPosting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

      // Profile
      const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
      if (userData) {
        setProfile({ id: userData.id, whatsapp_connected: userData.whatsapp_connected, has_instagram: !!userData.instagram_access_token });
      }

      // Stats & Upcoming
      const { count: contactsCount } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
      const { data: contacts } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
      if (contacts) setAllContacts(contacts);

      const { data: wishes } = await supabase.from('wishes').select('*, contacts(name)').eq('user_id', user.id);
      const sent = wishes?.filter((w: any) => w.status === 'sent').length || 0;
      const pending = wishes?.filter((w: any) => w.status === 'pending').length || 0;
      setStats({ totalContacts: contactsCount || 0, sentWishes: sent, pendingWishes: pending });
      
      const upcoming = wishes?.filter((w: any) => w.status === 'pending')
        .sort((a: any, b: any) => new Date(a.scheduled_datetime || a.scheduled_for).getTime() - new Date(b.scheduled_datetime || b.scheduled_for).getTime())
        .slice(0, 3) || [];
      setUpcomingWishes(upcoming);
      
      // Radar
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
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
       Alert.alert('Permission Denied', 'WishFlow needs gallery access to upload media.');
       return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setUploading(true);
      try {
        const url = await uploadMedia(result.assets[0].uri);
        setStatusDraft(prev => ({ ...prev, media_url: url }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message);
      } finally {
        setUploading(false);
      }
    }
  };

  const handlePostStatus = async () => {
    if (!statusDraft.message && !statusDraft.media_url) return;
    if (!profile.whatsapp_connected) {
       Alert.alert('WhatsApp Offline', 'Please connect your WhatsApp in Settings first.');
       return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsPosting(true);
    try {
      const resp = await fetch(`${BACKEND_URL}/api/whatsapp/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: profile.id,
          wish_message: statusDraft.message, 
          mediaUrl: statusDraft.media_url, 
          mediaType: statusDraft.media_type,
          recipients: statusDraft.recipients.length > 0 ? statusDraft.recipients : ['status@broadcast'] 
        })
      });

      if (resp.ok) {
        setStatusDraft({ message: '', media_url: '', media_type: 'text', recipients: [] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success!', statusDraft.recipients.length > 0 ? 'Messages sent to selected contacts.' : 'Status broadcasted successfully.');
      } else {
        const err = await resp.json();
        throw new Error(err.message || 'Failed to post');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsPosting(false);
    }
  };

  const toggleRecipient = (phone: string) => {
    Haptics.selectionAsync();
    setStatusDraft(prev => ({
      ...prev,
      recipients: prev.recipients.includes(phone)
        ? prev.recipients.filter(p => p !== phone)
        : [...prev.recipients, phone]
    }));
  };

  const filteredContacts = allContacts.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone_number?.includes(searchQuery) ||
    c.phone?.includes(searchQuery)
  );

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

        {/* CONNECTION TILES (With Refresh) */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
             <TouchableOpacity onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: profile.whatsapp_connected ? '#22c55e' : '#ef4444' }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>WhatsApp</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchDashboardData(); }} style={{ padding: 4 }}>
                <RefreshCw size={12} color="rgba(255,255,255,0.4)" />
             </TouchableOpacity>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
             <TouchableOpacity onPress={() => router.push('/settings')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: profile.has_instagram ? '#ec4899' : '#ef4444' }} />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Instagram</Text>
             </TouchableOpacity>
             <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fetchDashboardData(); }} style={{ padding: 4 }}>
                <RefreshCw size={12} color="rgba(255,255,255,0.4)" />
             </TouchableOpacity>
          </View>
        </View>

          {/* MULTI-FORMAT SELECTOR */}
          <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 16, padding: 4, marginBottom: 16 }}>
             {['text', 'image', 'video', 'audio'].map((t) => (
                <TouchableOpacity 
                   key={t}
                   onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusDraft(prev => ({ ...prev, media_type: t as any, media_url: '' })); }}
                   style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: statusDraft.media_type === t ? '#fff' : 'transparent', borderRadius: 12, shadowColor: '#000', shadowOpacity: statusDraft.media_type === t ? 0.05 : 0, shadowRadius: 4, elevation: statusDraft.media_type === t ? 2 : 0 }}
                >
                   <Text style={{ fontSize: 10, fontWeight: '900', color: statusDraft.media_type === t ? '#0f172a' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t}</Text>
                </TouchableOpacity>
             ))}
          </View>

          <TextInput 
            value={statusDraft.message}
            onChangeText={t => setStatusDraft(prev => ({ ...prev, message: t }))}
            placeholder={statusDraft.media_type === 'text' ? "Type your status..." : "Add a caption..."}
            placeholderTextColor="#94a3b8"
            multiline
            style={{ backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, color: '#0f172a', fontSize: 15, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}
          />

          {statusDraft.media_url && (
            <View style={{ position: 'relative', marginBottom: 16, borderRadius: 20, overflow: 'hidden', height: 200, backgroundColor: '#000' }}>
               {statusDraft.media_type === 'image' && <Image source={{ uri: statusDraft.media_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />}
               {statusDraft.media_type === 'video' && <Video source={{ uri: statusDraft.media_url }} style={{ width: '100%', height: '100%' }} useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping />}
               {statusDraft.media_type === 'audio' && (
                 <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1e293b' }}>
                    <Mic size={40} color="#ec4899" />
                    <Text style={{ color: '#fff', fontWeight: '800', marginTop: 12 }}>Voice Note attached</Text>
                 </View>
               )}
               <TouchableOpacity 
                  onPress={() => setStatusDraft(prev => ({ ...prev, media_url: '' }))}
                  style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 14 }}
               >
                  <X size={18} color="#fff" />
               </TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
             {statusDraft.media_type !== 'text' && (
               <TouchableOpacity 
                 onPress={handlePickImage}
                 disabled={uploading}
                 style={{ flex: 1.2, height: 54, backgroundColor: '#f1f5f9', borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: statusDraft.media_url ? 1 : 0, borderColor: '#ec4899' }}
               >
                  {uploading ? <ActivityIndicator size="small" color="#ec4899" /> : (
                    <>
                      {statusDraft.media_type === 'image' && <ImageIcon size={20} color="#64748b" />}
                      {statusDraft.media_type === 'video' && <VideoIcon size={20} color="#64748b" />}
                      {statusDraft.media_type === 'audio' && <Mic size={20} color="#64748b" />}
                      <Text style={{ color: '#475569', fontWeight: '800', fontSize: 13 }}>Upload {statusDraft.media_type}</Text>
                    </>
                  )}
               </TouchableOpacity>
             )}

             <TouchableOpacity 
               onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowContactPicker(true); }}
               style={{ flex: 1, height: 54, backgroundColor: statusDraft.recipients.length > 0 ? 'rgba(99,102,241,0.08)' : '#f1f5f9', borderRadius: 18, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 8, borderWidth: statusDraft.recipients.length > 0 ? 1 : 0, borderColor: '#818cf8' }}
             >
                {statusDraft.recipients.length > 0 ? <UserCheck size={20} color="#6366f1" /> : <Globe size={20} color="#64748b" />}
                <Text style={{ color: statusDraft.recipients.length > 0 ? '#6366f1' : '#475569', fontWeight: '800', fontSize: 13 }}>
                   {statusDraft.recipients.length > 0 ? `${statusDraft.recipients.length} Target` : 'Broadcast'}
                </Text>
             </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={handlePostStatus}
            disabled={isPosting || (statusDraft.media_type !== 'text' && !statusDraft.media_url) || (statusDraft.media_type === 'text' && !statusDraft.message)}
            style={{ backgroundColor: '#0f172a', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 10, opacity: (isPosting || (statusDraft.media_type !== 'text' && !statusDraft.media_url)) ? 0.6 : 1, shadowColor: '#0f172a', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}
          >
             {isPosting ? <ActivityIndicator size="small" color="#fff" /> : <><Send size={20} color="#fff" /><Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Instant WhatsApp Post</Text></>}
          </TouchableOpacity>
        </View>

        {/* STATS STRIP */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
           {[
             { label: 'Contacts', val: stats.totalContacts, color: '#3b82f6' },
             { label: 'Sent', val: stats.sentWishes, color: '#22c55e' },
             { label: 'Pending', val: stats.pendingWishes, color: '#f97316' }
           ].map((s, i) => (
             <View key={i} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: s.color }}>{s.val}</Text>
                <Text style={{ fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</Text>
             </View>
           ))}
        </View>

        {/* Celebration Radar (Redesigned for Mobile) */}
        <View style={{ backgroundColor: '#6d28d9', borderRadius: 28, padding: 24, marginBottom: 28 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
             <View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 6 }}>Celebration Radar</Text>
                {radarEvent ? (
                  <>
                     <Text style={{ color: '#ffffff', fontSize: 24, fontWeight: '900' }}>{radarEvent.name}</Text>
                     <Text style={{ color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 14, marginTop: 4 }}>{radarEvent.type} • {radarEvent.daysAway === 0 ? 'Today! 🎉' : `${radarEvent.daysAway} days away`}</Text>
                  </>
                ) : (
                  <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>No Upcoming Events</Text>
                )}
             </View>
             <Gift size={32} color="rgba(255,255,255,0.3)" />
          </View>
          <TouchableOpacity onPress={() => router.push('/scheduler')} style={{ backgroundColor: '#ffffff', borderRadius: 16, padding: 14, marginTop: 20, alignItems: 'center' }}>
             <Text style={{ color: '#6d28d9', fontWeight: '900', fontSize: 14 }}>Schedule a Wish</Text>
          </TouchableOpacity>
        </View>

        {/* Upcoming Scheduled */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#ffffff' }}>Pending Wishes</Text>
            <TouchableOpacity onPress={() => router.push('/wishes')}><Text style={{ color: '#ec4899', fontWeight: '800', fontSize: 13 }}>View All</Text></TouchableOpacity>
          </View>
          {upcomingWishes.length === 0 ? (
            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 22, padding: 24, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <Text style={{ color: 'rgba(255,255,255,0.3)', fontWeight: '700' }}>Nothing scheduled yet.</Text>
            </View>
          ) : upcomingWishes.map((wish: any) => (
            <View key={wish.id} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                <Text style={{ fontSize: 20 }}>{occasionEmoji[wish.occasion_type] || '✨'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: '#ffffff', fontSize: 15 }}>{wish.contacts?.name}</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{format(new Date(wish.scheduled_datetime || wish.scheduled_for), 'MMM do, h:mm a')}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {showContactPicker && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', padding: 20, paddingTop: 60, zIndex: 100 }}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>Target Contacts</Text>
              <TouchableOpacity onPress={() => setShowContactPicker(false)} style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 14 }}>
                 <X size={20} color="#fff" />
              </TouchableOpacity>
           </View>

           <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 20, height: 54 }}>
              <Search size={18} color="rgba(255,255,255,0.4)" />
              <TextInput 
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name or number..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={{ flex: 1, color: '#fff', marginLeft: 10, fontWeight: '600' }}
              />
           </View>

           <FlatList 
              data={filteredContacts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const phone = item.phone_number || item.phone;
                const isSelected = statusDraft.recipients.includes(phone);
                return (
                  <TouchableOpacity 
                    onPress={() => toggleRecipient(phone)}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: isSelected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.03)', borderRadius: 18, marginBottom: 10, borderWidth: 1, borderColor: isSelected ? '#ec4899' : 'rgba(255,255,255,0.05)' }}
                  >
                     <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                        <Text style={{ color: '#fff', fontWeight: '900' }}>{item.name?.[0]}</Text>
                     </View>
                     <View style={{ flex: 1 }}>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{item.name}</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{phone}</Text>
                     </View>
                     {isSelected ? <Check size={20} color="#ec4899" /> : <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' }} />}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 40 }}>No contacts found.</Text>}
           />

           <TouchableOpacity 
             onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowContactPicker(false); }}
             style={{ backgroundColor: '#ec4899', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}
           >
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>Confirm {statusDraft.recipients.length} Selection</Text>
           </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

