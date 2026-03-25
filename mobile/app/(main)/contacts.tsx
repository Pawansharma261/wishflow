import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, User, Calendar, Trash2 } from 'lucide-react-native';
import { format } from 'date-fns';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', birthday: '', anniversary: '' });

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (data) setContacts(data);
    setLoading(false);
  };

  const handleAdd = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('contacts').insert([{ ...newContact, user_id: user.id }]);
    if (!error) { setShowAdd(false); fetchContacts(); }
  };

  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a' }}>Contacts</Text>
          <TouchableOpacity onPress={() => setShowAdd(true)} style={{ backgroundColor: '#6d28d9', width: 50, height: 50, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}><Plus color="#ffffff" size={24} /></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 15, paddingHorizontal: 15 }}><Search size={20} color="#94a3b8" /><TextInput value={search} onChangeText={setSearch} placeholder="Search circles..." style={{ flex: 1, height: 50, paddingHorizontal: 10, fontSize: 16, fontWeight: '600' }} /></View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20 }}>{loading ? <ActivityIndicator size="large" color="#6d28d9" style={{ marginTop: 50 }} /> : filtered.map(c => (<View key={c.id} style={{ backgroundColor: '#ffffff', borderRadius: 25, padding: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#f1f5f9' }}><View style={{ width: 60, height: 60, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}><User color="#3b82f6" size={24} /></View><View style={{ flex: 1 }}><Text style={{ fontSize: 18, fontWeight: '800' }}>{c.name}</Text><Text style={{ fontSize: 12, color: '#64748b' }}>{c.phone}</Text></View></View>))}</ScrollView>
      <Modal visible={showAdd} animationType="slide"><View style={{ flex: 1, padding: 30 }}><Text style={{ fontSize: 24, fontWeight: '900', marginBottom: 30 }}>Add Contact</Text><TextInput placeholder="Name" value={newContact.name} onChangeText={t => setNewContact({...newContact, name: t})} style={{ height: 60, backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 20, marginBottom: 15 }} /><TextInput placeholder="Phone" value={newContact.phone} onChangeText={t => setNewContact({...newContact, phone: t})} style={{ height: 60, backgroundColor: '#f8fafc', borderRadius: 15, paddingHorizontal: 20, marginBottom: 30 }} /><TouchableOpacity onPress={handleAdd} style={{ backgroundColor: '#6d28d9', height: 65, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#ffffff', fontWeight: '900' }}>Save</Text></TouchableOpacity><TouchableOpacity onPress={() => setShowAdd(false)} style={{ marginTop: 20, alignItems: 'center' }}><Text style={{ color: '#ef4444' }}>Close</Text></TouchableOpacity></View></Modal>
    </SafeAreaView>
  );
}
