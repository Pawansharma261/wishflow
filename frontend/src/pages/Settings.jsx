import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { apiClient } from '../lib/apiClient';
import { User, Bell, Shield, Instagram, Phone, Loader, CheckCircle2, QrCode, RefreshCw, Copy } from 'lucide-react';
import { io } from 'socket.io-client';
import QRCode from 'qrcode';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';

const Settings = () => {
  const [profile, setProfile] = useState({ name: '', email: '', whatsapp_connected: false, instagram_access_token: null });
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const socketRef = useRef(null);

  // WhatsApp state
  const [waStatus, setWaStatus]       = useState('disconnected');
  const [waLoading, setWaLoading]     = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [pairingMode, setPairingMode] = useState('qr');   // 'qr' | 'phone'
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [pairingMsg, setPairingMsg]   = useState('');
  const [codeTimer, setCodeTimer]     = useState(0);  // countdown seconds
  const codeTimerRef = useRef(null);
  const waStatusRef = useRef(waStatus);

  useEffect(() => { waStatusRef.current = waStatus; }, [waStatus]);

  // Countdown timer when pairing code is showing
  useEffect(() => {
    if (pairingCode && codeTimer > 0) {
      codeTimerRef.current = setTimeout(() => setCodeTimer(t => t - 1), 1000);
    } else if (pairingCode && codeTimer === 0) {
      // Code expired — clear it
      setPairingCode('');
      setWaStatus('disconnected');
      setWaLoading(false);
      setPairingMsg('Code expired. Click "Get New Code" to try again.');
    }
    return () => clearTimeout(codeTimerRef.current);
  }, [pairingCode, codeTimer]);

  useEffect(() => {
    fetchProfile();
    return () => { if (socketRef.current) socketRef.current.disconnect(); };
  }, []);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user.id);
    const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (data) {
      setProfile({ ...data, email: user.email });
      if (data.whatsapp_connected) setWaStatus('connected');
    }
    setLoading(false);
    initSocket(user.id);

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) handleInstagramCallback(code, user.id);
  };

  const initSocket = (uid) => {
    if (socketRef.current) return;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WS] Connected:', socket.id);
      socket.emit('register', uid);
    });

    socket.on('whatsapp_qr', async (data) => {
      console.log('[WS] QR received');
      try {
        const url = await QRCode.toDataURL(data.qr, { margin: 2, scale: 8, color: { dark: '#1e1b4b', light: '#ffffff' } });
        setQrCodeDataUrl(url);
        setWaStatus('qr_ready');
        setWaLoading(false);
      } catch (err) { console.error('QR render error:', err); }
    });

    // Pairing code delivered via WebSocket
    socket.on('whatsapp_pairing_code', (data) => {
      console.log('[WS] Pairing code received:', data.code);
      setPairingCode(data.code);
      setCodeTimer(180);          // Increased to 180-second countdown for stability
      setWaStatus('code_ready');
      setWaLoading(false);
      setPairingMsg('Enter this code in WhatsApp NOW — you have 3 minutes!');
    });

    socket.on('whatsapp_error', (data) => {
      console.error('[WS] WhatsApp error:', data.message);
      setPairingMsg('');
      setWaStatus('disconnected');
      setWaLoading(false);
      // alert('WhatsApp pairing failed: ' + data.message);
    });

    socket.on('whatsapp_status', (data) => {
      // CRITICAL: Protect the pairing code from being cleared by status blips
      const cur = waStatusRef.current;
      if (cur === 'code_ready' && data.status !== 'connected') {
        console.log('[WS] Status update suppressed to keep code visible:', data.status);
        return; 
      }

      console.log('[WS] Status:', data.status);
      setWaStatus(data.status);

      if (data.status === 'connected') {
        setProfile(p => ({ ...p, whatsapp_connected: true }));
        setWaLoading(false);
        setQrCodeDataUrl('');
        setPairingCode('');
        setPairingMsg('');
      } else if (data.status === 'disconnected') {
        setProfile(p => ({ ...p, whatsapp_connected: false }));
        setWaLoading(false);
      }
    });

  };

  // ── QR method ────────────────────────────────────────────────────────────────
  const connectWhatsApp = async () => {
    setWaLoading(true);
    setWaStatus('connecting');
    setQrCodeDataUrl('');
    try {
      const res = await apiClient.post('/api/integrations/whatsapp/connect', { userId });
      if (res.error) throw new Error(res.error);
      // QR arrives via WebSocket 'whatsapp_qr' event
    } catch (err) {
      alert('Failed to initiate QR connection: ' + (err.message || ''));
      setWaLoading(false);
      setWaStatus('disconnected');
    }
  };

  // ── Phone Number pairing method ───────────────────────────────────────────────
  // Step 1: Force-reset clears stale Redis session (so creds.registered=false on server)
  // Step 2: pair-phone fires in background, code arrives via 'whatsapp_pairing_code' WS event
  const connectWithPhone = async () => {
    const cleaned = phoneNumber.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      alert('Please enter a valid phone number with country code (e.g. 919817203207)');
      return;
    }
    setWaLoading(true);
    setWaStatus('connecting');
    setPairingCode('');
    setPairingMsg('Step 1/2: Clearing old session...');

    try {
      // CRITICAL: Reset first so backend creds.registered=false → requestPairingCode runs
      await apiClient.post('/api/integrations/whatsapp/force-reset', { userId });
      setPairingMsg('Step 2/2: Requesting pairing code from WhatsApp (10–30s)...');

      // Fire pair-phone — returns immediately, code arrives via WebSocket
      await apiClient.post('/api/integrations/whatsapp/pair-phone', {
        userId,
        phoneNumber: cleaned,
      });
      // Keep spinner running — 'whatsapp_pairing_code' WS event will show the code
      setPairingMsg('⏳ Waiting for WhatsApp to generate your code...');
    } catch (err) {
      setPairingMsg('');
      setWaStatus('disconnected');
      setWaLoading(false);
      alert('Failed to start pairing: ' + (err.message || 'Unknown error'));
    }
    // waLoading cleared by 'whatsapp_pairing_code' or 'whatsapp_error' socket events
  };

  const copyPairingCode = () => {
    navigator.clipboard.writeText(pairingCode.replace(/-/g, ''));
    alert('Pairing code copied!');
  };

  // ── Reset ─────────────────────────────────────────────────────────────────────
  const resetWhatsApp = async () => {
    if (!window.confirm('Reset WhatsApp session? You will need to re-link.')) return;
    setWaLoading(true);
    try {
      await apiClient.post('/api/integrations/whatsapp/force-reset', { userId });
      setWaStatus('disconnected');
      setPairingCode('');
      setPairingMsg('');
      setQrCodeDataUrl('');
      setProfile(p => ({ ...p, whatsapp_connected: false }));
    } catch (err) {
      alert('Reset failed: ' + err.message);
    } finally {
      setWaLoading(false);
    }
  };

  // ── Instagram ─────────────────────────────────────────────────────────────────
  const handleInstagramCallback = async (code, uid) => {
    try {
      const res = await apiClient.post('/api/integrations/instagram/callback', { code, userId: uid });
      if (res.error) throw new Error(res.error);
      alert('Instagram connected! ✨');
      setProfile(p => ({ ...p, instagram_access_token: 'active' }));
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      alert('Instagram link failed: ' + (err.message || ''));
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
    const { error } = await supabase.from('users').upsert({ id: userId, name: profile.name });
    if (!error) alert('Settings updated!');
    else alert(error.message);
  };

  if (loading) return <div className="text-center py-20 text-white/50">Loading settings...</div>;

  const waConnected  = waStatus === 'connected';
  const waCodeReady  = waStatus === 'code_ready';
  const waConnecting = waStatus === 'connecting';
  const waQrReady    = waStatus === 'qr_ready';

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-10">Settings</h1>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
        {/* Sidebar */}
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

        {/* Main content */}
        <div className="xl:col-span-3 space-y-8">

          {/* Messaging Integrations */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-[2.5rem] p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-6">Messaging Integrations</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              {/* ── WhatsApp Panel ───────────────────────────────────── */}
              <div className="bg-[#1e1e38] rounded-3xl p-6 border border-white/10 relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* Header row */}
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <Phone className="text-green-500" size={20} />
                    </div>
                    <h3 className="font-bold text-white text-lg">WhatsApp</h3>
                  </div>

                  {/* Status badge */}
                  {waConnected ? (
                    <span className="flex items-center space-x-1.5 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold">
                      <CheckCircle2 size={14} /><span>Connected</span>
                    </span>
                  ) : waConnecting ? (
                    <span className="flex items-center space-x-1.5 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">
                      <Loader size={12} className="animate-spin" /><span>Connecting…</span>
                    </span>
                  ) : waQrReady ? (
                    <span className="flex items-center space-x-1.5 bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                      <QrCode size={12} /><span>Scan QR</span>
                    </span>
                  ) : waCodeReady ? (
                    <span className="flex items-center space-x-1.5 bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
                      <Phone size={12} /><span>Enter Code</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1.5 bg-white/10 text-white/50 px-3 py-1 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-white/30" /><span>Disconnected</span>
                    </span>
                  )}
                </div>

                <p className="text-white/50 text-sm mb-5 relative z-10">
                  Connect your real WhatsApp account to send wishes directly from your phone number.
                </p>

                {/* Mode toggle — always visible unless connected */}
                {!waConnected && (
                  <div className="flex bg-white/5 rounded-2xl p-1 mb-5 relative z-10">
                    <button
                      onClick={() => { setPairingMode('qr'); setPairingCode(''); setPairingMsg(''); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                        pairingMode === 'qr' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      <QrCode size={14} /> Scan QR
                    </button>
                    <button
                      onClick={() => { setPairingMode('phone'); setQrCodeDataUrl(''); setPairingCode(''); setPairingMsg(''); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                        pairingMode === 'phone' ? 'bg-white text-slate-900 shadow-lg' : 'text-white/40 hover:text-white/70'
                      }`}
                    >
                      <Phone size={14} /> Phone Number
                    </button>
                  </div>
                )}

                {/* ── QR mode content ── */}
                {pairingMode === 'qr' && !waConnected && (
                  <div className="relative z-10">
                    {waQrReady && qrCodeDataUrl ? (
                      <div className="flex flex-col items-center p-4 bg-white rounded-2xl">
                        <img src={qrCodeDataUrl} alt="WhatsApp QR Code" className="w-52 h-52 mb-3" />
                        <p className="text-slate-800 font-bold text-sm text-center">Scan with WhatsApp</p>
                        <p className="text-slate-500 text-xs text-center mt-1">Settings → Linked Devices → Link a Device</p>
                      </div>
                    ) : (
                      <button
                        onClick={connectWhatsApp}
                        disabled={waLoading}
                        className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-green-900/50 flex items-center justify-center gap-2 text-sm"
                      >
                        {waLoading ? <Loader size={18} className="animate-spin" /> : <QrCode size={18} />}
                        <span>{waLoading ? 'Generating QR…' : 'Generate Connection QR'}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* ── Phone mode content ── */}
                {pairingMode === 'phone' && !waConnected && (
                  <div className="relative z-10 space-y-3">
                    {waCodeReady && pairingCode ? (
                      /* Show the pairing code with countdown */
                      <div className="bg-white rounded-3xl p-5 text-center shadow-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Your Pairing Code</p>

                        {/* Countdown timer */}
                        <div className={`text-xs font-bold mb-3 ${codeTimer <= 20 ? 'text-red-500 animate-pulse' : 'text-orange-500'}`}>
                          ⏱ Expires in {codeTimer}s — Enter it in WhatsApp NOW
                        </div>

                        <div className="text-4xl font-black tracking-[0.25em] text-slate-900 bg-slate-50 py-5 rounded-2xl border-2 border-green-100 font-mono mb-3">
                          {pairingCode}
                        </div>
                        <button
                          onClick={copyPairingCode}
                          className="flex items-center justify-center gap-1.5 text-green-600 text-xs font-bold hover:underline mx-auto mb-4"
                        >
                          <Copy size={12} /> Copy Code
                        </button>
                        <div className="text-left bg-slate-50 rounded-xl p-3 space-y-1 mb-3">
                          <p className="text-[11px] font-black text-slate-600 mb-1">⚡ Do this RIGHT NOW:</p>
                          {[
                            'Open WhatsApp on your phone',
                            'Tap ⋮ Menu → Linked Devices',
                            'Tap "Link with phone number"',
                            `Enter the code: ${pairingCode}`,
                          ].map((s, i) => (
                            <p key={i} className="text-[11px] text-slate-500">{i + 1}. {s}</p>
                          ))}
                        </div>
                        <button
                          onClick={connectWithPhone}
                          className="text-[11px] text-slate-400 hover:text-green-600 font-bold underline"
                        >
                          ↻ Get New Code
                        </button>
                      </div>
                    ) : (
                      /* Phone number input + button */
                      <>
                        <input
                          type="tel"
                          placeholder="919876543210  (with country code, no +)"
                          className="w-full bg-[#12122a] border border-white/10 rounded-2xl px-4 py-4 text-white font-bold text-center tracking-widest placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                          value={phoneNumber}
                          onChange={e => setPhoneNumber(e.target.value)}
                          disabled={waLoading}
                        />
                        {pairingMsg && (
                          <p className="text-blue-300 text-xs text-center font-medium animate-pulse">{pairingMsg}</p>
                        )}
                        <button
                          onClick={connectWithPhone}
                          disabled={waLoading}
                          className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-green-900/50 flex items-center justify-center gap-2 text-sm"
                        >
                          {waLoading ? <Loader size={18} className="animate-spin" /> : <Phone size={18} />}
                          <span>{waLoading ? 'Requesting code…' : 'Get Pairing Code'}</span>
                        </button>
                        <p className="text-[10px] text-white/25 text-center uppercase tracking-widest">
                          Recommended for mobile and unstable networks
                        </p>
                      </>
                    )}
                  </div>
                )}

                {/* Connected state */}
                {waConnected && (
                  <div className="relative z-10 flex flex-col items-center gap-3 mt-2">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                      <CheckCircle2 size={18} /> WhatsApp is linked and active
                    </div>
                    <p className="text-white/30 text-xs text-center">
                      WishFlow is sending wishes directly from your WhatsApp.
                    </p>
                  </div>
                )}

                {/* Reset button */}
                <button
                  onClick={resetWhatsApp}
                  className="mt-5 flex items-center justify-center gap-1.5 text-[10px] text-white/25 hover:text-red-400 uppercase tracking-widest font-black transition-colors mx-auto py-1 relative z-10"
                >
                  <RefreshCw size={10} /> Reset / Disconnect
                </button>
              </div>

              {/* ── Instagram Panel ──────────────────────────────────── */}
              <div className="bg-[#1e1e38] rounded-3xl p-6 border border-white/10 relative overflow-hidden flex flex-col h-full">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between mb-4 relative z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-tr from-pink-500 to-purple-500 rounded-xl flex items-center justify-center opacity-80">
                      <Instagram className="text-white" size={20} />
                    </div>
                    <h3 className="font-bold text-white text-lg">Instagram</h3>
                  </div>
                  {profile.instagram_access_token ? (
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
                    Connect Instagram via Meta
                  </button>
                  <p className="text-[10px] text-white/20 mt-3 text-center uppercase tracking-widest font-bold">Secure Meta OAuth Login</p>
                </div>
              </div>

            </div>
          </div>

          {/* Personal Details */}
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
                    onChange={e => setProfile({ ...profile, name: e.target.value })}
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
