import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, KeyboardAvoidingView, Platform, Alert, Image } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Check, Sparkles, Cloud, Users, PlusCircle } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Contacts from 'expo-contacts';

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
  const [contactsList, setContactsList] = useState<any[]>([]);
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
    if (!user) { setLoading(false); return; }
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) setProfile(userData);
    const { data: contactsData } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (contactsData) setContactsList(contactsData);
    setLoading(false);
  };

  const handlePickPhoneContact = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'WishFlow needs access to your contacts to select a friend.');
        return;
      }

      // Native contact picker (iOS/Android native UI)
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact) return; // User cancelled

      if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
        Alert.alert('No Phone Number', `${contact.name} does not have a phone number saved.`);
        return;
      }

      setLoading(true);
      const phoneNumber = contact.phoneNumbers[0].number;
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Create contact in our database
      const { data: newContact, error } = await supabase.from('contacts').insert({
        user_id: user.id,
        name: contact.name,
        relationship: 'friend', // default
        phone_number: phoneNumber
      }).select().single();

      if (error) {
        throw error;
      }

      // Update UI List and select them
      setContactsList(prev => [newContact, ...prev].sort((a,b) => a.name.localeCompare(b.name)));
      setFormData({ ...formData, contact_id: newContact.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not import contact.');
    } finally {
      setLoading(false);
    }
  };

  const suggestMessage = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const contact = contactsList.find(c => c.id === formData.contact_id);
    const name = contact?.name || 'friend';
    const templates: Record<string, string> = {
      birthday: `Happy Birthday, ${name}! 🎂 I hope your day is as wonderful as you are. Sending you love and warm wishes — wishing you a year full of joy and beautiful moments!`,
      valentine: `Happy Valentine's Day, ${name}! 💖 You make my heart smile every single day. Sending you all my love today and always!`,
      diwali: `Wishing you and your loved ones a very Happy Diwali, ${name}! 🪔 May this festival of lights fill your home with happiness, prosperity, and peace.`,
      christmas: `Merry Christmas, ${name}! 🎄 Sending you the warmest holiday wishes and lots of love. May this season bring you joy and beautiful memories!`,
      new_year: `Happy New Year, ${name}! 🎆 I hope 2026 brings you everything your heart desires. Here's to health, happiness, and incredible adventures ahead!`,
      eid: `Eid Mubarak, ${name}! 🌙 May Allah bless you and your family with happiness, health, and prosperity. Wishing you a joyful celebration!`,
      holi: `Happy Holi, ${name}! 🌈 May your life be as colorful and joyful as this beautiful festival. Wishing you love, laughter, and lots of colors!`,
      custom: `Hey ${name}! ✨ Just wanted to reach out and let you know you are appreciated. Wishing you a wonderful day filled with happiness!`,
    };
    setFormData({ ...formData, wish_message: templates[formData.occasion_type] || templates.custom });
  };

  const handleSubmit = async () => {
    if (!formData.scheduled_datetime) { Alert.alert('Missing Date', 'Please set a delivery date and time for your wish.'); return; }
    if (!formData.wish_message.trim()) { Alert.alert('Missing Message', 'Please write a personal message for your friend.'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const utcDate = new Date(formData.scheduled_datetime).toISOString();
    const { error } = await supabase.from('wishes').insert({ ...formData, scheduled_datetime: utcDate, user_id: user.id });
    if (!error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false); setStep(1);
        setFormData({ contact_id: '', occasion_type: 'birthday', wish_message: '', scheduled_datetime: '', channels: ['whatsapp'], is_recurring: false, recurrence_rule: 'YEARLY' });
      }, 2800);
    } else {
      Alert.alert('Error', error.message);
    }
    setSubmitting(false);
  };

  const goToStep = (nextStep: number) => {
    Haptics.selectionAsync();
    setStep(nextStep);
  };

  const toggleChannel = (id: string) => {
    Haptics.selectionAsync();
    setFormData(prev => ({ ...prev, channels: prev.channels.includes(id) ? prev.channels.filter(c => c !== id) : [...prev.channels, id] }));
  };

  const canContinue = step === 1 ? !!formData.contact_id : step === 3 ? !!formData.wish_message.trim() : true;

  if (loading) return <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#ec4899" /></SafeAreaView>;

  if (success) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29', justifyContent: 'center', alignItems: 'center', padding: 30 }}>
      <View style={{ backgroundColor: '#ffffff', borderRadius: 36, padding: 44, alignItems: 'center', width: '100%' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
          <Check size={40} color="#22c55e" />
        </View>
        <Text style={{ fontSize: 26, fontWeight: '900', color: '#0f172a', marginBottom: 8 }}>Wish Scheduled! 🎉</Text>
        <Text style={{ color: '#64748b', fontWeight: '600', textAlign: 'center', lineHeight: 22, marginBottom: 20 }}>
          Your personal message is queued on our secure cloud servers. It will be delivered automatically — even if your phone is off.
        </Text>
        <View style={{ backgroundColor: '#f1f5f9', borderRadius: 16, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Cloud size={18} color="#6d28d9" />
          <Text style={{ color: '#475569', fontSize: 12, flex: 1 }}>No action needed. Our server handles delivery on time. ✅</Text>
        </View>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f0c29' }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#ffffff', marginBottom: 16 }}>Schedule a Wish</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {[1, 2, 3, 4].map((s, i) => (
              <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: step >= s ? '#ec4899' : 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                  {step > s ? <Check size={16} color="#fff" /> : <Text style={{ color: step >= s ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: '900', fontSize: 14 }}>{s}</Text>}
                </View>
                {i < 3 && <View style={{ height: 2, flex: 1, backgroundColor: step > s ? '#ec4899' : 'rgba(255,255,255,0.1)', marginHorizontal: 4 }} />}
              </View>
            ))}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 28, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', minHeight: 380 }}>

            {/* Step 1: Select Contact */}
            {step === 1 && (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 4 }}>Who are you celebrating?</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>Pick a friend or family member.</Text>
                  </View>
                  <TouchableOpacity onPress={handlePickPhoneContact} style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(236,72,153,0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(236,72,153,0.3)' }}>
                    <PlusCircle size={24} color="#ec4899" />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={handlePickPhoneContact} style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', marginBottom: 20 }}>
                  <Users size={20} color="rgba(255,255,255,0.6)" />
                  <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Pick from Phone Contacts</Text>
                </TouchableOpacity>

                {contactsList.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>You have no saved contacts yet. Tap the button above to import one.</Text>
                  </View>
                ) : contactsList.map(c => (
                  <TouchableOpacity key={c.id} onPress={() => { Haptics.selectionAsync(); setFormData({ ...formData, contact_id: c.id }); }} style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 18, marginBottom: 10, borderWidth: 2, borderColor: formData.contact_id === c.id ? '#ec4899' : 'rgba(255,255,255,0.1)', backgroundColor: formData.contact_id === c.id ? 'rgba(236,72,153,0.1)' : 'transparent' }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: '#ffffff' }}>{c.name[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: '#ffffff', fontSize: 15 }}>{c.name}</Text>
                      {c.phone_number && <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '600', marginTop: 3 }}>{c.phone_number}</Text>}
                    </View>
                    {formData.contact_id === c.id && <Check size={20} color="#ec4899" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Step 2: Occasion */}
            {step === 2 && (
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 4 }}>What's the Occasion?</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 }}>Choose the celebration you'd like to mark.</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {OCCASIONS.map(occ => (
                    <TouchableOpacity key={occ.id} onPress={() => { Haptics.selectionAsync(); setFormData({ ...formData, occasion_type: occ.id }); }} style={{ width: '46%', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 2, borderColor: formData.occasion_type === occ.id ? '#ec4899' : 'rgba(255,255,255,0.1)', backgroundColor: formData.occasion_type === occ.id ? 'rgba(236,72,153,0.1)' : 'transparent' }}>
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
                  <View>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 4 }}>Your Personal Message</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>A heartfelt, individual message just for them.</Text>
                  </View>
                  <TouchableOpacity onPress={suggestMessage} style={{ backgroundColor: 'rgba(99,102,241,0.2)', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)' }}>
                    <Sparkles size={14} color="#818cf8" />
                    <Text style={{ color: '#818cf8', fontWeight: '900', fontSize: 12 }}>Suggest</Text>
                  </TouchableOpacity>
                </View>
                <TextInput value={formData.wish_message} onChangeText={t => setFormData({ ...formData, wish_message: t })} placeholder="Write something personal and warm..." placeholderTextColor="rgba(255,255,255,0.3)" multiline style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 16, color: '#ffffff', fontSize: 16, minHeight: 180, textAlignVertical: 'top', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', fontWeight: '500', lineHeight: 24 }} />
                <Text style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 }}>💡 Keep it personal — this is a one-on-one message to your friend.</Text>
              </View>
            )}

            {/* Step 4: Delivery */}
            {step === 4 && (
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#ffffff', marginBottom: 4 }}>Delivery Details</Text>
                <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '600', marginBottom: 20 }}>When and how should we send it?</Text>

                <View style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: 16, padding: 14, marginBottom: 18, flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' }}>
                  <Cloud size={15} color="#818cf8" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 18, fontWeight: '600' }}>
                    Your phone doesn't need to be on. Our servers deliver your wish on time, automatically. 🌐
                  </Text>
                </View>

                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8 }}>Delivery Date & Time</Text>
                <TextInput value={formData.scheduled_datetime} onChangeText={t => setFormData({ ...formData, scheduled_datetime: t })} placeholder="YYYY-MM-DDTHH:MM  (e.g. 2025-04-25T10:00)" placeholderTextColor="rgba(255,255,255,0.3)" style={{ backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: '#ffffff', fontWeight: '600', marginBottom: 20, fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }} />

                <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 }}>Send Via</Text>
                {[
                  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬', connected: !!profile.whatsapp_connected },
                  { id: 'instagram', label: 'Instagram DM', emoji: '📸', connected: !!profile.instagram_access_token },
                ].map(ch => (
                  <TouchableOpacity key={ch.id} onPress={() => toggleChannel(ch.id)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 18, marginBottom: 10, borderWidth: 1.5, borderColor: formData.channels.includes(ch.id) ? '#ec4899' : 'rgba(255,255,255,0.1)', backgroundColor: formData.channels.includes(ch.id) ? 'rgba(236,72,153,0.08)' : 'transparent' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Text style={{ fontSize: 22 }}>{ch.emoji}</Text>
                      <View>
                        <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>{ch.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: ch.connected ? '#22c55e' : '#ef4444' }} />
                          <Text style={{ color: ch.connected ? '#4ade80' : '#ef4444', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' }}>{ch.connected ? 'Connected' : 'Not Connected'}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: formData.channels.includes(ch.id) ? '#ec4899' : 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }}>
                      {formData.channels.includes(ch.id) && <Check size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setFormData(prev => ({ ...prev, is_recurring: !prev.is_recurring })); }} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: 18, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                  <View>
                    <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 15 }}>Repeat Yearly 🔄</Text>
                    <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 2 }}>Auto-schedule again next year once sent.</Text>
                  </View>
                  <View style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: formData.is_recurring ? '#ec4899' : 'rgba(255,255,255,0.12)', justifyContent: 'center', paddingHorizontal: 3 }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignSelf: formData.is_recurring ? 'flex-end' : 'flex-start' }} />
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Navigation */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <TouchableOpacity onPress={() => goToStep(step - 1)} disabled={step === 1} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, opacity: step === 1 ? 0.25 : 1 }}>
              <ChevronLeft size={20} color="rgba(255,255,255,0.6)" />
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontWeight: '800' }}>Back</Text>
            </TouchableOpacity>
            {step < 4 ? (
              <TouchableOpacity onPress={() => canContinue && goToStep(step + 1)} disabled={!canContinue} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: canContinue ? '#ec4899' : 'rgba(255,255,255,0.1)', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20, opacity: canContinue ? 1 : 0.5 }}>
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
