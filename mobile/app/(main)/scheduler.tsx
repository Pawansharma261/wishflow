import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Check, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

const OCCASIONS = [
  { id: 'birthday', name: 'Birthday', emoji: '🎂' },
  { id: 'valentine', name: 'Valentine', emoji: '💝' },
  { id: 'diwali', name: 'Diwali', emoji: '🪔' },
  { id: 'christmas', name: 'Christmas', emoji: '🎄' },
  { id: 'eid', name: 'Eid', emoji: '🌙' },
  { id: 'holi', name: 'Holi', emoji: '🌈' },
  { id: 'new_year', name: 'New Year', emoji: '🎆' },
  { id: 'custom', name: 'Custom', emoji: '✨' },
];

export default function Scheduler() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    contact_id: '',
    occasion_type: 'birthday',
    wish_message: '',
    scheduled_datetime: '',
    channels: ['whatsapp'] as string[],
    is_recurring: false,
    recurrence_rule: 'YEARLY',
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) setProfile(userData);
    const { data: contactsData } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (contactsData) setContacts(contactsData);
    setLoading(false);
  };

  const suggestMessage = async () => {
    const contact = contacts.find(c => c.id === formData.contact_id);
    const name = contact?.name || 'friend';
    const templates: Record<string, string> = {
      birthday: `Happy Birthday, ${name}! 🎂 Hope your day is as amazing as you are. Wishing you a year full of love and success!`,
      valentine: `Happy Valentine's Day, ${name}! 💖 You make my world a better place. Sending you lots of love today!`,
      diwali: `Wishing you and your family a very Happy Diwali, ${name}! 🪔 May this festival of lights bring prosperity and joy.`,
      christmas: `Merry Christmas, ${name}! 🎄 Sending you warm wishes and holiday cheer. Have a magical season!`,
      new_year: `Happy New Year, ${name}! 🎆 May 2026 be your best year yet. Let's make it unforgettable!`,
    };
    setFormData({ ...formData, wish_message: templates[formData.occasion_type] || `Happy ${formData.occasion_type}, ${name}! ✨ Wishing you the very best.` });
  };

  const handleSubmit = async () => {
    if (!formData.scheduled_datetime) { Alert.alert('Please set a delivery date & time'); return; }
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const utcDate = new Date(formData.scheduled_datetime).toISOString();
    const { error } = await supabase.from('wishes').insert({ ...formData, scheduled_datetime: utcDate, user_id: user.id });
    if (!error) { setSuccess(true); setTimeout(() => { setSuccess(false); setStep(1); setFormData({ contact_id: '', occasion_type: 'birthday', wish_message: '', scheduled_datetime: '', channels: ['whatsapp'], is_recurring: false, recurrence_rule: 'YEARLY' }); }, 2500); }
    else Alert.alert('Error', error.message);
    setSubmitting(false);
  };

  const toggleChannel = (id: string) => {
    setFormData(prev => ({ ...prev, channels: prev.channels.includes(id) ? prev.channels.filter(c => c !== id) : [...prev.channels, id] }));
  };

  const canContinue = step === 1 ? !!formData.contact_id : step === 3 ? !!formData.wish_message.trim() : true;

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#ec4899" /></SafeAreaView>;

  if (success) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 36, padding: 48, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Check size={40} color="#22c55e" />
        </View>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#0f172a', marginBottom: 8 }}>Wish Scheduled!</Text>
        <Text style={{ color: '#64748b', fontWeight: '600', textAlign: 'center' }}>We'll send your greetings automatically on time. ✨</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Progress Steps */}
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff', marginBottom: 16 }}>Schedule Wish</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {[1, 2, 3, 4].map(s => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: step >= s ? '#ec4899' : 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  {step > s ? <Check size={16} color="#fff" /> : <Text style={{ color: step >= s ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '900', fontSize: 14 }}>{s}</Text>}
                </View>
                {s < 4 && <View style={{ height: 2, flex: 1, backgroundColor: step > s ? '#ec4899' : 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />}
              </View>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', minHeight: 380 }}>

            {/* Step 1: Contact */}
            {step === 1 && (
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 6 }}>Select Contact</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 }}>Who are we celebrating today?</Text>
                {contacts.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>You have no contacts yet.</Text>
                    <TouchableOpacity onPress={() => router.push('/contacts')} style={{ backgroundColor: '#ec4899', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 }}>
                      <Text style={{ color: '#fff', fontWeight: '900' }}>Add New Contact</Text>
                    </TouchableOpacity>
                  </View>
                ) : contacts.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => setFormData({ ...formData, contact_id: c.id })} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, marginBottom: 10, borderWidth: 2, borderColor: formData.contact_id === c.id ? '#ec4899' : 'rgba(255,255,255,0.1)', backgroundColor: formData.contact_id === c.id ? 'rgba(236,72,153,0.1)' : 'transparent' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffffff' }}>{c.name[0]}</Text>
                    </View>
                    <View>
                      <Text style={{ fontWeight: '800', color: '#ffffff', fontSize: 15 }}>{c.name}</Text>
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }}>{c.relationship}</Text>
                    </View>
                    {formData.contact_id === c.id && <View style={{ marginLeft: 'auto' }}><Check size={20} color="#ec4899" /></View>}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Step 2: Occasion */}
            {step === 2 && (
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 6 }}>The Occasion</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 }}>What's the big event?</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {OCCASIONS.map(occ => (
                    <TouchableOpacity key={occ.id} onPress={() => setFormData({ ...formData, occasion_type: occ.id })} style={{ width: '46%', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 2, borderColor: formData.occasion_type === occ.id ? '#ec4899' : 'rgba(255,255,255,0.1)', backgroundColor: formData.occasion_type === occ.id ? 'rgba(236,72,153,0.1)' : 'transparent' }}>
                      <Text style={{ fontSize: 30, marginBottom: 6 }}>{occ.emoji}</Text>
                      <Text style={{ fontWeight: '800', color: formData.occasion_type === occ.id ? '#ec4899' : 'rgba(255,255,255,0.7)', fontSize: 13 }}>{occ.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Step 3: Message */}
            {step === 3 && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View><Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 4 }}>Your Message</Text><Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Make it personal and warm.</Text></View>
                  <TouchableOpacity onPress={suggestMessage} style={{ backgroundColor: 'rgba(99,102,241,0.2)', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' }}>
                    <Sparkles size={14} color="#818cf8" />
                    <Text style={{ color: '#818cf8', fontWeight: '900', fontSize: 12 }}>AI Suggest</Text>
                  </TouchableOpacity>
                </View>
                <TextInput value={formData.wish_message} onChangeText={t => setFormData({ ...formData, wish_message: t })} placeholder="Start writing your heart out..." placeholderTextColor="rgba(255,255,255,0.3)" multiline style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 16, color: '#ffffff', fontSize: 16, minHeight: 180, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontWeight: '500' }} />
              </View>
            )}

            {/* Step 4: Schedule & Channels */}
            {step === 4 && (
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 6 }}>Final Details</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 }}>When and where should we send it?</Text>
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Delivery Date & Time</Text>
                <TextInput value={formData.scheduled_datetime} onChangeText={t => setFormData({ ...formData, scheduled_datetime: t })} placeholder="YYYY-MM-DDTHH:MM (e.g. 2025-04-25T10:00)" placeholderTextColor="rgba(255,255,255,0.3)" style={{ backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#ffffff', fontWeight: '600', marginBottom: 20, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Notification Channels</Text>
                {[
                  { id: 'whatsapp', label: 'WhatsApp', connected: !!profile.whatsapp_connected },
                  { id: 'instagram', label: 'Instagram', connected: !!profile.instagram_access_token },
                ].map(ch => (
                  <TouchableOpacity key={ch.id} onPress={() => toggleChannel(ch.id)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1.5, borderColor: formData.channels.includes(ch.id) ? '#ec4899' : 'rgba(255,255,255,0.1)', backgroundColor: formData.channels.includes(ch.id) ? 'rgba(236,72,153,0.08)' : 'transparent' }}>
                    <View>
                      <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>{ch.label}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ch.connected ? '#22c55e' : '#ef4444' }} />
                        <Text style={{ color: ch.connected ? '#4ade80' : '#ef4444', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{ch.connected ? 'Connected' : 'Offline'}</Text>
                      </View>
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: formData.channels.includes(ch.id) ? '#ec4899' : 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                      {formData.channels.includes(ch.id) && <Check size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => setFormData(prev => ({ ...prev, is_recurring: !prev.is_recurring }))} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 18, padding: 18, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                  <View><Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Repeat Yearly</Text><Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>Auto-schedule for next year once sent.</Text></View>
                  <View style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: formData.is_recurring ? '#ec4899' : 'rgba(255,255,255,0.15)', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: formData.is_recurring ? 'flex-end' : 'flex-start' }} />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Navigation Buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <TouchableOpacity onPress={() => setStep(s => s - 1)} disabled={step === 1} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: step === 1 ? 0.3 : 1 }}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.6)" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '800' }}>Go Back</Text>
            </TouchableOpacity>
            {step < 4 ? (
              <TouchableOpacity onPress={() => setStep(s => s + 1)} disabled={!canContinue} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: canContinue ? '#ec4899' : 'rgba(255,255,255,0.1)', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20 }}>
                <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Continue</Text>
                <ChevronRight size={18} color="#fff" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#ec4899', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20 }}>
                {submitting ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 15 }}>Schedule Wish</Text><Sparkles size={16} color="#fff" /></>}
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
