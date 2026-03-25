import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, Clock, CheckCircle2, XCircle, Calendar } from 'lucide-react-native';
import { format } from 'date-fns';
import { useRouter, useLocalSearchParams } from 'expo-router';

const statusConfig: Record<string, { color: string; bg: string; icon: any }> = {
  sent: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', icon: CheckCircle2 },
  failed: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: XCircle },
  pending: { color: '#f97316', bg: 'rgba(249,115,22,0.1)', icon: Clock },
};

const occasionEmoji: Record<string, string> = { birthday: '🎂', christmas: '🎄', diwali: '🪔', valentine: '💝', eid: '🌙', holi: '🌈', new_year: '🎆', custom: '✨', anniversary: '💍' };

export default function Wishes() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [wishes, setWishes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState(params.filter as string || 'all');

  useEffect(() => { fetchWishes(); }, []);

  const fetchWishes = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('wishes').select('*, contacts(name)').eq('user_id', user.id).order('scheduled_datetime', { ascending: false });
    if (data) setWishes(data);
    setLoading(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert('Delete Wish', 'This wish will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await supabase.from('wishes').delete().eq('id', id); fetchWishes(); } }
    ]);
  };

  const FILTERS = ['all', 'pending', 'sent', 'failed'];
  const filtered = activeFilter === 'all' ? wishes : wishes.filter(w => w.status === activeFilter);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16 }}>
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff', marginBottom: 16 }}>Timeline</Text>
        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {FILTERS.map(f => (
              <TouchableOpacity key={f} onPress={() => setActiveFilter(f)} style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: activeFilter === f ? '#ec4899' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: activeFilter === f ? '#ec4899' : 'rgba(255,255,255,0.12)' }}>
                <Text style={{ color: activeFilter === f ? '#ffffff' : 'rgba(255,255,255,0.6)', fontWeight: '800', textTransform: 'capitalize', fontSize: 13 }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator size="large" color="#ec4899" style={{ marginTop: 60 }} /> : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Calendar size={48} color="rgba(255,255,255,0.2)" />
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginTop: 16, marginBottom: 4 }}>No wishes here yet</Text>
            <TouchableOpacity onPress={() => router.push('/scheduler')}>
              <Text style={{ color: '#ec4899', fontWeight: '800' }}>Schedule one now →</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.map((wish: any) => {
          const status = statusConfig[wish.status] || statusConfig.pending;
          const StatusIcon = status.icon;
          return (
            <View key={wish.id} style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 24 }}>{occasionEmoji[wish.occasion_type] || '✨'}</Text>
                  </View>
                  <View>
                    <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 16 }}>{wish.contacts?.name || 'Unknown'}</Text>
                    <Text style={{ color: '#ec4899', fontWeight: '900', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{wish.occasion_type}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: status.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 }}>
                  <StatusIcon size={12} color={status.color} />
                  <Text style={{ color: status.color, fontSize: 10, fontWeight: '900', textTransform: 'capitalize' }}>{wish.status}</Text>
                </View>
              </View>
              {wish.message_content || wish.wish_message ? (
                <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 12, marginBottom: 12 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, lineHeight: 20 }} numberOfLines={3}>
                    {wish.message_content || wish.wish_message}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Calendar size={13} color="rgba(255,255,255,0.4)" />
                  <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>
                    {format(new Date(wish.scheduled_datetime), 'MMM do, yyyy • h:mm a')}
                  </Text>
                </View>
                {wish.status !== 'sent' && (
                  <TouchableOpacity onPress={() => handleDelete(wish.id)} style={{ padding: 10, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 14 }}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
