import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Trash2, Clock, CheckCircle2, XCircle, Trash2 as TrashIcon } from 'lucide-react-native';
import { format } from 'date-fns';
import { useLocalSearchParams } from 'expo-router';

export default function Wishes() {
  const { filter: initialFilter } = useLocalSearchParams();
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    fetchWishes();
  }, [filter]);

  const fetchWishes = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    let query = supabase.from('wishes').select('*, contacts(name)').eq('user_id', user.id).order('scheduled_datetime', { ascending: false });
    if (filter !== 'all') query = query.eq('status', filter);
    const { data } = await query;
    if (data) setWishes(data);
    setLoading(false);
  };

  const deleteWish = async () => {
    if (!confirmDelete) return;
    await supabase.from('wishes').delete().eq('id', confirmDelete);
    setConfirmDelete(null);
    fetchWishes();
  };

  const statusMap = {
    sent: { color: '#22c55e', bg: '#f0fdf4', icon: <CheckCircle2 size={14} color="#22c55e" /> },
    failed: { color: '#ef4444', bg: '#fef2f2', icon: <XCircle size={14} color="#ef4444" /> },
    pending: { color: '#f97316', bg: '#fff7ed', icon: <Clock size={14} color="#f97316" /> }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a', marginBottom: 20 }}>Timeline</Text>
        <View style={{ flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 15, padding: 5 }}>
          {['all', 'pending', 'sent'].map(f => (
            <TouchableOpacity 
              key={f} onPress={() => setFilter(f)}
              style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: filter === f ? '#ffffff' : 'transparent', alignItems: 'center' }}
            >
              <Text style={{ fontWeight: '900', fontSize: 13, color: filter === f ? '#0f172a' : '#94a3b8', textTransform: 'capitalize' }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {loading ? (
          <ActivityIndicator size="large" color="#6d28d9" style={{ marginTop: 100 }} />
        ) : (
          wishes.map(wish => (
            <View key={wish.id} style={{ backgroundColor: '#ffffff', borderRadius: 25, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#f1f5f9' }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f8fafc', paddingBottom: 15, marginBottom: 15 }}>
                  <View>
                     <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{wish.contacts.name}</Text>
                     <Text style={{ fontSize: 10, fontWeight: '900', color: '#6d28d9', letterSpacing: 2 }}>{wish.occasion_type.toUpperCase()}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: statusMap[wish.status].bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                     {statusMap[wish.status].icon}
                     <Text style={{ fontSize: 10, fontWeight: '900', color: statusMap[wish.status].color, textTransform: 'capitalize' }}>{wish.status}</Text>
                  </View>
               </View>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                     <Text style={{ fontSize: 14, fontWeight: '800' }}>{format(new Date(wish.scheduled_datetime), 'MMM do, yyyy')}</Text>
                     <Text style={{ fontSize: 12, fontWeight: '600', color: '#94a3b8' }}>{format(new Date(wish.scheduled_datetime), 'h:mm a')}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setConfirmDelete(wish.id)} style={{ padding: 12, backgroundColor: '#fef2f2', borderRadius: 15 }}>
                     <Trash2 color="#ef4444" size={18} />
                  </TouchableOpacity>
               </View>
            </View>
          ))
        )}
      </ScrollView>

      {confirmDelete && (
        <Modal transparent visible animationType="fade">
           <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', padding: 30 }}>
              <View style={{ backgroundColor: '#ffffff', borderRadius: 30, padding: 30, alignItems: 'center' }}>
                 <TrashIcon size={30} color="#ef4444" />
                 <Text style={{ fontSize: 24, fontWeight: '900', marginTop: 15 }}>Delete Wish?</Text>
                 <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 10 }}>The scheduled wish will be permanently removed.</Text>
                 <View style={{ flexDirection: 'row', gap: 15, marginTop: 30, width: '100%' }}>
                    <TouchableOpacity onPress={() => setConfirmDelete(null)} style={{ flex: 1, padding: 18, borderRadius: 15, backgroundColor: '#f1f5f9', alignItems: 'center' }}>
                       <Text style={{ fontWeight: '900', color: '#64748b' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={deleteWish} style={{ flex: 1, padding: 18, borderRadius: 15, backgroundColor: '#ef4444', alignItems: 'center' }}>
                       <Text style={{ fontWeight: '900', color: '#ffffff' }}>Delete</Text>
                    </TouchableOpacity>
                 </View>
              </View>
           </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}
