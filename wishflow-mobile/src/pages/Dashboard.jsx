import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Users, Send, Clock, TrendingUp, ChevronRight, Gift, Loader2, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { io } from 'socket.io-client';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState({ whatsapp_connected: false, has_instagram: false });

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
        supabase.auth.getSession().then(({ data }) => {
          const token = data?.session?.access_token;
          if (token) socket.emit('register', { userId: user.id, token: `Bearer ${token}` });
        });
      });

      socket.on('whatsapp_status', (data) => {
        console.log('[WS:Dashboard] Status:', data.status);
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
    };

    setupSocket();

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
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
      .select('name, birthday, anniversary')
      .eq('user_id', user.id);

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
    { title: 'Contacts', value: stats.totalContacts, icon: <Users className="text-blue-400" />, color: 'bg-blue-500/10', link: '/contacts' },
    { title: 'Sent', value: stats.sentWishes, icon: <Send className="text-green-400" />, color: 'bg-green-500/10', link: '/wishes' },
    { title: 'Pending', value: stats.pendingWishes, icon: <Clock className="text-orange-400" />, color: 'bg-orange-500/10', link: '/wishes' },
  ];

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-2 mb-2">
               <div className="w-8 h-8 bg-gradient-brand rounded-xl flex items-center justify-center shadow-lg shadow-brand-rose/20">
                  <Sparkles size={16} className="text-white" />
               </div>
               <span className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">Dashboard</span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight">
              Hey there! 👋
            </h1>
          </div>
          <button 
            onClick={onRefresh}
            className={`p-3 rounded-2xl bg-white/5 border border-white/10 text-white/60 transition-all ${refreshing ? 'animate-spin' : 'active:scale-90'}`}
          >
            <TrendingUp size={20} />
          </button>
        </div>

        {/* Integration Status Quick Tiles */}
        <div className="grid grid-cols-2 gap-4 mb-8">
           <Link to="/settings" className={`backdrop-blur-xl border rounded-[2rem] p-5 flex flex-col justify-between h-32 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl ${
             profile.whatsapp_connected 
             ? 'bg-green-500/10 border-green-500/30 shadow-green-500/10' 
             : 'bg-white/5 border-white/10'
           }`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${profile.whatsapp_connected ? 'bg-green-500 text-white shadow-lg shadow-green-500/40' : 'bg-white/10 text-white/40'}`}>
                 <Phone size={20} />
              </div>
              <div>
                 <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${profile.whatsapp_connected ? 'text-green-400' : 'text-white/40'}`}>WhatsApp</p>
                 <p className="text-sm font-black text-white">{profile.whatsapp_connected ? 'Connected' : 'Disconnected'}</p>
              </div>
           </Link>
           
           <Link to="/settings" className={`backdrop-blur-xl border rounded-[2rem] p-5 flex flex-col justify-between h-32 transition-all hover:scale-[1.02] active:scale-95 shadow-2xl ${
             profile.has_instagram 
             ? 'bg-pink-500/10 border-pink-500/30 shadow-pink-500/10' 
             : 'bg-white/5 border-white/10'
           }`}>
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${profile.has_instagram ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/40' : 'bg-white/10 text-white/40'}`}>
                 <TrendingUp size={20} />
              </div>
              <div>
                 <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${profile.has_instagram ? 'text-pink-400' : 'text-white/40'}`}>Instagram</p>
                 <p className="text-sm font-black text-white">{profile.has_instagram ? 'Connected' : 'Disconnected'}</p>
              </div>
           </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {widgets.map((w, i) => (
            <Link to={w.link} key={i} className="bg-white/5 border border-white/10 backdrop-blur-md rounded-3xl p-5 flex flex-col items-center justify-center text-center transition-all active:scale-95">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${w.color}`}>
                {w.icon}
              </div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">{w.title}</p>
              <h3 className="text-xl font-black text-white">{w.value}</h3>
            </Link>
          ))}
        </div>

        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-5 px-1">
              <h2 className="text-xl font-black text-white">Upcoming</h2>
              <Link to="/wishes" className="text-brand-rose font-bold text-xs flex items-center bg-brand-rose/10 px-3 py-1.5 rounded-full">
                View All <ChevronRight size={14} className="ml-1" />
              </Link>
            </div>
            
            <div className="space-y-3">
              {upcomingWishes.length > 0 ? upcomingWishes.map((wish) => (
                <div key={wish.id} className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-[2rem] p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-xl shadow-inner">
                      {wish.occasion_type === 'birthday' ? '🎂' : wish.occasion_type === 'christmas' ? '🎄' : wish.occasion_type === 'diwali' ? '🪔' : '✨'}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{wish.contact_name || 'Anonymous'}</h4>
                      <p className="text-white/40 text-[11px] font-medium capitalize tracking-wide">{wish.occasion_type} • {wish.scheduled_for ? format(new Date(wish.scheduled_for), 'MMM do, p') : '—'}</p>
                    </div>
                  </div>
                  <div className="flex -space-x-1.5">
                    {wish.channels.map(c => (
                      <div key={c} className="w-7 h-7 rounded-full border border-slate-900 bg-white/10 flex items-center justify-center text-[8px] font-black text-white/80 uppercase">
                        {c[0]}
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="bg-white/5 rounded-[2rem] p-10 text-center border border-white/5 border-dashed">
                  <p className="text-white/30 text-sm font-medium">No wishes scheduled yet.</p>
                  <Link to="/scheduler" className="text-brand-rose font-black block mt-3 text-xs uppercase tracking-widest">Schedule Now</Link>
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="text-xl font-black text-white mb-5 px-1">Celebration Radar</h2>
            <div className="bg-gradient-brand rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-brand-rose/20">
              <div className="relative z-10">
                {radarEvent ? (
                  <>
                    <Gift className="mb-4 text-white/80" size={32} />
                    <p className="text-white/70 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{radarEvent.type}</p>
                    <h3 className="text-3xl font-black mb-1">{radarEvent.name}</h3>
                    <p className="text-white/80 text-sm font-medium mb-8">
                      {radarEvent.daysAway === 0 ? '🎉 Today!' : `In ${radarEvent.daysAway} day${radarEvent.daysAway > 1 ? 's' : ''} — ${format(radarEvent.date, 'MMMM do')}`}
                    </p>
                  </>
                ) : (
                  <>
                    <TrendingUp className="mb-4 text-white/80" size={32} />
                    <h3 className="text-2xl font-black mb-2">All Quiet...</h3>
                    <p className="text-white/80 text-sm font-medium mb-8 leading-relaxed">Add contacts with birthdays to see magic happen here.</p>
                  </>
                )}
                <Link to={radarEvent ? '/scheduler' : '/contacts'} className="bg-white text-brand-rose font-black py-4 px-6 rounded-2xl w-full block text-center shadow-xl shadow-white/10 active:scale-95 transition-transform text-sm uppercase tracking-widest">
                  {radarEvent ? 'Schedule a Wish' : 'Add Contacts'}
                </Link>
              </div>
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-white/20 rounded-full blur-3xl" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
