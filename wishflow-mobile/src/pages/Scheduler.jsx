import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Users, Check, Wand2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Confetti from 'react-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { Contacts as CapacitorContacts } from '@capacitor-community/contacts';
import { io } from 'socket.io-client';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

const occasions = [
  { id: 'birthday', name: 'Birthday', emoji: '🎂' },
  { id: 'valentine', name: 'Valentine', emoji: '💝' },
  { id: 'diwali', name: 'Diwali', emoji: '🪔' },
  { id: 'christmas', name: 'Christmas', emoji: '🎄' },
  { id: 'eid', name: 'Eid', emoji: '🌙' },
  { id: 'holi', name: 'Holi', emoji: '🌈' },
  { id: 'new_year', name: 'New Year', emoji: '🎆' },
  { id: 'custom', name: 'Custom', emoji: '✨' },
];

const Scheduler = () => {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [userId, setUserId] = useState(null);
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({ whatsapp_connected: false, instagram_access_token: null });

  const [formData, setFormData] = useState({
    contact_id: '',
    occasion_type: 'birthday',
    message: '',          // DB column is now 'message'
    scheduled_for: '',    // DB column is now 'scheduled_for'
    channels: ['whatsapp'],
    is_recurring: false,
    recurrence_rule: 'YEARLY'
  });

  // REALTIME SYNC: Refresh data when anything changes on different devices
  useRealtimeSync({
    userId,
    onUserChange: () => fetchData(),
    onContactsChange: () => fetchData(),
  });

  useEffect(() => {
    fetchData();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const setupSocket = async (userId) => {
    if (socketRef.current) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
    const socket = io(BACKEND_URL, { 
      transports: ['websocket'], 
      upgrade: false 
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      // AUTH HARDENING: Register with session token
      socket.emit('register', { userId, token: session.access_token });
    });

    socket.on('whatsapp_status', (data) => {
      console.log('[WS:MobileScheduler] Status:', data.status);
      
      // STABILITY FIX: Keep 'connected' status stable during transient blips
      if (data.status === 'connected') {
        setProfile(prev => ({ ...prev, whatsapp_connected: true }));
      } else if (data.status === 'disconnected') {
        const logoutReasons = [401, '401', 'loggedOut'];
        // Only flip to offline if it's an actual logout/disconnect, not just a minor reset
        if (logoutReasons.includes(data.reason)) {
           setProfile(prev => ({ ...prev, whatsapp_connected: false }));
        }
      }
    });
  };
  
  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    // Setup realtime status sync
    setupSocket(user.id);

    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) setProfile(userData);

    // FIX: Scope contacts to current user
    const { data } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (data) setContacts(data);
    setLoading(false);
  };

  const syncPhoneContacts = async () => {
    try {
       setSyncing(true);
       const permission = await CapacitorContacts.requestPermissions();
       if (permission.contacts !== 'granted') {
          return alert("Contacts permission is required to import from phone.");
       }
       
       const { contacts: phoneContacts } = await CapacitorContacts.getContacts({
          projection: { name: true, phones: true }
       });

       const { data: { user } } = await supabase.auth.getUser();
       
       // Map to DB schema
       const newContacts = phoneContacts
       .filter(c => c.name?.display && c.phones?.length > 0)
       .map(c => ({
          user_id: user.id,
          name: c.name.display,
          phone_number: c.phones[0].number.replace(/[^0-9+]/g, ''),
          relationship: 'friend'
       }));

       if (newContacts.length > 0) {
          // Bulk Upsert by name + phone (or avoid duplicates manually)
          const { error } = await supabase.from('contacts').upsert(newContacts, { onConflict: 'user_id,phone_number' });
          if (!error) {
             alert(`Successfully synced ${newContacts.length} contacts!`);
             fetchData();
          } else {
             console.error("Upsert Error:", error);
          }
       }
    } catch (err) {
       alert(err.message);
    } finally {
       setSyncing(false);
    }
  };

  const filteredContacts = contacts.filter(c => 
     c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.relationship.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const suggestMessage = () => {
    const contact = contacts.find(c => c.id === formData.contact_id);
    const name = contact ? contact.name : 'friend';
    const rel = contact ? contact.relationship : 'friend';
    
    const templates = {
      birthday: `Happy Birthday, ${name}! 🎂 Hope your day is as amazing as you are. Wishing you a year full of love and success!`,
      valentine: `Happy Valentine's Day, ${name}! 💖 You make my world a better place. Sending you lots of love today!`,
      diwali: `Wishing you and your family a very Happy Diwali, ${name}! 🪔 May this festival of lights bring prosperity and joy to your life.`,
      christmas: `Merry Christmas, ${name}! 🎄 Sending you warm wishes and holiday cheer. Have a magical season!`,
      new_year: `Happy New Year, ${name}! 🎆 May 2026 be your best year yet. Let's make it unforgettable!`,
    };

    setFormData({ ...formData, message: templates[formData.occasion_type] || `Happy ${formData.occasion_type}, ${name}! ✨ Wishing you the very best.` });
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Ensure the datetime is specifically converted from local browser time to a UTC ISO string for accurate background cron execution
    const utcScheduledDate = new Date(formData.scheduled_for).toISOString();

    const contact = contacts.find(c => c.id === formData.contact_id);

    const { error } = await supabase.from('wishes').insert({
      ...formData,
      contact_name: contact?.name,
      contact_phone: contact?.phone,
      scheduled_for: utcScheduledDate,
      user_id: user.id
    });
    
    if (!error) {
      setSuccess(true);
      setTimeout(() => navigate('/wishes'), 3000);
    } else {
      alert(error.message);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Confetti width={window.innerWidth} height={window.innerHeight} recycle={false} />
        <div className="bg-white rounded-[3rem] p-12 text-center shadow-2xl animate-bounce-slow">
           <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={48} />
           </div>
           <h2 className="text-4xl font-black mb-4">Wish Scheduled!</h2>
           <p className="text-slate-500 font-medium">We'll send your greetings automatically on time. ✨</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      {/* Progress Bar */}
      <div className="flex justify-between mb-10 relative px-2">
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 -translate-y-1/2 -z-10" />
        {[1, 2, 3, 4].map((s) => (
          <div 
            key={s} 
            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black transition-all duration-500 shadow-2xl ${
              step >= s ? 'bg-gradient-brand text-white shadow-brand-rose/20' : 'bg-white/5 text-white/10 border border-white/5'
            }`}
          >
            {step > s ? <Check size={20} /> : s}
          </div>
        ))}
      </div>

      <div className="bg-[#0f0c29]/50 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 shadow-2xl min-h-[500px] flex flex-col overflow-hidden relative">
        <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6 flex-grow"
          >
            <div className="flex items-center justify-between mb-2">
               <div>
                  <h2 className="text-3xl font-black text-white">Contact</h2>
                  <p className="text-white/40 text-sm font-medium">Who are we celebrating?</p>
               </div>
               <button 
                  onClick={syncPhoneContacts}
                  disabled={syncing}
                  className="bg-brand-rose/10 text-brand-rose p-3 rounded-2xl flex items-center space-x-2 text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
               >
                  {syncing ? <div className="w-4 h-4 border-2 border-brand-rose border-t-transparent animate-spin rounded-full" /> : <Users size={16} />}
                  <span>{syncing ? 'Syncing...' : 'Sync Phone'}</span>
               </button>
            </div>

            <div className="relative">
               <input 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:outline-none focus:border-brand-rose/50 transition-all font-medium"
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
               />
               <Sparkles className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20" size={16} />
            </div>
            
            <div className="grid grid-cols-1 gap-3 max-h-72 overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
              {filteredContacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => setFormData({...formData, contact_id: c.id})}
                  className={`flex items-center space-x-4 p-4 rounded-3xl border-2 transition-all group ${
                    formData.contact_id === c.id 
                    ? 'border-brand-rose bg-brand-rose/10 bg-white/5' 
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-lg ${
                    formData.contact_id === c.id ? 'bg-brand-rose text-white shadow-brand-rose/20' : 'bg-white/10 text-white/60'
                  }`}>
                    {c.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-black text-white text-sm">{c.name}</p>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest mt-0.5">{c.relationship}</p>
                  </div>
                  {formData.contact_id === c.id && (
                     <div className="ml-auto w-6 h-6 bg-brand-rose rounded-full flex items-center justify-center text-white scale-110 animate-fade-in shadow-lg shadow-brand-rose/20">
                        <Check size={14} />
                     </div>
                  )}
                </button>
              ))}
              {filteredContacts.length === 0 && (
                <div className="text-center py-10 bg-white/5 rounded-3xl border border-white/5">
                   <p className="text-white/20 text-sm font-medium mb-5">No contacts found.</p>
                   <button onClick={() => navigate('/contacts')} className="bg-white/10 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all">Add New</button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 animate-fade-in"
          >
            <div>
              <h2 className="text-3xl font-black text-white">Occasion</h2>
              <p className="text-white/40 text-sm font-medium">What's the celebration about?</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {occasions.map(occ => (
                <button
                  key={occ.id}
                  onClick={() => setFormData({...formData, occasion_type: occ.id})}
                  className={`flex flex-col items-center justify-center p-6 rounded-3xl border-2 transition-all active:scale-95 ${
                    formData.occasion_type === occ.id 
                    ? 'border-brand-rose bg-brand-rose/10 bg-white/5' 
                    : 'border-white/5 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <span className="text-4xl mb-3 drop-shadow-lg">{occ.emoji}</span>
                  <span className={`text-[11px] font-black uppercase tracking-widest ${formData.occasion_type === occ.id ? 'text-brand-rose' : 'text-white/40'}`}>{occ.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 animate-fade-in flex flex-col h-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black text-white">Message</h2>
                <p className="text-white/40 text-sm font-medium">Keep it warm and personal.</p>
              </div>
              <button 
                onClick={suggestMessage}
                className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl flex items-center space-x-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/10 active:scale-90 transition-all border border-indigo-500/20"
              >
                <Wand2 size={16} />
                <span>AI</span>
              </button>
            </div>
            <textarea 
              className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-lg focus:outline-none focus:border-brand-rose/50 transition-all font-medium h-64 resize-none leading-relaxed"
              placeholder="Tell them something beautiful..."
              value={formData.message}
              onChange={e => setFormData({...formData, message: e.target.value})}
            />
          </motion.div>
        )}

        {step === 4 && (
          <motion.div 
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8 animate-fade-in"
          >
            <div>
              <h2 className="text-3xl font-black text-white">Details</h2>
              <p className="text-white/40 text-sm font-medium">Delivery and channel setup.</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-[10px] font-black text-white/30 block mb-3 px-1 uppercase tracking-[0.2em]">Delivery Date & Time</label>
                <input 
                  type="datetime-local" 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-black [color-scheme:dark]"
                  value={formData.scheduled_for}
                  onChange={e => setFormData({...formData, scheduled_for: e.target.value})}
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-white/30 block mb-4 px-1 uppercase tracking-[0.2em]">Channels</label>
                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'whatsapp', label: 'WhatsApp', connected: profile.whatsapp_connected },
                    { id: 'instagram', label: 'Instagram', connected: !!profile.instagram_access_token },
                    { id: 'push', label: 'Push', connected: true }
                  ].map(ch => (
                    <label key={ch.id} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer border transition-all active:scale-[0.98] ${
                      formData.channels.includes(ch.id) ? 'bg-white/10 border-brand-rose/40' : 'bg-white/5 border-white/5'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <input 
                          type="checkbox" 
                          checked={formData.channels.includes(ch.id)}
                          onChange={(e) => {
                            const newChannels = e.target.checked 
                              ? [...formData.channels, ch.id]
                              : formData.channels.filter(c => c !== ch.id);
                            setFormData({...formData, channels: newChannels});
                          }}
                          className="w-5 h-5 accent-brand-rose rounded-lg"
                        />
                        <div>
                          <p className="font-black text-white text-sm">{ch.label}</p>
                          <div className="flex items-center space-x-1.5 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${ch.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${ch.connected ? 'text-green-500' : 'text-red-500'}`}>
                              {ch.connected ? 'Ready' : 'Setup Required'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {!ch.connected && (
                        <Link to="/settings" className="text-[10px] bg-red-500/10 text-red-500 px-3 py-1.5 rounded-xl font-black uppercase tracking-widest active:scale-95">Link →</Link>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-5 bg-white/5 rounded-3xl border border-white/5 border-dashed">
                <div>
                   <h4 className="font-black text-white text-sm">Recurring</h4>
                   <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest mt-1">Send Every Year</p>
                </div>
                <button 
                  onClick={() => setFormData({...formData, is_recurring: !formData.is_recurring})}
                  className={`w-14 h-8 rounded-full transition-all relative shadow-lg ${formData.is_recurring ? 'bg-brand-rose shadow-brand-rose/30' : 'bg-white/10'}`}
                >
                  <div className={`absolute top-1.5 w-5 h-5 bg-white rounded-full transition-all ${formData.is_recurring ? 'left-7.5' : 'left-1.5'}`} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>

        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
          <button 
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className={`flex items-center space-x-2 font-black text-xs uppercase tracking-[0.2em] transition-all ${step === 1 ? 'text-white/10' : 'text-white/40 hover:text-white'}`}
          >
            <ChevronLeft size={18} />
            <span>Back</span>
          </button>
          
          {step < 4 ? (
            <button 
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !formData.contact_id}
              className="bg-white text-[#0f0c29] font-black text-xs uppercase tracking-[0.2em] px-8 py-4 rounded-2xl active:scale-95 transition-all shadow-xl shadow-white/5 disabled:opacity-20 flex items-center space-x-2"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="bg-brand-rose text-white font-black text-xs uppercase tracking-[0.2em] px-8 py-4 rounded-2xl active:scale-95 transition-all shadow-xl shadow-brand-rose/20 flex items-center space-x-2 animate-pulse"
            >
              <Sparkles size={16} />
              <span>Schedule</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scheduler;
