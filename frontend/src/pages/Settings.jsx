import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User, Bell, Settings as SettingsIcon, Shield, Instagram, Phone, Key, HelpCircle } from 'lucide-react';

const Settings = () => {
  const [profile, setProfile] = useState({ name: '', email: '', whatsapp_api_key: '', instagram_access_token: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) setProfile({ ...data, email: user.email });
    setLoading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('users').upsert({
      id: user.id,
      name: profile.name,
      whatsapp_api_key: profile.whatsapp_api_key,
      instagram_access_token: profile.instagram_access_token
    });
    
    if (!error) alert('Settings updated!');
    else alert(error.message);
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-12">Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-2">
          <button className="w-full flex items-center space-x-3 p-4 bg-white rounded-2xl border border-brand-rose/20 text-brand-rose font-bold">
            <User size={20} />
            <span>Profile Details</span>
          </button>
          <button className="w-full flex items-center space-x-3 p-4 hover:bg-white rounded-2xl text-slate-500 font-bold transition-colors">
            <Bell size={20} />
            <span>Notifications</span>
          </button>
          <button className="w-full flex items-center space-x-3 p-4 hover:bg-white rounded-2xl text-slate-500 font-bold transition-colors">
            <Shield size={20} />
            <span>Privacy & Security</span>
          </button>
          <button className="w-full flex items-center space-x-3 p-4 hover:bg-white rounded-2xl text-slate-500 font-bold transition-colors">
            <HelpCircle size={20} />
            <span>Help Center</span>
          </button>
        </div>

        <div className="lg:col-span-2">
          <form onSubmit={handleUpdate} className="space-y-8">
            <div className="card space-y-6">
              <h2 className="text-xl font-black text-slate-900">Connections</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2 px-2 uppercase tracking-widest flex items-center">
                    <Phone size={14} className="mr-2" />
                    WhatsApp CallMeBot API Key
                  </label>
                  <input 
                    type="text" className="input-field font-mono text-sm" placeholder="Your API Key"
                    value={profile.whatsapp_api_key || ''}
                    onChange={e => setProfile({...profile, whatsapp_api_key: e.target.value})}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 px-2 leading-relaxed">
                    Message <span className="font-bold text-slate-600">+34 644 45 70 57</span> with <span className="italic font-bold">"I allow callmebot to send me messages"</span> to get your free key instantly.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2 px-2 uppercase tracking-widest flex items-center">
                    <Instagram size={14} className="mr-2" />
                    Meta Instagram Access Token
                  </label>
                  <input 
                    type="password" className="input-field font-mono text-sm" placeholder="Meta Graph API Token"
                    value={profile.instagram_access_token || ''}
                    onChange={e => setProfile({...profile, instagram_access_token: e.target.value})}
                  />
                  <p className="text-[10px] text-slate-400 mt-2 px-2 leading-relaxed">
                    1. Go to <a href="https://developers.facebook.com/apps/958735563279395" target="_blank" className="underline text-brand-rose">App Dashboard</a>. 2. Click "Add Product" and set up "Messenger". 3. Connect your IG account in Settings.
                  </p>
                </div>
              </div>
            </div>

            <div className="card space-y-6">
              <h2 className="text-xl font-black text-slate-900">Personal Info</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2 px-2 uppercase tracking-widest">Full Name</label>
                  <input 
                    type="text" className="input-field" placeholder="Pawan Kumar"
                    value={profile.name || ''}
                    onChange={e => setProfile({...profile, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-2 px-2 uppercase tracking-widest">Email Address</label>
                  <input type="email" className="input-field bg-slate-100 cursor-not-allowed" value={profile.email || ''} disabled />
                </div>
              </div>
            </div>

            <button type="submit" className="btn-primary w-full shadow-xl">
              Save All Changes
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
