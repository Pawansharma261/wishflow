import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Users, Send, Clock, TrendingUp, ChevronRight, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { io } from 'socket.io-client';
import { RefreshCw, LayoutGrid, Image as ImageIcon, MessageCircle, X, Paperclip, Search, CheckCircle2, Calendar } from 'lucide-react';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { apiClient } from '../lib/apiClient';
import { uploadMedia } from '../lib/storage';

const getNextOccurrence = (dateStr) => {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let next = new Date(dateStr);
  next.setFullYear(today.getFullYear());
  if (isBefore(next, today)) next = addYears(next, 1);
  return next;
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ whatsapp_connected: false, has_instagram: false });
  const [userId, setUserId] = useState(null);
  const [stats, setStats] = useState({ totalContacts: 0, sentWishes: 0, pendingWishes: 0 });
  const [upcomingWishes, setUpcomingWishes] = useState([]);
  const [radarEvent, setRadarEvent] = useState(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [statusDraft, setStatusDraft] = useState({ 
    text: '', 
    mediaUrl: '', 
    mediaType: 'text', // 'text', 'image', 'video', 'audio'
    recipients: [], 
    scheduledAt: '' 
  });
  const [postingStatus, setPostingStatus] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [postType, setPostType] = useState('broadcast'); // 'broadcast' or 'status'
  const fileInputRef = useRef(null);

  const handleManualRefresh = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setRefreshingStatus(true);
    await fetchDashboardData();
    // Simulate a brief delay for user feedback
    setTimeout(() => setRefreshingStatus(false), 800);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadMedia(file);
      setStatusDraft(prev => ({ ...prev, mediaUrl: url }));
      console.debug('[Upload] Success:', url);
    } catch (err) {
      console.error('[Upload] Error:', err);
      alert(err.message);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = ''; 
    }
  };

  const toggleRecipient = (phone) => {
    if (!phone) return;
    setStatusDraft(prev => {
      const isSelected = prev.recipients.includes(phone);
      if (isSelected) {
        return { ...prev, recipients: prev.recipients.filter(p => p !== phone) };
      } else {
        return { ...prev, recipients: [...prev.recipients, phone] };
      }
    });
  };

  const handlePostStatus = async () => {
    if (!profile.whatsapp_connected && !statusDraft.scheduledAt) return alert('WhatsApp must be connected to post status immediately.');
    if (!statusDraft.text && !statusDraft.mediaUrl) return alert('Please enter text or choose an image.');
    
    // Logic for Broadcast vs Status
    let recipientPhones = [];
    if (postType === 'broadcast') {
        recipientPhones = statusDraft.recipients.length > 0 
          ? statusDraft.recipients 
          : allContacts.map(c => c.phone).filter(p => !!p);
        
        if (recipientPhones.length === 0) return alert('No recipients selected for broadcast.');
    } else {
        // Status type: one row with status@broadcast
        recipientPhones = ['status@broadcast'];
    }

    setPostingStatus(true);
    try {
      if (statusDraft.scheduledAt) {
        const utcScheduledDate = new Date(statusDraft.scheduledAt).toISOString();
        const payload = {
            postType, // 'broadcast' or 'status'
            text: statusDraft.text,
            mediaUrl: statusDraft.mediaUrl,
            mediaType: statusDraft.mediaType,
            scheduledAt: utcScheduledDate,
            recipients: recipientPhones
        };

        const res = await apiClient.post('/api/wishes/bulk-schedule', payload);
        if (!res.success) throw new Error(res.error || 'Failed to schedule');
        
        alert(`Successfully scheduled ${postType} for ${recipientPhones.length} target(s)! 📅`);
        setStatusDraft({ text: '', mediaUrl: '', recipients: [], scheduledAt: '' });
        fetchDashboardData();
      } else {
        // Immediate post
        const res = await apiClient.post('/api/integrations/whatsapp/post-status', {
          text: statusDraft.text,
          mediaUrl: statusDraft.mediaUrl,
          recipients: recipientPhones,
          isStory: postType === 'status'
        });
        if (res.success) {
          alert(`Successfully sent ${postType}! 🚀`);
          setStatusDraft({ text: '', mediaUrl: '', recipients: [], scheduledAt: '' });
          fetchDashboardData();
        } else {
          throw new Error(res.error || 'Failed to post');
        }
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setPostingStatus(false);
    }
  };

  // REALTIME SYNC: Refresh data when anything changes on different devices
  useRealtimeSync({
    userId,
    onUserChange: () => fetchDashboardData(),
    onContactsChange: () => fetchDashboardData(),
    onWishesChange: () => fetchDashboardData(),
  });

  useEffect(() => {
    fetchDashboardData();
    
    // Setup Socket for Real-time Status Sync
    let socket;
    const setupSocket = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;
      setUserId(user.id);
      
      const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      
      socket.on('connect', () => {
        // AUTH HARDENING: Register with session token
        if (session.access_token) {
           socket.emit('register', { userId: user.id, token: session.access_token });
        }
      });

      socket.on('whatsapp_status', (data) => {
        // STABILITY FIX: Keep status connected unless real logout
        if (data.status === 'connected') {
           setProfile(prev => ({ ...prev, whatsapp_connected: true }));
        } else if (data.status === 'disconnected') {
           const logoutReasons = [401, '401', 'loggedOut'];
           if (logoutReasons.includes(data.reason)) {
              setProfile(prev => ({ ...prev, whatsapp_connected: false }));
           }
        }
      });

      socket.on('auth_error', (err) => {
        console.error('[WS] Auth Error:', err.message);
      });
    };

    setupSocket();

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    
    const { data: userData } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (userData) {
      setProfile({
        whatsapp_connected: userData.whatsapp_connected,
        has_instagram: !!userData.instagram_access_token
      });
    }

    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { data: wishes } = await supabase
      .from('wishes')
      .select('*')
      .eq('user_id', user.id);

    const sent = wishes?.filter(w => w.status === 'sent').length || 0;
    const pending = wishes?.filter(w => w.status === 'pending').length || 0;
    setStats({ totalContacts: contactsCount || 0, sentWishes: sent, pendingWishes: pending });
    
    const upcoming = wishes
      ?.filter(w => w.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_datetime || a.scheduled_for) - new Date(b.scheduled_datetime || b.scheduled_for))
      .slice(0, 3) || [];
    setUpcomingWishes(upcoming);

    // Dynamic Celebration Radar
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, name, phone, birthday, anniversary')
      .eq('user_id', user.id);
    
    setAllContacts(contacts || []);

    let soonestEvent = null;
    let soonestDays = Infinity;
    for (const c of (contacts || [])) {
      const birthday = getNextOccurrence(c.birthday);
      const anniversary = getNextOccurrence(c.anniversary);
      if (birthday) {
        const diff = differenceInDays(birthday, new Date());
        if (diff < soonestDays) {
          soonestDays = diff;
          soonestEvent = { name: c.name, date: birthday, type: 'Birthday 🎂' };
        }
      }
      if (anniversary) {
        const diff = differenceInDays(anniversary, new Date());
        if (diff < soonestDays) {
          soonestDays = diff;
          soonestEvent = { name: c.name, date: anniversary, type: 'Anniversary ≡ƒÆì' };
        }
      }
    }
    setRadarEvent(soonestEvent ? { ...soonestEvent, daysAway: soonestDays } : null);
    setLoading(false);
  };

  const widgets = [
    { title: 'Total Contacts', value: stats.totalContacts, icon: <Users className="text-blue-500" />, color: 'bg-blue-50', link: '/contacts' },
    { title: 'Wishes Sent', value: stats.sentWishes, icon: <Send className="text-green-500" />, color: 'bg-green-50', link: '/wishes?filter=sent' },
    { title: 'Pending', value: stats.pendingWishes, icon: <Clock className="text-orange-500" />, color: 'bg-orange-50', link: '/wishes?filter=pending' },
  ];

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight mb-2">
            Hey there! 👋
          </h1>
          <p className="text-white/60 font-medium">Your automated celebration assistant is ready.</p>
        </div>
        <Link to="/scheduler" className="btn-primary flex items-center justify-center space-x-2 w-full lg:w-auto px-8 py-4">
          <Sparkles size={18} />
          <span>Automate New Wish</span>
        </Link>
      </div>

      {/* Integration Status Quick Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
         <Link to="/settings" className={`backdrop-blur-md border rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.03] active:scale-95 shadow-lg relative group ${
           profile.whatsapp_connected 
           ? 'bg-green-600/90 border-green-400/50 shadow-green-900/40' 
           : 'bg-white/5 border-white/10'
         }`}>
            <div className="flex items-center space-x-3">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.whatsapp_connected ? 'bg-white/20 text-white' : 'bg-white/10 text-white/40'}`}>
                  <Send size={18} />
               </div>
               <div>
                  <p className={`text-[10px] font-black uppercase tracking-tighter ${profile.whatsapp_connected ? 'text-white/80' : 'text-white/40'}`}>WhatsApp</p>
                  <p className={`text-xs font-black ${profile.whatsapp_connected ? 'text-white' : 'text-white/60'}`}>{profile.whatsapp_connected ? 'CONNECTED' : 'OFFLINE'}</p>
               </div>
            </div>
            <button 
              onClick={handleManualRefresh}
              className={`p-2 rounded-lg transition-all ${profile.whatsapp_connected ? 'hover:bg-white/20 text-white' : 'hover:bg-white/10 text-white/40'}`}
              title="Refresh Status"
            >
              <RefreshCw size={14} className={refreshingStatus ? 'animate-spin' : ''} />
            </button>
         </Link>
         
         <Link to="/settings" className={`backdrop-blur-md border rounded-2xl p-4 flex items-center justify-between transition-all hover:scale-[1.03] active:scale-95 shadow-lg relative group ${
           profile.has_instagram 
           ? 'bg-gradient-to-tr from-pink-600 to-purple-600 border-pink-400/50 shadow-pink-900/40' 
           : 'bg-white/5 border-white/10'
         }`}>
            <div className="flex items-center space-x-3">
               <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.has_instagram ? 'bg-white/20 text-white' : 'bg-white/10 text-white/40'}`}>
                  <TrendingUp size={18} />
               </div>
               <div>
                  <p className={`text-[10px] font-black uppercase tracking-tighter ${profile.has_instagram ? 'text-white/80' : 'text-white/40'}`}>Instagram</p>
                  <p className={`text-xs font-black ${profile.has_instagram ? 'text-white' : 'text-white/60'}`}>{profile.has_instagram ? 'CONNECTED' : 'OFFLINE'}</p>
               </div>
            </div>
            <button 
              onClick={handleManualRefresh}
              className={`p-2 rounded-lg transition-all ${profile.has_instagram ? 'hover:bg-white/20 text-white' : 'hover:bg-white/10 text-white/40'}`}
              title="Refresh Status"
            >
              <RefreshCw size={14} className={refreshingStatus ? 'animate-spin' : ''} />
            </button>
         </Link>
      </div>

      {/* Status Hub (WhatsApp Stories) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[80px] -z-10 group-hover:bg-indigo-500/10 transition-colors" />
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-indigo-400">
                <LayoutGrid size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Status & Direct Broadcast</h2>
                <div className="flex items-center space-x-4 mt-1">
                   <button 
                      onClick={() => setPostType('broadcast')}
                      className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all ${postType === 'broadcast' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40'}`}
                   >
                      Broadcast DM
                   </button>
                   <button 
                      onClick={() => setPostType('status')}
                      className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg transition-all ${postType === 'status' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40'}`}
                   >
                      WhatsApp Status (Coming Soon)
                   </button>
                </div>
              </div>
            </div>
            {profile.whatsapp_connected && (
              <div className="hidden md:flex bg-green-500/10 text-green-400 text-[10px] font-black px-4 py-2 rounded-xl border border-green-500/20 uppercase tracking-widest">
                System Active
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1 block">Status / Message Text</label>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-sm h-32 resize-none focus:outline-none focus:border-indigo-500/50 transition-all placeholder-white/20 font-medium"
                  placeholder="Share what's on your mind... (Caption if image exists)"
                  value={statusDraft.text}
                  onChange={e => setStatusDraft({...statusDraft, text: e.target.value})}
                />
              </div>

               <div className="space-y-4 flex flex-col">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-white/30 uppercase tracking-widest block">Status Format</label>
                    <div className="flex bg-white/5 p-1 rounded-lg">
                      {['text', 'image', 'video', 'audio'].map(t => (
                        <button 
                          key={t}
                          onClick={() => setStatusDraft(prev => ({ ...prev, mediaType: t, mediaUrl: '' }))}
                          className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${statusDraft.mediaType === t ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <input 
                     type="file" 
                     className="absolute opacity-0 pointer-events-none w-0 h-0" 
                     ref={fileInputRef} 
                     accept={statusDraft.mediaType === 'image' ? 'image/*' : statusDraft.mediaType === 'video' ? 'video/*' : statusDraft.mediaType === 'audio' ? 'audio/*' : '*'} 
                     onChange={handleFileUpload}
                  />

                  {statusDraft.mediaType !== 'text' && (
                    statusDraft.mediaUrl ? (
                      <div className="relative w-full h-32 rounded-3xl overflow-hidden border border-indigo-500/30 bg-black/20">
                         {statusDraft.mediaType === 'image' && <img src={statusDraft.mediaUrl} className="w-full h-full object-cover" alt="Preview" />}
                         {statusDraft.mediaType === 'video' && <video src={statusDraft.mediaUrl} className="w-full h-full object-contain" controls />}
                         {statusDraft.mediaType === 'audio' && <audio src={statusDraft.mediaUrl} className="w-full mt-10 px-4" controls />}
                         <button 
                            onClick={() => setStatusDraft({...statusDraft, mediaUrl: ''})}
                            className="absolute top-2 right-2 bg-black/60 text-white p-2 rounded-xl hover:bg-black transition-colors z-10"
                         >
                            <X size={16} />
                         </button>
                      </div>
                    ) : (
                      <button 
                         onClick={() => fileInputRef.current?.click()}
                         disabled={uploading}
                         className="w-full h-32 bg-white/5 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-white/40 hover:bg-white/10 hover:border-indigo-500/30 transition-all group"
                      >
                         {uploading ? (
                            <RefreshCw size={24} className="animate-spin text-indigo-400" />
                         ) : (
                           <>
                             <Paperclip size={24} className="mb-2 group-hover:text-indigo-400 transition-colors" />
                             <span className="text-[10px] font-black uppercase tracking-widest">Attach {statusDraft.mediaType}</span>
                           </>
                         )}
                      </button>
                    )
                  )}

                  <div className="mt-auto pt-4 flex bg-indigo-500/5 border border-indigo-500/20 rounded-2xl p-4 items-center space-x-3">
                     <MessageCircle size={18} className="text-indigo-400" />
                     <p className="text-[10px] text-white/50 font-medium leading-relaxed italic">
                        {statusDraft.mediaType === 'text' ? "Posting pure text status correctly styled for WhatsApp." : `Upload ${statusDraft.mediaType} story and I'll deliver it elegantly.`}
                     </p>
                  </div>
               </div>
            </div>

            {postType === 'broadcast' && (
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center space-x-2">
                      <Users size={16} className="text-indigo-400" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Target Recipients</span>
                  </div>
                  <div className="relative">
                      <input 
                        type="text"
                        placeholder="Search name..."
                        className="bg-transparent border-b border-white/10 text-xs py-1 px-4 text-white placeholder-white/20 focus:outline-none focus:border-indigo-500 transition-all font-medium pr-8"
                        value={contactSearch}
                        onChange={e => setContactSearch(e.target.value)}
                      />
                      <Search className="absolute right-0 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                  </div>
                </div>

                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center space-x-2 text-indigo-400">
                      <Calendar size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Schedule for Later?</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="datetime-local"
                        className="bg-transparent border-none text-white text-[10px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer"
                        style={{ colorScheme: 'dark' }}
                        value={statusDraft.scheduledAt}
                        onChange={(e) => setStatusDraft(prev => ({ ...prev, scheduledAt: e.target.value }))}
                      />
                      {statusDraft.scheduledAt && (
                        <button 
                          onClick={() => setStatusDraft(prev => ({ ...prev, scheduledAt: '' }))}
                          className="text-brand-rose text-[8px] font-black uppercase underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                    <button 
                      onClick={() => setStatusDraft(prev => ({ ...prev, recipients: [] }))}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusDraft.recipients.length === 0 ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/40 border border-white/10'}`}
                    >
                      All Contacts
                    </button>
                    {allContacts.filter(c => c.name?.toLowerCase().includes(contactSearch.toLowerCase())).map((c) => (
                      <button 
                        key={c.phone}
                        onClick={() => toggleRecipient(c.phone)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all flex items-center space-x-2 ${statusDraft.recipients.includes(c.phone) ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/40 border border-white/10'}`}
                      >
                        <span>{c.name}</span>
                        {statusDraft.recipients.includes(c.phone) && <CheckCircle2 size={12} />}
                      </button>
                    ))}
                </div>
              </div>
             {postType === 'status' && (
              <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-3xl p-8 animate-in fade-in slide-in-from-top-2 duration-300 relative overflow-hidden">
                 <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-10">
                    <p className="text-white font-black uppercase tracking-widest text-lg">Coming Soon 🚀</p>
                 </div>
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 opacity-20 pointer-events-none">
                    <div className="flex items-center space-x-4">
                       <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center relative ring-4 ring-indigo-500/20 ring-offset-4 ring-offset-[#0f0c29]">
                         <Send className="text-indigo-400" size={32} />
                       </div>
                       <div>
                          <p className="text-xs font-black text-white uppercase tracking-tighter">Your Story</p>
                          <p className="text-[10px] text-white/40 font-medium uppercase tracking-widest mt-1">Visible to your saved contacts</p>
                       </div>
                    </div>
                 </div>
              </div>
            )}

            )}

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4">
               <div className="flex items-center space-x-2">
                 {postType === 'broadcast' ? (
                   <>
                    <div className="flex -space-x-3">
                      {statusDraft.recipients.length > 0 ? (
                          allContacts.filter(c => statusDraft.recipients.includes(c.phone)).slice(0, 5).map((c, i) => (
                            <div key={i} className="w-8 h-8 rounded-xl bg-indigo-500 border-2 border-[#0f0c29] flex items-center justify-center text-[10px] font-black text-white">
                              {c?.name?.[0] || '?'}
                            </div>
                          ))
                      ) : (
                          allContacts.slice(0, 5).map((c, i) => (
                            <div key={i} className="w-8 h-8 rounded-xl bg-white/10 border-2 border-[#0f0c29] flex items-center justify-center text-[10px] font-bold text-white/60">
                              {c?.name?.[0] || '?'}
                            </div>
                          ))
                      )}
                      {(statusDraft.recipients.length > 5 || (statusDraft.recipients.length === 0 && allContacts.length > 5)) && (
                          <div className="w-8 h-8 rounded-xl bg-indigo-600/50 text-white border-2 border-[#0f0c29] flex items-center justify-center text-[10px] font-bold backdrop-blur-sm">
                            +{statusDraft.recipients.length > 0 ? statusDraft.recipients.length - 5 : allContacts.length - 5}
                          </div>
                      )}
                    </div>
                    <span className="text-[10px] font-black text-white/40 uppercase tracking-widest ml-2">
                        {statusDraft.recipients.length > 0 ? `To ${statusDraft.recipients.length} Selected` : 'To ALL Contacts'}
                    </span>
                   </>
                 ) : (
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                     Posting to WhatsApp Story
                   </span>
                 )}
               </div>

               <button 
                  onClick={handlePostStatus}
                  disabled={postingStatus || (!statusDraft.text && !statusDraft.mediaUrl) || (!profile.whatsapp_connected && !statusDraft.scheduledAt)}
                  className="bg-white text-[#0f0c29] font-black px-12 py-5 rounded-3xl shadow-2xl active:scale-95 transition-all flex items-center space-x-3 disabled:opacity-20 w-full md:w-auto justify-center group"
               >
                  {postingStatus ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />}
                  <span className="uppercase tracking-widest text-xs font-black">
                     {statusDraft.scheduledAt ? `Schedule ${postType}` : `Post ${postType} Now`}
                  </span>
               </button>
            </div>
          </div>
        </div>

        {/* Quick Media Send Tool */}
        <div className="bg-gradient-to-br from-indigo-600/30 to-purple-600/30 backdrop-blur-xl border border-white/20 rounded-[2.5rem] p-8 flex flex-col justify-between relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -z-10 group-hover:bg-white/10 transition-colors" />
           <div>
              <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-8 border border-white/10">
                <ImageIcon size={28} />
              </div>
              <h3 className="text-2xl font-black text-white mb-4 leading-tight tracking-tighter uppercase">Instant Media Delivery</h3>
              <p className="text-white/50 text-[11px] font-medium leading-relaxed">Festival cards, birthday banners, or quick updates. Upload any image from your drive and we'll deliver it on time.</p>
           </div>
           <Link to="/scheduler" className="mt-12 bg-indigo-600 text-white font-black py-6 rounded-3xl text-center shadow-xl shadow-indigo-900/40 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-[10px] border border-white/10">
              Open Scheduler
           </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {widgets.map((w, i) => (
          <Link to={w.link} key={i} className="card flex items-center space-x-6 hover:scale-105 transition-all shadow-xl hover:shadow-2xl cursor-pointer">
            <div className={`p-4 rounded-2xl ${w.color}`}>
              {w.icon}
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-1">{w.title}</p>
              <h3 className="text-3xl font-black text-slate-900">{w.value}</h3>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-white">Upcoming Scheduled</h2>
            <Link to="/wishes" className="text-brand-rose font-bold text-sm flex items-center hover:translate-x-1 transition-transform">
              View All <ChevronRight size={16} />
            </Link>
          </div>
          
          <div className="space-y-4">
            {upcomingWishes.length > 0 ? upcomingWishes.map((wish) => (
              <div key={wish.id} className="card flex items-center justify-between hover-lift">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl">
                    {wish.occasion_type === 'birthday' ? '🎂' : 
                     wish.occasion_type === 'christmas' ? '🎄' : 
                     wish.occasion_type === 'diwali' ? '🪔' : 
                     wish.occasion_type === 'story' ? '🚀' : '✨'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{wish.contact_name || wish.contacts?.name || '—'}</h4>
                    <p className="text-slate-500 text-sm capitalize">{(wish.occasion_type || 'Custom').replace('_', ' ')} • {wish.scheduled_datetime || wish.scheduled_for ? format(new Date(wish.scheduled_datetime || wish.scheduled_for), 'MMM do, h:mm a') : '—'}</p>
                  </div>
                </div>
                <div className="flex -space-x-2">
                  {wish.channels.map(c => (
                    <div key={c} title={c} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold uppercase">
                      {c[0]}
                    </div>
                  ))}
                </div>
              </div>
            )) : (
              <div className="bg-slate-100/50 rounded-3xl p-10 text-center border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-medium">No wishes scheduled yet.</p>
                <Link to="/scheduler" className="text-brand-rose font-bold block mt-2 text-sm">Schedule one now →</Link>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <h2 className="text-2xl font-black text-white">Celebration Radar</h2>
          <div className="bg-gradient-brand rounded-[2.5rem] p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              {radarEvent ? (
                <>
                  <Gift className="mb-4 text-white/80" size={32} />
                  <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">{radarEvent.type}</p>
                  <h3 className="text-2xl font-black mb-1">{radarEvent.name}</h3>
                  <p className="text-white/80 text-sm font-medium mb-6">
                    {radarEvent.daysAway === 0 ? '🎉 Today!' : `In ${radarEvent.daysAway} day${radarEvent.daysAway > 1 ? 's' : ''} — ${format(radarEvent.date, 'MMM do')}`}
                  </p>
                </>
              ) : (
                <>
                  <TrendingUp className="mb-4 text-white/80" size={32} />
                  <h3 className="text-2xl font-black mb-2">No Upcoming Events</h3>
                  <p className="text-white/80 text-sm font-medium mb-6">Add contacts with birthdays & anniversaries to see celebrations here.</p>
                </>
              )}
              <Link to={radarEvent ? '/scheduler' : '/contacts'} className="bg-white text-brand-rose font-bold py-3 px-6 rounded-2xl w-full block text-center hover:scale-105 transition-transform active:scale-95">
                {radarEvent ? 'Schedule a Wish' : 'Add Contacts'}
              </Link>
            </div>
            <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-pink-400/20 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
