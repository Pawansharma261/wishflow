import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Plus, Users, Trash2, Edit2, Phone, Instagram, Calendar, X } from 'lucide-react-native';
import { format } from 'date-fns';

const RELATIONSHIPS = ['friend', 'family', 'partner', 'colleague'];

const emptyForm = { name: '', relationship: 'friend', phone_number: '', instagram_username: '', birthday: '', anniversary: '', callmebot_api_key: '' };

export default function Contacts() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
      if (error) throw error;
      if (data) setContacts(data);
    } catch (err) {
      console.warn('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (contact: any) => {
    setFormData({
      name: contact.name || '',
      relationship: contact.relationship || 'friend',
      phone_number: contact.phone_number || '',
      instagram_username: contact.instagram_username || '',
      birthday: contact.birthday ? contact.birthday.substring(0, 10) : '',
      anniversary: contact.anniversary ? contact.anniversary.substring(0, 10) : '',
      callmebot_api_key: contact.callmebot_api_key || '',
    });
    setEditingId(contact.id);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditingId(null); setFormData({ ...emptyForm }); };

  const handleSave = async () => {
    if (!formData.name.trim()) { Alert.alert('Name is required'); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (editingId) {
      await supabase.from('contacts').update(formData).eq('id', editingId);
    } else {
      await supabase.from('contacts').insert({ ...formData, user_id: user.id });
    }
    setSaving(false);
    closeModal();
    fetchContacts();
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    await supabase.from('contacts').delete().eq('id', contactToDelete);
    setContactToDelete(null);
    fetchContacts();
  };

  const filtered = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const inputStyle = { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#ffffff', fontWeight: '600' as const, marginBottom: 12, fontSize: 15 };
  const labelStyle = { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900' as const, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 6, marginTop: 4 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 30, fontWeight: '900', color: '#ffffff' }}>My Contacts</Text>
        <TouchableOpacity onPress={() => setShowModal(true)} style={{ backgroundColor: '#ec4899', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 }}>
          <Plus size={18} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={{ marginHorizontal: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingHorizontal: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
        <Search size={18} color="rgba(255,255,255,0.4)" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search contacts..." placeholderTextColor="rgba(255,255,255,0.3)" style={{ flex: 1, height: 48, paddingHorizontal: 10, color: '#ffffff', fontWeight: '600' }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {loading ? <ActivityIndicator size="large" color="#ec4899" style={{ marginTop: 60 }} /> : filtered.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Users size={48} color="rgba(255,255,255,0.2)" />
            <Text style={{ color: 'rgba(255,255,255,0.4)', fontWeight: '600', marginTop: 16 }}>No contacts yet</Text>
            <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 13, marginTop: 4 }}>Add your first contact to get started!</Text>
          </View>
        ) : filtered.map(contact => (
          <View key={contact.id} style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 24, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(236,72,153,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#ec4899' }}>{contact.name[0]}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => handleEdit(contact)} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><Edit2 size={16} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
                <TouchableOpacity onPress={() => setContactToDelete(contact.id)} style={{ padding: 8, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12 }}><Trash2 size={16} color="#ef4444" /></TouchableOpacity>
              </View>
            </View>
            <Text style={{ fontSize: 17, fontWeight: '900', color: '#ffffff', marginBottom: 4 }}>{contact.name}</Text>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, marginBottom: 12 }}>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{contact.relationship}</Text>
            </View>
            <View style={{ gap: 6 }}>
              {contact.phone_number ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Phone size={13} color="rgba(255,255,255,0.4)" /><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{contact.phone_number}</Text></View> : null}
              {contact.instagram_username ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Instagram size={13} color="rgba(255,255,255,0.4)" /><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>@{contact.instagram_username}</Text></View> : null}
              {contact.birthday ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Calendar size={13} color="rgba(255,255,255,0.4)" /><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>🎂 {format(new Date(contact.birthday), 'MMM do')}</Text></View> : null}
              {contact.anniversary ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Calendar size={13} color="rgba(255,255,255,0.4)" /><Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>💍 {format(new Date(contact.anniversary), 'MMM do')}</Text></View> : null}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: '#1a1740', padding: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff' }}>{editingId ? 'Edit Contact' : 'Add New Contact'}</Text>
              <TouchableOpacity onPress={closeModal} style={{ padding: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12 }}><X size={20} color="rgba(255,255,255,0.6)" /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={labelStyle}>Full Name *</Text>
              <TextInput value={formData.name} onChangeText={t => setFormData({ ...formData, name: t })} placeholder="Full Name" placeholderTextColor="rgba(255,255,255,0.3)" style={inputStyle} />
              <Text style={labelStyle}>Relationship</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                {RELATIONSHIPS.map(r => (
                  <TouchableOpacity key={r} onPress={() => setFormData({ ...formData, relationship: r })} style={{ paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: formData.relationship === r ? '#ec4899' : 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: formData.relationship === r ? '#ec4899' : 'rgba(255,255,255,0.15)' }}>
                    <Text style={{ color: '#ffffff', fontWeight: '900', textTransform: 'capitalize' }}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={labelStyle}>WhatsApp Number</Text>
              <TextInput value={formData.phone_number} onChangeText={t => setFormData({ ...formData, phone_number: t })} placeholder="+91 98765 43210" placeholderTextColor="rgba(255,255,255,0.3)" style={inputStyle} keyboardType="phone-pad" />
              <Text style={labelStyle}>Instagram Username</Text>
              <TextInput value={formData.instagram_username} onChangeText={t => setFormData({ ...formData, instagram_username: t })} placeholder="without @" placeholderTextColor="rgba(255,255,255,0.3)" style={inputStyle} autoCapitalize="none" />
              <Text style={labelStyle}>Birthday (YYYY-MM-DD)</Text>
              <TextInput value={formData.birthday} onChangeText={t => setFormData({ ...formData, birthday: t })} placeholder="e.g. 1995-04-25" placeholderTextColor="rgba(255,255,255,0.3)" style={inputStyle} />
              <Text style={labelStyle}>Anniversary (YYYY-MM-DD)</Text>
              <TextInput value={formData.anniversary} onChangeText={t => setFormData({ ...formData, anniversary: t })} placeholder="e.g. 2020-06-10" placeholderTextColor="rgba(255,255,255,0.3)" style={inputStyle} />
              <Text style={labelStyle}>CallMeBot API Key (optional)</Text>
              <TextInput value={formData.callmebot_api_key} onChangeText={t => setFormData({ ...formData, callmebot_api_key: t })} placeholder="Fallback messaging key" placeholderTextColor="rgba(255,255,255,0.2)" style={{ ...inputStyle, color: 'rgba(255,255,255,0.5)' }} />
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, paddingBottom: 30 }}>
                <TouchableOpacity onPress={closeModal} style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
                  <Text style={{ color: '#ffffff', fontWeight: '900' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSave} disabled={saving} style={{ flex: 1, backgroundColor: '#ec4899', borderRadius: 20, paddingVertical: 16, alignItems: 'center' }}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#ffffff', fontWeight: '900' }}>{editingId ? 'Save Edits' : 'Save Contact'}</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={!!contactToDelete} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#ffffff', borderRadius: 28, padding: 28, width: '100%', alignItems: 'center' }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 size={32} color="#ef4444" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '900', marginBottom: 8 }}>Delete Contact?</Text>
            <Text style={{ color: '#64748b', textAlign: 'center', marginBottom: 24 }}>This contact will be permanently removed. Scheduled wishes may fail.</Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <TouchableOpacity onPress={() => setContactToDelete(null)} style={{ flex: 1, backgroundColor: '#f1f5f9', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: '#475569' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmDelete} style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ fontWeight: '800', color: '#ffffff' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
