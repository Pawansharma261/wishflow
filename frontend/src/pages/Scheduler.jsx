import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Calendar, MessageSquare, ChevronRight, ChevronLeft, Check, Wand2 } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import Confetti from 'react-confetti';

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
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState({ whatsapp_connected: false, instagram_access_token: null });

  const [formData, setFormData] = useState({
    contact_id: '',
    occasion_type: 'birthday',
    wish_message: '',
    scheduled_datetime: '',
    channels: ['whatsapp'],
    is_recurring: false,
    recurrence_rule: 'YEARLY'
  });

  useEffect(() => {
    fetchData();
  }, []);
  
  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Fetch profile
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) setProfile(userData);

    const { data } = await supabase.from('contacts').select('*');
    if (data) setContacts(data);
    setLoading(false);
  };

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

    setFormData({ ...formData, wish_message: templates[formData.occasion_type] || `Happy ${formData.occasion_type}, ${name}! ✨ Wishing you the very best.` });
  };

  const handleSubmit = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Ensure the datetime is specifically converted from local browser time to a UTC ISO string for accurate background cron execution
    const utcScheduledDate = new Date(formData.scheduled_datetime).toISOString();

    const { error } = await supabase.from('wishes').insert({
      ...formData,
      scheduled_datetime: utcScheduledDate,
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
      <div className="flex justify-between mb-12 relative px-2">
        <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 -z-10" />
        {[1, 2, 3, 4].map((s) => (
          <div 
            key={s} 
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
              step >= s ? 'bg-gradient-brand text-white shadow-lg' : 'bg-white text-slate-300 border border-slate-100'
            }`}
          >
            {step > s ? <Check size={18} /> : s}
          </div>
        ))}
      </div>

      <div className="card p-10 min-h-[500px] flex flex-col">
        {step === 1 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-3xl font-black mb-2">Select Contact</h2>
              <p className="text-slate-500 font-medium">Who are we celebrating today?</p>
            </div>
            
            <div className="grid grid-cols-1 gap-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
              {contacts.map(c => (
                <button
                  key={c.id}
                  onClick={() => setFormData({...formData, contact_id: c.id})}
                  className={`flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all ${
                    formData.contact_id === c.id ? 'border-brand-rose bg-brand-rose/5' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-600">
                    {c.name[0]}
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500 uppercase font-black tracking-widest">{c.relationship}</p>
                  </div>
                </button>
              ))}
              {contacts.length === 0 && (
                <div className="text-center py-10">
                   <p className="text-slate-400 mb-4">You have no contacts yet.</p>
                   <button onClick={() => navigate('/contacts')} className="btn-secondary">Add New Contact</button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-3xl font-black mb-2">The Occasion</h2>
              <p className="text-slate-500 font-medium">What's the big event?</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {occasions.map(occ => (
                <button
                  key={occ.id}
                  onClick={() => setFormData({...formData, occasion_type: occ.id})}
                  className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all ${
                    formData.occasion_type === occ.id ? 'border-brand-rose bg-brand-rose/5' : 'border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <span className="text-3xl mb-2">{occ.emoji}</span>
                  <span className={`text-xs font-bold ${formData.occasion_type === occ.id ? 'text-brand-rose' : 'text-slate-500'}`}>{occ.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-black mb-2">Your Message</h2>
                <p className="text-slate-500 font-medium">Make it personal and warm.</p>
              </div>
              <button 
                onClick={suggestMessage}
                className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors flex items-center space-x-2 font-bold text-sm"
              >
                <Wand2 size={18} />
                <span>AI Suggest</span>
              </button>
            </div>
            <textarea 
              className="input-field h-48 resize-none p-6 text-lg"
              placeholder="Start writing your heart out..."
              value={formData.wish_message}
              onChange={e => setFormData({...formData, wish_message: e.target.value})}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 animate-fade-in">
            <div>
              <h2 className="text-3xl font-black mb-2">Final Details</h2>
              <p className="text-slate-500 font-medium">When and where should we send it?</p>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-2 px-2 uppercase tracking-widest">Delivery Date & Time</label>
                <input 
                  type="datetime-local" className="input-field h-14"
                  value={formData.scheduled_datetime}
                  onChange={e => setFormData({...formData, scheduled_datetime: e.target.value})}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-3 px-2 uppercase tracking-widest">Notification Channels</label>
                <div className="flex flex-wrap gap-4">
                  {[
                    { id: 'whatsapp', label: 'WhatsApp', connected: profile.whatsapp_connected },
                    { id: 'instagram', label: 'Instagram', connected: !!profile.instagram_access_token },
                    { id: 'push', label: 'Push', connected: true } // Push is always 'setup' by browser permission
                  ].map(ch => (
                    <div key={ch.id} className="flex-1 min-w-[150px]">
                      <label className={`flex items-center space-x-3 p-4 rounded-xl cursor-pointer border transition-all ${
                        formData.channels.includes(ch.id) ? 'bg-slate-50 border-brand-rose/40' : 'bg-white border-slate-100 hover:border-slate-200'
                      }`}>
                        <input 
                          type="checkbox" 
                          checked={formData.channels.includes(ch.id)}
                          onChange={(e) => {
                            const newChannels = e.target.checked 
                              ? [...formData.channels, ch.id]
                              : formData.channels.filter(c => c !== ch.id);
                            setFormData({...formData, channels: newChannels});
                          }}
                          className="w-5 h-5 accent-brand-rose"
                        />
                        <div>
                          <p className="font-bold text-slate-700 text-sm">{ch.label}</p>
                          <div className="flex items-center space-x-1 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${ch.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className={`text-[9px] font-black uppercase tracking-widest ${ch.connected ? 'text-green-600' : 'text-red-500'}`}>
                              {ch.connected ? 'Connected' : 'Offline'}
                            </span>
                          </div>
                        </div>
                      </label>
                      {!ch.connected && (
                        <Link to="/settings" className="text-[10px] text-brand-rose font-bold block mt-1 px-1 hover:underline">Connect now →</Link>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-100/50 rounded-2xl border border-slate-200">
                <div>
                   <h4 className="font-bold text-slate-900">Repeat Yearly</h4>
                   <p className="text-xs text-slate-500">Auto-schedule for next year once sent.</p>
                </div>
                <button 
                  onClick={() => setFormData({...formData, is_recurring: !formData.is_recurring})}
                  className={`w-14 h-8 rounded-full transition-all relative ${formData.is_recurring ? 'bg-brand-rose' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all ${formData.is_recurring ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-auto pt-10 flex items-center justify-between">
          <button 
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className={`flex items-center space-x-2 font-bold ${step === 1 ? 'text-slate-200' : 'text-slate-400 hover:text-slate-900'}`}
          >
            <ChevronLeft size={20} />
            <span>Go Back</span>
          </button>
          
          {step < 4 ? (
            <button 
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !formData.contact_id}
              className="btn-primary flex items-center space-x-2 px-10"
            >
              <span>Continue</span>
              <ChevronRight size={20} />
            </button>
          ) : (
            <button 
              onClick={handleSubmit}
              className="btn-primary flex items-center space-x-2 px-10"
            >
              <span>Schedule Wish</span>
              <Sparkles size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Scheduler;
