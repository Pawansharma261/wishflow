import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react-native';
import { format } from 'date-fns';

export default function Wishes() {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchWishes(); }, []);

  const fetchWishes = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('wishes').select('*, contacts(name)').eq('user_id', user.id).order('scheduled_datetime', { ascending: false });
    if (data) setWishes(data);
    setLoading(false);
  };

  const statusMap = {
    sent: { color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircle2 size={14} color="#22c55e" /> },
    failed: { color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={14} color="#ef4444" /> },
    pending: { color: '#f97316', bg: '#fff7ed', icon: <Clock size={14} color="#f97316" /> }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}><Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a', marginBottom: 20 }}>Timeline</Text></View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {loading ? <ActivityIndicator size="large" color="#6d28d9" style={{ marginTop: 100 }} /> : wishes.map(wish => (
            <View key={wish.id} style={{ backgroundColor: '#ffffff', borderRadius: 25, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#f1f5f9' }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                  <View><Text style={{ fontSize: 16, fontWeight: '900' }}>{wish.contacts.name}</Text><Text style={{ fontSize: 10, fontWeight: '900', color: '#6d28d9' }}>{wish.occasion_type.toUpperCase()}</Text></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: statusMap[wish.status].bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>{statusMap[wish.status].icon}<Text style={{ fontSize: 10, fontWeight: '900', color: statusMap[wish.status].color, textTransform: 'capitalize' }}>{wish.status}</Text></View>
               </View>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View><Text style={{ fontSize: 14, fontWeight: '800' }}>{format(new Date(wish.scheduled_datetime), 'MMM do, yyyy')}</Text></View>
                  <TouchableOpacity onPress={() => {}} style={{ padding: 12, backgroundColor: '#fef2f2', borderRadius: 15 }}><Trash2 color="#ef4444" size={18} /></TouchableOpacity>
               </View>
            </View>
          ))
        }
      </ScrollView>
    </SafeAreaView>
  );
}
