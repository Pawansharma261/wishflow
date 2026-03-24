import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiClient } from '../lib/apiClient';
import { User, Bell, Shield, Instagram, Phone, Key, HelpCircle, Loader, CheckCircle2, QrCode } from 'lucide-react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

const Settings = () => {
  const [profile, setProfile] = useState({ name: '', email: '', whatsapp_connected: false, instagram_connected: false });
  const [loading, setLoading] = useState(true);

  // WhatsApp State
  const [waLoading, setWaLoading] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [waStatus, setWaStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected', 'qr_ready'
  
  const socketRef = useRef(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    fetchProfile();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user.id);
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) setProfile({ ...data, email: user.email });
    setLoading(false);
    
    // Initialize WebSockets
    initSocket(user.id);
  };

  const initSocket = (uid) => {
    if (socketRef.current) return;
    
    // Pass standard polling/websocket config for better compatibility
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      socket.emit('register', uid);
    });

    socket.on('whatsapp_qr', async (data) => {
      console.log('Received WhatsApp QR');
      try {
        const url = await QRCode.toDataURL(data.qr, { margin: 2, scale: 8, color: { dark: '#1e1b4b', light: '#ffffff' } });
        setQrCodeDataUrl(url);
        setWaStatus('qr_ready');
        setWaLoading(false);
      } catch (err) {
        console.error('Error rendering QR:', err);
      }
    });

    socket.on('whatsapp_status', (data) => {
      console.log('WhatsApp Status:', data.status);
      setWaStatus(data.status); // 'connected', 'disconnected', etc.
      if (data.status === 'connected') {
        setProfile(p => ({ ...p, whatsapp_connected: true }));
        setWaLoading(false);
        setQrCodeDataUrl('');
      } else if (data.status === 'disconnected') {
        setProfile(p => ({ ...p, whatsapp_connected: false }));
      }
    });
  };

  const connectWhatsApp = async () => {
    setWaLoading(true);
    setWaStatus('connecting');
    try {
      const res = await apiClient.post('/api/integrations/whatsapp/connect', { userId });
      if (res.error) throw new Error(res.error);
      // The rest is handled by websockets
    } catch (err) {
      alert('Failed to initiate connection. Please try again.');
      setWaLoading(false);
      setWaStatus('disconnected');
    }
  };

  const connectInstagram = async () => {
    try {
      const res = await apiClient.get('/api/integrations/instagram/oauth');
      if (res.error) throw new Error(res.error);
      window.location.href = res.url || res.data?.url;
    } catch (err) {
      alert('Failed to get Instagram OAuth URL');
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('users').upsert({
      id: userId,
      name: profile.name,
    });
    if (!error) alert('Settings updated!');
    else alert(error.message);
  };

  if (loading) return <div className="text-center py-20 text-white/50">Loading settings...</div>;

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-10">Settings</h1>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        <div className="xl:col-span-1 space-y-2">
          <button className="w-full flex items-center space-x-3 p-4 bg-white/10 rounded-2xl border border-white/20 text-white font-bold transition-all">
            <User size={20} /><span>Account</span>
          </button>
          <button className="w-full flex items-center space-x-3 p-4 hover:bg-white/5 rounded-2xl text-white/50 font-bold transition-all">
            <Bell size={20} /><span>Notifications</span>
          </button>
          <button className="w-full flex items-center space-x-3 p-4 hover:bg-white/5 rounded-2xl text-white/50 font-bold transition-all">
            <Shield size={20} /><span>Privacy</span>
          </button>
        </div>

        <div className="xl:col-span-3 space-y-8">
          
          {/* Messaging Integrations */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6">Messaging Integrations</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* WhatsApp (Baileys) Panel */}
              <div className="bg-[#1e1e38] rounded-3xl p-6 border border-white/10 relative overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl" />
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <Phone className="text-green-500" size={20} />
                    </div>
                    <h3 className="font-bold text-white text-lg">WhatsApp</h3>
                  </div>
                  
                  {waStatus === 'connected' ? (
                    <span className="flex items-center space-x-1.5 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 size={14} /><span>Connected</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1.5 bg-white/10 text-white/50 px-3 py-1 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-white/30" /><span>Disconnected</span>
                    </span>
                  )}
                </div>

                <p className="text-white/50 text-sm mb-6 flex-1 relative z-10">
                  Connect your real WhatsApp account to send wishes directly from your phone number. WishFlow acts as a linked companion device.
                </p>

                <div className="mt-auto relative z-10">
                  {waStatus === 'connected' ? (
                    <button onClick={connectWhatsApp} className="w-full bg-white/10 text-white font-bold py-3.5 rounded-2xl hover:bg-white/20 transition-all text-sm border border-white/20">
                      Reconnect Device
                    </button>
                  ) : waStatus === 'qr_ready' && qrCodeDataUrl ? (
                    <div className="flex flex-col items-center p-4 bg-white rounded-2xl">
                      <img src={qrCodeDataUrl} alt="WhatsApp QR Code" className="w-48 h-48 mb-3" />
                      <p className="text-slate-800 font-bold text-sm text-center">Scan with WhatsApp</p>
                      <p className="text-slate-500 text-xs text-center mt-1">Linked Devices → Link a Device</p>
                    </div>
                  ) : (
                    <button 
                      onClick={connectWhatsApp} 
                      disabled={waLoading}
                      className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3.5 rounded-2xl transition-all shadow-lg shadow-green-900/50 flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                    >
                      {waLoading ? <Loader size={18} className="animate-spin" /> : <QrCode size={18} />}
                      <span>{waLoading ? 'Generating QR...' : 'Generate Connection QR'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Instagram (Meta) Panel */}
              <div className="bg-[#1e1e38] rounded-3xl p-6 border border-white/10 relative overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-xl flex items-center justify-center opacity-80">
                      <Instagram className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white text-lg">Instagram</h3>
                  </div>
                  
                  {profile.instagram_connected ? (
                    <span className="flex items-center space-x-1.5 bg-pink-500/20 text-pink-400 px-3 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 size={14} /><span>Connected</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1.5 bg-white/10 text-white/50 px-3 py-1 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-white/30" /><span>Disconnected</span>
                    </span>
                  )}
                </div>

                <p className="text-white/50 text-sm mb-6 flex-1 relative z-10">
                  Connect your Instagram Professional/Creator account via Meta Graph API to send direct messages to your followers.
                </p>

                <div className="mt-auto relative z-10">
                  <button 
                    onClick={connectInstagram}
                    className="w-full bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold py-3.5 rounded-2xl hover:scale-[1.02] transition-all shadow-lg shadow-pink-900/50 text-sm"
                  >
                    Connect with Facebook
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Profile Details */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6">Personal Details</h2>
            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1 block mb-2">Display Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-[#1e1e38] border border-white/20 rounded-2xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all font-medium"
                    placeholder="Your Name"
                    value={profile.name || ''}
                    onChange={e => setProfile({...profile, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest pl-1 block mb-2">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full bg-white/5 border border-transparent rounded-2xl px-4 py-3.5 text-white/50 cursor-not-allowed font-medium" 
                    value={profile.email || ''} 
                    disabled 
                  />
                </div>
              </div>
              <div className="pt-2">
                <button type="submit" className="bg-white/10 border border-white/20 text-white font-bold py-3 px-8 rounded-2xl hover:bg-white/20 transition-all">
                  Save Changes
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings;
