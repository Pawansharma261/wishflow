import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Users, Send, Clock, TrendingUp, ChevronRight, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { io } from 'socket.io-client';
import { RefreshCw, LayoutGrid, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { useRealtimeSync } from '../hooks/useRealtimeSync';
import { apiClient } from '../lib/apiClient';

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
  const [userId, setUserId] = useState(null);
  const [stats, setStats] = useState({ totalContacts: 0, sentWishes: 0, pendingWishes: 0 });
  const [upcomingWishes, setUpcomingWishes] = useState([]);
  const [radarEvent, setRadarEvent] = useState(null);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [allContacts, setAllContacts] = useState([]);
  const [statusDraft, setStatusDraft] = useState({ text: '', mediaUrl: '', recipients: [] });
  const [postingStatus, setPostingStatus] = useState(false);

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

  const handlePostStatus = async () => {
    if (!profile.whatsapp_connected) return alert('WhatsApp must be connected to post status.');
    if (!statusDraft.text && !statusDraft.mediaUrl) return alert('Please enter text or an image URL.');
    
    // Default to all contacts if none selected
    const recipientPhones = statusDraft.recipients.length > 0 
      ? statusDraft.recipients 
      : allContacts.map(c => c.phone).filter(p => !!p);

    if (recipientPhones.length === 0) return alert('No recipients available.');

    setPostingStatus(true);
    try {
      const res = await apiClient.post('/api/integrations/whatsapp/post-status', {
        text: statusDraft.text,
        mediaUrl: statusDraft.mediaUrl,
        recipients: recipientPhones
      });
      if (res.success) {
        alert(`Status posted successfully! 🚀 (${res.type})`);
        setStatusDraft({ text: '', mediaUrl: '', recipients: [] });
      } else {
        throw new Error(res.error || 'Failed to post status');
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
      .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for))
      .slice(0, 3) || [];
    setUpcomingWishes(upcoming);

    // Dynamic Celebration Radar — find the soonest upcoming birthday/anniversary
    const { data: contacts } = await supabase
      .from('contacts')
      .select('name, phone, birthday, anniversary')
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
          soonestEvent = { name: c.name, date: anniversary, type: 'Anniversary 💍' };
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
                <h2 className="text-2xl font-black text-white">WhatsApp Status Hub</h2>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-0.5">Automated Stories & Broadcasts</p>
              </div>
            </div>
            {profile.whatsapp_connected && (
              <div className="bg-green-500/10 text-green-400 text-[10px] font-black px-4 py-2 rounded-xl border border-green-500/20 uppercase tracking-widest">
                Active & Ready
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1 block">Status Content</label>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-white text-sm h-32 resize-none focus:outline-none focus:border-indigo-500/50 transition-all placeholder-white/20 font-medium"
                  placeholder="Share what's on your mind... (Caption if image exists)"
                  value={statusDraft.text}
                  onChange={e => setStatusDraft({...statusDraft, text: e.target.value})}
                />
              </div>
              <div className="space-y-4">
                 <label className="text-[10px] font-black text-white/30 uppercase tracking-widest px-1 block">Attach Image (URL)</label>
                 <div className="relative group">
                    <input 
                      type="url" 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 text-white/80 text-sm focus:outline-none focus:border-indigo-500 transition-all placeholder-white/10 font-medium pr-12"
                      placeholder="https://imageUrl.jpg"
                      value={statusDraft.mediaUrl}
                      onChange={e => setStatusDraft({...statusDraft, mediaUrl: e.target.value})}
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-indigo-400 transition-colors">
                      <ImageIcon size={20} />
                    </div>
                 </div>
                 <div className="flex bg-white/5 rounded-2xl p-4 items-center space-x-3 border border-white/5">
                    <MessageCircle size={18} className="text-white/20" />
                    <p className="text-[10px] text-white/40 font-medium leading-relaxed">Status updates will be visible to your listed contacts. Image updates usually get 400% more engagement!</p>
                 </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-2">
               <div className="flex items-center space-x-2">
                 <div className="flex -space-x-3">
                   {allContacts.slice(0, 5).map((c, i) => (
                      <div key={i} className="w-8 h-8 rounded-xl bg-white/10 border-2 border-[#0f0c29] flex items-center justify-center text-[10px] font-bold text-white/60">
                        {c?.name?.[0] || '?'}
                      </div>
                   ))}
                   {allContacts.length > 5 && (
                      <div className="w-8 h-8 rounded-xl bg-indigo-500 text-white border-2 border-[#0f0c29] flex items-center justify-center text-[10px] font-bold">
                        +{allContacts.length - 5}
                      </div>
                   )}
                 </div>
                 <span className="text-xs font-bold text-white/40 uppercase tracking-widest ml-2">Delivering to All Contacts</span>
               </div>

               <button 
                  onClick={handlePostStatus}
                  disabled={postingStatus || !profile.whatsapp_connected}
                  className="bg-white text-[#0f0c29] font-black px-10 py-5 rounded-2xl shadow-xl shadow-white/5 active:scale-95 transition-all flex items-center space-x-3 disabled:opacity-20 w-full md:w-auto justify-center"
               >
                  {postingStatus ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                  <span className="uppercase tracking-widest text-sm">Broadcast to Status</span>
               </button>
            </div>
          </div>
        </div>

        {/* Quick Media Send Tool */}
        <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 flex flex-col justify-between">
           <div>
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-6">
                <ImageIcon size={24} />
              </div>
              <h3 className="text-xl font-black text-white mb-2 leading-tight">Instant Image Wish</h3>
              <p className="text-white/40 text-xs font-medium leading-relaxed">Perfect for quick festival cards or birthday banners. Automate a visual greeting in seconds.</p>
           </div>
           <Link to="/scheduler" className="mt-8 bg-indigo-600 text-white font-black py-5 rounded-2xl text-center shadow-lg shadow-indigo-900/40 hover:scale-105 active:scale-95 transition-all uppercase tracking-widest text-xs">
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
                    {wish.occasion_type === 'birthday' ? '🎂' : wish.occasion_type === 'christmas' ? '🎄' : wish.occasion_type === 'diwali' ? '🪔' : '✨'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{wish.contact_name || wish.contacts?.name || '—'}</h4>
                    <p className="text-slate-500 text-sm capitalize">{wish.occasion_type} • {wish.scheduled_for ? format(new Date(wish.scheduled_for), 'MMM do, h:mm a') : '—'}</p>
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
