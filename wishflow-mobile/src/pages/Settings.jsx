import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Phone, CheckCircle2, QrCode, Clipboard, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // WhatsApp State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [waStatus, setWaStatus] = useState('offline');
  const [waLoading, setWaLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);

  useEffect(() => {
    fetchProfile();
    setupSocket();
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      setPhoneNumber(data.mobile || '');
      setWaStatus(data.whatsapp_connected ? 'connected' : 'offline');
    }
    setLoading(false);
  };

  const setupSocket = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Explicitly enforce websockets to prevent Render 400 pooling errors
    const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false
    });

    socket.on('connect', () => {
      socket.emit('register', user.id);
    });

    socket.on('whatsapp_status', (data) => {
      setWaStatus(data.status);
      setWaLoading(data.status === 'initializing');
      if (data.status === 'connected') {
        const fetchP = async () => {
          await supabase.from('users').update({ whatsapp_connected: true }).eq('id', user.id);
        };
        fetchP();
        setPairingCode('');
      } else if (data.status === 'error') {
        setErrorStatus(data.message || 'Failed to connect. Make sure using exact number format.');
        setWaLoading(false);
      }
    });

    socket.on('whatsapp_pairing_code', (data) => {
      setPairingCode(data.code);
      setWaStatus('pairing');
      setWaLoading(false);
    });

    return () => socket.disconnect();
  };

  const connectWhatsAppWithPhone = async () => {
    if (!phoneNumber) return alert("Please enter your WhatsApp phone number");
    setWaLoading(true);
    setWaStatus('connecting');
    setPairingCode('');
    setErrorStatus(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      await axios.post(`${API_URL}/api/integrations/whatsapp/pair-phone`, {
        userId: user.id,
        phoneNumber: phoneNumber
      });
    } catch (err) {
      setErrorStatus("Failed to initiate pairing: " + err.message);
      setWaLoading(false);
      setWaStatus('offline');
    }
  };

  const copyToClipboard = async () => {
    if (navigator.clipboard) {
       await navigator.clipboard.writeText(pairingCode);
       alert("Copied to clipboard!");
    }
  };

  if (loading) return <div className="p-10 text-center text-white/50">Loading settings...</div>;

  return (
    <div className="container mx-auto px-4 py-8 pb-32">
      <h1 className="text-3xl font-black text-white mb-8">Settings</h1>

      <div className="space-y-6">
        <h2 className="text-xs font-black uppercase tracking-widest text-white/50 px-2 block">Integrations</h2>

        {/* WhatsApp Integration Block */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex items-center space-x-4 mb-6">
             <div className="w-12 h-12 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#25D366]/30">
                <Phone size={24} />
             </div>
             <div>
                <h2 className="text-lg font-black text-white">WhatsApp</h2>
                <div className="flex items-center space-x-1.5 mt-0.5">
                   {waStatus === 'connected' ? (
                      <><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs font-bold uppercase tracking-widest text-green-400">Connected Active</span></>
                   ) : waStatus === 'initializing' || waStatus === 'connecting' ? (
                      <><Loader2 className="animate-spin text-yellow-500" size={12} /><span className="text-xs font-bold uppercase tracking-widest text-yellow-400">Connecting...</span></>
                   ) : waStatus === 'pairing' ? (
                      <><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /><span className="text-xs font-bold uppercase tracking-widest text-blue-400">Awaiting Code</span></>
                   ) : (
                      <><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-bold uppercase tracking-widest text-red-400">Not Connected</span></>
                   )}
                </div>
             </div>
          </div>

          {errorStatus && (
             <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-4 rounded-2xl mb-6 text-sm flex items-start space-x-2">
                <AlertCircle size={16} className="mt-0.5 min-w-[16px]" />
                <p>{errorStatus}</p>
             </div>
          )}

          {waStatus === 'offline' && (
             <div className="space-y-4">
                <div>
                   <label className="text-xs font-bold text-white/60 mb-2 block uppercase tracking-wider">WhatsApp Phone Number</label>
                   <input 
                      type="tel" 
                      value={phoneNumber} 
                      onChange={e => setPhoneNumber(e.target.value)} 
                      placeholder="+91..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-lg focus:outline-none focus:border-[#25D366]/50"
                   />
                </div>
                <button 
                   onClick={connectWhatsAppWithPhone}
                   disabled={waLoading || !phoneNumber}
                   className="w-full bg-white text-[#25D366] font-black py-4 rounded-2xl active:scale-95 transition-transform flex items-center justify-center space-x-2 disabled:opacity-50"
                >
                   {waLoading ? <Loader2 className="animate-spin" size={20} /> : <Phone size={20} />}
                   <span>Link WhatsApp</span>
                </button>
             </div>
          )}

          {waStatus === 'pairing' && pairingCode && (
             <div className="bg-slate-900/50 rounded-[2rem] p-8 text-center border border-white/10">
                <QrCode size={40} className="mx-auto text-white/20 mb-4" />
                <h3 className="text-sm font-black text-white/60 uppercase tracking-widest mb-6">Pairing Code</h3>
                <div className="text-5xl font-mono font-black tracking-[0.2em] text-white mb-6 bg-white/5 p-4 rounded-2xl">
                   {pairingCode}
                </div>
                
                <ol className="text-left text-sm text-white/70 space-y-3 font-medium mb-6">
                  <li className="flex space-x-2"><span className="text-brand-rose">1.</span><span>Open WhatsApp on your phone</span></li>
                  <li className="flex space-x-2"><span className="text-brand-rose">2.</span><span>Tap Settings &gt; Linked Devices</span></li>
                  <li className="flex space-x-2"><span className="text-brand-rose">3.</span><span>Tap 'Link a Device'</span></li>
                  <li className="flex space-x-2"><span className="text-brand-rose">4.</span><span>Tap 'Link with phone number instead'</span></li>
                  <li className="flex space-x-2"><span className="text-brand-rose">5.</span><span>Enter the 8-character code above</span></li>
                </ol>

                <button onClick={copyToClipboard} className="w-full bg-brand-rose text-white py-4 rounded-2xl font-bold flex items-center justify-center space-x-2 active:scale-95 transition-transform">
                   <Clipboard size={18} />
                   <span>Copy Code</span>
                </button>
             </div>
          )}

          {waStatus === 'connected' && (
             <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-[2rem] text-center">
                <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
                   <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black text-white mb-2">WhatsApp is Ready</h3>
                <p className="text-sm text-white/60 font-medium">Your automated wishes will now be delivered via your WhatsApp account.</p>
             </div>
          )}
          
          <div className="absolute top-[-100px] right-[-100px] w-[200px] h-[200px] bg-[#25D366]/10 rounded-full blur-3xl pointer-events-none" />
        </div>

      </div>
    </div>
  );
}
