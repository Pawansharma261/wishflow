import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Phone, CheckCircle2, QrCode, Clipboard, AlertCircle, Loader2, Settings as SettingsIcon } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // WhatsApp State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [waStatus, setWaStatus] = useState('offline');
  const [waLoading, setWaLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState(null);
  const [pairingStatus, setPairingStatus] = useState(''); // Extra status text

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
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    
    // Explicitly enforce websockets to prevent Render 400 pooling errors
    const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      upgrade: false
    });

    socket.on('connect', () => {
      // AUTH HARDENING: Pass token to verify identity
      socket.emit('register', { userId: user.id, token: session.access_token });
    });

    socket.on('whatsapp_status', (data) => {
      // Don't let background status updates (like 'connecting') overwrite our ready-to-pair screen
      if (waStatus === 'pairing_code_ready' && (data.status === 'connecting' || data.status === 'initializing')) {
        return;
      }

      setWaStatus(data.status);
      setWaLoading(data.status === 'initializing' || data.status === 'connecting');
      
      if (data.status === 'connected') {
        const fetchP = async () => {
          await supabase.from('users').update({ whatsapp_connected: true }).eq('id', user.id);
        };
        fetchP();
        setPairingCode('');
        setPairingStatus('');
      } else if (data.status === 'error') {
        setErrorStatus(data.message || 'Connection lost. Try again.');
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
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      alert("Please enter your WhatsApp phone number with country code (e.g. 919817203207)");
      return;
    }
    setWaLoading(true);
    setWaStatus('connecting');
    setPairingStatus('Preparing server...');
    setPairingCode('');
    setErrorStatus(null);
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      
      setPairingStatus('Requesting code from WhatsApp...');
      const options = {
        url: `${API_URL}/api/integrations/whatsapp/pair-phone`,
        headers: { 'Content-Type': 'application/json' },
        data: {
          userId: user.id,
          phoneNumber: cleaned   // digits only, no + prefix
        },
        connectTimeout: 30000,
        readTimeout: 75000      // pairing code takes up to 60s to arrive
      };

      const response = await CapacitorHttp.post(options);
      console.log("Pairing raw response status:", response.status);
      console.log("Pairing raw response data:", JSON.stringify(response.data));

      if (response.status >= 400) {
        const errMsg = (typeof response.data === 'string'
          ? JSON.parse(response.data)?.error
          : response.data?.error) || `Server error ${response.status}`;
        throw new Error(errMsg);
      }

      // CapacitorHttp may return data as string or object
      const parsed = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      const code = parsed?.pairingCode;
      
      if (code) {
        setPairingCode(code);
        setWaStatus('pairing_code_ready');
        setPairingStatus('Enter this code in WhatsApp');
        setWaLoading(false);
      } else {
        throw new Error('No pairing code in response: ' + JSON.stringify(parsed));
      }
    } catch (err) {
      console.error("Pairing error:", err);
      setErrorStatus("Failed: " + (err.message || "Check your internet and try again."));
      setWaLoading(false);
      setWaStatus('offline');
    }
  };

  const disconnectWhatsApp = async () => {
    if (!confirm("Are you sure you want to disconnect WhatsApp?")) return;
    setWaLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      await CapacitorHttp.post({
        url: `${API_URL}/api/integrations/whatsapp/disconnect`,
        headers: { 'Content-Type': 'application/json' },
        data: { userId: user.id }
      });
      setWaStatus('offline');
      setPairingCode('');
      setProfile(p => ({ ...p, whatsapp_connected: false }));
    } catch (err) {
      alert("Disconnect failed: " + err.message);
    } finally {
      setWaLoading(false);
    }
  };

  const resetWhatsApp = async () => {
    setWaLoading(true);
    setPairingStatus('Cleaning server session...');
    try {
      const { data: { user } = {} } = await supabase.auth.getUser();
      const API_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      await CapacitorHttp.post({
        url: `${API_URL}/api/integrations/whatsapp/force-reset`,
        headers: { 'Content-Type': 'application/json' },
        data: { userId: user.id }
      });
      setWaStatus('offline');
      setPairingCode('');
      setPairingStatus('');
      setErrorStatus(null);
      alert("WhatsApp state reset. You can now try a new link.");
    } catch (err) {
      alert("Reset failed: " + err.message);
    } finally {
      setWaLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (navigator.clipboard) {
       await navigator.clipboard.writeText(pairingCode);
       alert("Copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-brand-rose animate-spin mb-4" />
        <p className="text-white/50 font-bold uppercase tracking-widest text-xs">Syncing Board...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-12 pb-32">
      <div className="container mx-auto px-6">
        <div className="mb-10">
           <div className="flex items-center space-x-2 mb-2">
              <div className="w-8 h-8 bg-gradient-brand rounded-xl flex items-center justify-center shadow-lg">
                 <SettingsIcon size={16} className="text-white" />
              </div>
              <span className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Config</span>
           </div>
           <h1 className="text-3xl font-black text-white tracking-tight">Settings</h1>
        </div>

        <div className="space-y-10">
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-1 mb-5">Integrations</h2>

            {/* WhatsApp Integration Block */}
            <div className="bg-white/5 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center space-x-4">
                    <div className="w-14 h-14 bg-[#25D366] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#25D366]/30">
                       <Phone size={28} />
                    </div>
                    <div>
                       <h2 className="text-xl font-black text-white">WhatsApp</h2>
                       <div className="flex items-center space-x-2 mt-1">
                          {waStatus === 'connected' ? (
                             <><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" /><span className="text-[10px] font-black uppercase tracking-widest text-green-500">Connected</span></>
                          ) : waStatus === 'initializing' || waStatus === 'connecting' ? (
                             <><Loader2 className="animate-spin text-yellow-500" size={12} /><span className="text-[10px] font-black uppercase tracking-widest text-yellow-500 animate-pulse">{pairingStatus || 'Establishing Link...'}</span></>
                          ) : waStatus === 'pairing_code_ready' || waStatus === 'pairing' ? (
                             <><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" /><span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Enter Code</span></>
                          ) : (
                             <><div className="w-2 h-2 rounded-full bg-slate-500" /><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Disconnected</span></>
                          )}
                       </div>
                    </div>
                 </div>
              </div>

              {errorStatus && (
                 <div className="bg-red-500/10 text-red-400 border border-red-500/20 p-5 rounded-3xl mb-8 text-sm flex items-start space-x-3 backdrop-blur-md">
                    <AlertCircle size={18} className="mt-0.5 min-w-[18px]" />
                    <p className="font-medium leading-relaxed">{errorStatus}</p>
                 </div>
              )}

              {(waStatus === 'offline' || waStatus === 'disconnected' || waStatus === 'connecting' || waStatus === 'initializing') && (
                 <div className="space-y-6">
                    <div>
                       <label className="text-[10px] font-black text-white/30 mb-3 block uppercase tracking-widest px-1">WhatsApp Phone Number</label>
                       <input 
                          type="tel" 
                          value={phoneNumber} 
                          onChange={e => setPhoneNumber(e.target.value)} 
                          placeholder="+91..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white text-xl focus:outline-none focus:border-[#25D366]/50 transition-all font-mono"
                       />
                    </div>
                    <div className="flex gap-4">
                       <button 
                          onClick={connectWhatsAppWithPhone}
                          disabled={waLoading || !phoneNumber}
                          className="flex-1 bg-white text-[#0f0c29] font-black py-5 rounded-[1.5rem] active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-20 shadow-xl shadow-white/5"
                       >
                          {waLoading ? <Loader2 className="animate-spin" size={24} /> : <Phone size={24} />}
                          <span className="uppercase tracking-widest text-sm">Link Account</span>
                       </button>
                       {(waStatus === 'connecting' || waStatus === 'initializing') && (
                          <button 
                             onClick={resetWhatsApp}
                             className="bg-white/10 text-white font-black py-5 px-6 rounded-[1.5rem] active:scale-95 transition-all"
                          >
                             Reset
                          </button>
                       )}
                    </div>
                    <p className="text-[10px] text-white/20 text-center font-medium px-4">Ensure your number is in international format (e.g., +919876543210)</p>
                 </div>
              )}

              {(waStatus === 'pairing' || waStatus === 'pairing_code_ready') && pairingCode && (
                 <div className="bg-white/5 rounded-[2.5rem] p-8 text-center border border-white/10 relative z-10">
                    <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-10">Verification Code</h3>
                    <div className="text-5xl font-mono font-black tracking-[0.2em] text-white mb-10 bg-white/10 py-8 rounded-3xl shadow-inner border border-white/5">
                       {pairingCode}
                    </div>
                    
                    <div className="bg-[#0f0c29]/50 rounded-3xl p-6 text-left border border-white/5 mb-8">
                       <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Instructions</p>
                       <ol className="text-sm text-white/70 space-y-4 font-medium">
                         <li className="flex items-start space-x-3"><span className="w-5 h-5 rounded-lg bg-brand-rose text-white text-[10px] flex items-center justify-center mt-0.5 font-black">1</span><span>Open <b>WhatsApp</b> on your phone</span></li>
                         <li className="flex items-start space-x-3"><span className="w-5 h-5 rounded-lg bg-brand-rose text-white text-[10px] flex items-center justify-center mt-0.5 font-black">2</span><span>Settings → <b>Linked Devices</b></span></li>
                         <li className="flex items-start space-x-3"><span className="w-5 h-5 rounded-lg bg-brand-rose text-white text-[10px] flex items-center justify-center mt-0.5 font-black">3</span><span>Tap 'Link a Device'</span></li>
                         <li className="flex items-start space-x-3"><span className="w-5 h-5 rounded-lg bg-brand-rose text-white text-[10px] flex items-center justify-center mt-0.5 font-black">4</span><span>Select 'Link with phone instead'</span></li>
                       </ol>
                    </div>

                    <button onClick={copyToClipboard} className="w-full bg-brand-rose text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all shadow-xl shadow-brand-rose/20">
                       <Clipboard size={20} />
                       <span>Copy Magic Code</span>
                    </button>
                 </div>
              )}

              {waStatus === 'connected' && (
                 <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-[2.5rem] text-center backdrop-blur-md">
                    <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-green-500/30">
                       <CheckCircle2 size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-white mb-2">Account Ready</h3>
                    <p className="text-sm text-white/60 font-medium leading-relaxed mb-6">Your automated wishes will now be delivered via your WhatsApp account seamlessly.</p>
                    <button onClick={disconnectWhatsApp} className="text-[10px] font-black text-red-400 uppercase tracking-widest border border-red-500/20 px-6 py-3 rounded-xl hover:bg-red-500/10 transition-all">Disconnect Session</button>
                 </div>
              )}
              
              <div className="absolute top-[-100px] right-[-100px] w-[250px] h-[250px] bg-[#25D366]/20 rounded-full blur-[100px] pointer-events-none" />
            </div>
          </section>

          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 px-1 mb-5">Account</h2>
            <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center">
               <p className="text-white/40 text-xs font-medium mb-1 uppercase tracking-widest">Logged in as</p>
               <p className="text-white font-black">{profile?.email}</p>
               <button 
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.reload();
                  }}
                  className="mt-6 text-red-500 text-[10px] font-black uppercase tracking-widest bg-red-500/10 px-6 py-3 rounded-xl active:scale-95 transition-all"
               >
                  Security Logout
               </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
