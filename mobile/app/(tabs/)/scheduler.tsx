import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { supabase } from '../../src/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Users, MessageSquare, Send, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react-native';
import axios from 'axios';

export default function Scheduler() {
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [occasion, setOccasion] = useState('birthday');
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [channels, setChannels] = useState(['whatsapp']);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (data) setContacts(data);
  };

  const generateAI = async () => {
    if (!selectedContact) return;
    setAiLoading(true);
    try {
      const { data } = await axios.post('https://wishflow-backend-uyd2.onrender.com/api/ai/suggest', {
        occasion_type: occasion,
        recipient_name: selectedContact.name
      });
      setMessage(data.suggestion);
    } catch (e) {
      alert('AI generator is offline. Typing manually...');
    }
    setAiLoading(false);
  };

  const handleSchedule = async () => {
    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    // Auto-calculate next date based on birthday if not provided
    let finalDate = date;
    if (!finalDate && occasion === 'birthday' && selectedContact.birthday) {
        finalDate = new Date(selectedContact.birthday);
        finalDate.setFullYear(new Date().getFullYear());
        if (finalDate < new Date()) finalDate.setFullYear(finalDate.getFullYear() + 1);
    }

    const { error } = await supabase.from('wishes').insert([{
      user_id: user.id,
      contact_id: selectedContact.id,
      occasion_type: occasion,
      scheduled_datetime: finalDate || new Date().toISOString(),
      message_content: message,
      channels,
      status: 'pending'
    }]);

    if (!error) setStep(5);
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <View style={{ padding: 20, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ fontSize: 32, fontWeight: '900', color: '#0f172a' }}>Wizard</Text>
              <Text style={{ fontSize: 13, color: '#94a3b8', fontWeight: '700' }}>Step {step} of 4</Text>
            </View>
            <View style={{ width: 60, height: 60, backgroundColor: '#6d28d9', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
               <Sparkles color="#ffffff" size={28} />
            </View>
         </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 30 }}>
        {step === 1 && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 25 }}>Select someone special</Text>
            <View style={{ gap: 15 }}>
              {contacts.map(c => (
                <TouchableOpacity key={c.id} onPress={() => { setSelectedContact(c); setStep(2); }} style={{ backgroundColor: '#ffffff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: selectedContact?.id === c.id ? '#6d28d9' : '#f1f5f9' }}>
                   <Text style={{ fontSize: 18, fontWeight: '800' }}>{c.name}</Text>
                   <Text style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{c.phone}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {step === 2 && (
          <View>
            <TouchableOpacity onPress={() => setStep(1)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
               <ChevronLeft size={16} color="#94a3b8" />
               <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Back to Contacts</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 25 }}>What's the occasion?</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
               {['birthday', 'anniversary', 'christmas', 'new_year', 'custom'].map(o => (
                 <TouchableOpacity key={o} onPress={() => { setOccasion(o); setStep(3); }} style={{ paddingHorizontal: 20, paddingVertical: 15, borderRadius: 15, backgroundColor: occasion === o ? '#6d28d9' : '#ffffff', borderWidth: 1, borderColor: '#f1f5f9' }}>
                    <Text style={{ fontWeight: '900', color: occasion === o ? '#ffffff' : '#0f172a', textTransform: 'capitalize' }}>{o.replace('_', ' ')}</Text>
                 </TouchableOpacity>
               ))}
            </View>
          </View>
        )}

        {step === 3 && (
          <View>
            <TouchableOpacity onPress={() => setStep(2)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 20 }}>
               <ChevronLeft size={16} color="#94a3b8" />
               <Text style={{ color: '#94a3b8', fontWeight: '700' }}>Back to Occasion</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 10 }}>Message Content</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20, fontWeight: '600' }}>Draft your heartfelt wish or let AI help.</Text>

            <TouchableOpacity onPress={generateAI} disabled={aiLoading} style={{ backgroundColor: '#f5f3ff', padding: 15, borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#6d28d9', alignItems: 'center', marginBottom: 20 }}>
               {aiLoading ? (
                 <ActivityIndicator size="small" color="#6d28d9" />
               ) : (
                 <Text style={{ color: '#6d28d9', fontWeight: '900' }}>✨ Generate AI Wish</Text>
               )}
            </TouchableOpacity>

            <TextInput 
              multiline 
              value={message} 
              onChangeText={setMessage} 
              style={{ height: 180, backgroundColor: '#ffffff', borderRadius: 25, padding: 25, fontSize: 16, textAlignVertical: 'top', borderWidth: 1, borderColor: '#f1f5f9', fontWeight: '500' }} 
              placeholder="Start typing your wish here..."
            />

            <TouchableOpacity onPress={() => setStep(4)} disabled={!message} style={{ backgroundColor: '#6d28d9', height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 30, opacity: message ? 1 : 0.5 }}>
               <Text style={{ color: '#ffffff', fontWeight: '900' }}>Next Step</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 4 && (
          <View>
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 25 }}>Automation Settings</Text>
            <View style={{ backgroundColor: '#ffffff', padding: 25, borderRadius: 30, borderWidth: 1, borderColor: '#f1f5f9' }}>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800' }}>Recipient</Text>
                  <Text style={{ color: '#6d28d9', fontWeight: '900' }}>{selectedContact?.name}</Text>
               </View>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800' }}>Occasion</Text>
                  <Text style={{ textTransform: 'capitalize', fontWeight: '800', color: '#64748b' }}>{occasion}</Text>
               </View>
               <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 16, fontWeight: '800' }}>Channel</Text>
                  <View style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                     <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 10 }}>WHATSAPP</Text>
                  </View>
               </View>
            </View>

            <TouchableOpacity 
              onPress={handleSchedule} 
              disabled={submitting}
              style={{ backgroundColor: '#6d28d9', height: 75, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginTop: 40, shadowColor: '#6d28d9', shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 }}
            >
               {submitting ? <ActivityIndicator color="#ffffff" /> : <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>Lock & Automate 🚀</Text>}
            </TouchableOpacity>
          </View>
        )}

        {step === 5 && (
          <View style={{ alignItems: 'center', marginTop: 50 }}>
             <View style={{ width: 80, height: 80, borderRadius: 30, backgroundColor: '#f0fdf4', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <CheckCircle2 color="#22c55e" size={40} />
             </View>
             <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a' }}>Locked & Ready!</Text>
             <Text style={{ fontSize: 14, color: '#64748b', textAlign: 'center', marginTop: 10, fontWeight: '500', lineHeight: 22 }}>Your wish has been scheduled and will be sent automatically. You don't need to do anything else.</Text>
             <TouchableOpacity onPress={() => { setStep(1); setSelectedContact(null); setMessage(''); }} style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 20, marginTop: 40 }}>
                <Text style={{ fontWeight: '900', color: '#475569' }}>Create Another</Text>
             </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
