import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Users, Send, Clock, TrendingUp, ChevronRight, Gift } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, differenceInDays, addYears, isBefore } from 'date-fns';
import { io } from 'socket.io-client';

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
  const [stats, setStats] = useState({ totalContacts: 0, sentWishes: 0, pendingWishes: 0 });
  const [upcomingWishes, setUpcomingWishes] = useState([]);
  const [radarEvent, setRadarEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ whatsapp_connected: false, has_instagram: false });

  useEffect(() => {
    fetchDashboardData();
    
    // Setup Socket for Real-time Status Sync
    let socket;
    const setupSocket = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://wishflow-backend-uyd2.onrender.com';
      socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
      
      socket.on('connect', () => {
        socket.emit('register', user.id);
      });

      socket.on('whatsapp_status', (data) => {
        setProfile(prev => ({ 
          ...prev, 
          whatsapp_connected: (data.status === 'connected') 
        }));
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
      .select('*, contacts(name)')
      .eq('user_id', user.id);

    const sent = wishes?.filter(w => w.status === 'sent').length || 0;
    const pending = wishes?.filter(w => w.status === 'pending').length || 0;
    setStats({ totalContacts: contactsCount || 0, sentWishes: sent, pendingWishes: pending });
    
    const upcoming = wishes
      ?.filter(w => w.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_datetime) - new Date(b.scheduled_datetime))
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
         <Link to="/settings" className={`backdrop-blur-md border rounded-2xl p-4 flex items-center space-x-3 transition-all hover:scale-[1.03] active:scale-95 shadow-lg ${
           profile.whatsapp_connected 
           ? 'bg-green-600/90 border-green-400/50 shadow-green-900/40' 
           : 'bg-white/5 border-white/10'
         }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.whatsapp_connected ? 'bg-white/20 text-white' : 'bg-white/10 text-white/40'}`}>
               <Send size={18} />
            </div>
            <div>
               <p className={`text-[10px] font-black uppercase tracking-tighter ${profile.whatsapp_connected ? 'text-white/80' : 'text-white/40'}`}>WhatsApp</p>
               <p className={`text-xs font-black ${profile.whatsapp_connected ? 'text-white' : 'text-white/60'}`}>{profile.whatsapp_connected ? 'CONNECTED' : 'OFFLINE'}</p>
            </div>
         </Link>
         
         <Link to="/settings" className={`backdrop-blur-md border rounded-2xl p-4 flex items-center space-x-3 transition-all hover:scale-[1.03] active:scale-95 shadow-lg ${
           profile.has_instagram 
           ? 'bg-gradient-to-tr from-pink-600 to-purple-600 border-pink-400/50 shadow-pink-900/40' 
           : 'bg-white/5 border-white/10'
         }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${profile.has_instagram ? 'bg-white/20 text-white' : 'bg-white/10 text-white/40'}`}>
               <TrendingUp size={18} />
            </div>
            <div>
               <p className={`text-[10px] font-black uppercase tracking-tighter ${profile.has_instagram ? 'text-white/80' : 'text-white/40'}`}>Instagram</p>
               <p className={`text-xs font-black ${profile.has_instagram ? 'text-white' : 'text-white/60'}`}>{profile.has_instagram ? 'CONNECTED' : 'OFFLINE'}</p>
            </div>
         </Link>
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
             {/* Main Banner */}
        <div className="relative group bg-slate-900 rounded-[2.5rem] p-8 md:p-12 border border-slate-800 shadow-2xl overflow-hidden mb-12">
          {/* Animated Background Gradients */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] mix-blend-screen opacity-50 group-hover:scale-110 transition-transform duration-700" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-pink-500/10 rounded-full blur-[100px] mix-blend-screen opacity-50 group-hover:translate-x-12 transition-transform duration-700" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-black tracking-widest uppercase mb-6 animate-fade-in">
                🚀 Welcome Back to WishFlow
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-6">
                Never Miss a <br />
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent italic">Moment</span>
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <Link to="/scheduler" className="bg-gradient-to-r from-indigo-600 to-violet-700 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-1 transition-all duration-300">
                  + Schedule Wish
                </Link>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                  <a 
                    href="https://expo.dev/accounts/wishflow/projects/wishflow/builds/90da7869-5354-4398-8b8e-9552833d1884"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-white/5 border border-white/10 text-white font-black px-6 py-4 rounded-2xl backdrop-blur-md hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all duration-300 group/btn"
                  >
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                       <Smartphone size={16} className="text-emerald-400" />
                    </div>
                    <span>Track Android App</span>
                  </a>
                  <a 
                    href="https://expo.dev/accounts/wishflow/projects/wishflow/builds/29fa97dc-7261-4271-bfda-e3b2880e71e2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 bg-white/5 border border-white/10 text-white font-black px-6 py-4 rounded-2xl backdrop-blur-md hover:bg-sky-500/20 hover:border-sky-500/50 transition-all duration-300 group/btn"
                  >
                    <div className="w-8 h-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                       <Smartphone size={16} className="text-sky-400" />
                    </div>
                    <span>Open iOS (Expo Go)</span>
                  </a>
                </div>
              </div>
            </div>
            
            <div className="relative w-full max-w-sm">
              <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500/20 to-pink-500/20 blur-2xl rounded-full" />
              <div className="relative bg-white/5 backdrop-blur-2xl rounded-3xl p-8 border border-white/10 shadow-2xl animate-float">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400/50" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/50" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/50" />
                  </div>
                  <div className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-white/40 font-black uppercase tracking-widest">
                    Next 24 Hours
                  </div>
                </div>
                
                <div className="space-y-6">
                  {upcomingWishes.length > 0 ? (
                    upcomingWishes.slice(0, 2).map((wish, i) => (
                      <div key={i} className="flex items-center gap-4 group/item">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-white/5 to-white/10 flex items-center justify-center border border-white/10 group-hover/item:scale-110 transition-transform">
                          <Gift size={20} className="text-pink-400" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-black text-sm">{wish.contacts.name}</p>
                          <p className="text-white/40 text-[10px] uppercase font-bold tracking-wider">{wish.occasion_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-indigo-400 font-black text-xs">Today</p>
                          <p className="text-white/30 text-[10px] font-bold">10:00 AM</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-white/40 text-xs font-bold uppercase tracking-widest">
                        Zero Wishes Scheduled
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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
                    <h4 className="font-bold text-slate-900">{wish.contacts.name}</h4>
                    <p className="text-slate-500 text-sm capitalize">{wish.occasion_type} • {format(new Date(wish.scheduled_datetime), 'MMM do, h:mm a')}</p>
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
