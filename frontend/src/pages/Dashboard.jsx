import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Calendar, Users, Send, Clock, TrendingUp, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState({ totalContacts: 0, sentWishes: 0, pendingWishes: 0 });
  const [upcomingWishes, setUpcomingWishes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Total Contacts
    const { count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    // Wishes
    const { data: wishes } = await supabase
      .from('wishes')
      .select('*, contacts(name)')
      .eq('user_id', user.id);

    const sent = wishes?.filter(w => w.status === 'sent').length || 0;
    const pending = wishes?.filter(w => w.status === 'pending').length || 0;

    setStats({ totalContacts: contactsCount || 0, sentWishes: sent, pendingWishes: pending });
    
    // Upcoming
    const upcoming = wishes
      ?.filter(w => w.status === 'pending')
      .sort((a, b) => new Date(a.scheduled_datetime) - new Date(b.scheduled_datetime))
      .slice(0, 3) || [];
    
    setUpcomingWishes(upcoming);
    setLoading(false);
  };

  const widgets = [
    { title: 'Total Contacts', value: stats.totalContacts, icon: <Users className="text-blue-500" />, color: 'bg-blue-50' },
    { title: 'Wishes Sent', value: stats.sentWishes, icon: <Send className="text-green-500" />, color: 'bg-green-50' },
    { title: 'Pending', value: stats.pendingWishes, icon: <Clock className="text-orange-500" />, color: 'bg-orange-50' },
  ];

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight mb-2">
            Hey there! 👋
          </h1>
          <p className="text-slate-500 font-medium">Your automated celebration assistant is ready.</p>
        </div>
        <Link to="/scheduler" className="btn-primary flex items-center justify-center space-x-2 w-full lg:w-auto">
          <Sparkles size={18} />
          <span>Automate New Wish</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {widgets.map((w, i) => (
          <div key={i} className="card flex items-center space-x-6">
            <div className={`p-4 rounded-2xl ${w.color}`}>
              {w.icon}
            </div>
            <div>
              <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mb-1">{w.title}</p>
              <h3 className="text-3xl font-black text-slate-900">{w.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900">Upcoming This Week</h2>
            <Link to="/wishes" className="text-brand-rose font-bold text-sm flex items-center hover:translate-x-1 transition-transform">
              View All <ChevronRight size={16} />
            </Link>
          </div>
          
          <div className="space-y-4">
            {upcomingWishes.length > 0 ? upcomingWishes.map((wish) => (
              <div key={wish.id} className="card flex items-center justify-between hover-lift">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-xl">
                    {wish.occasion_type === 'birthday' ? '🎂' : wish.occasion_type === 'christmas' ? '🎄' : '✨'}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{wish.contacts.name}</h4>
                    <p className="text-slate-500 text-sm">{wish.occasion_type} • {format(new Date(wish.scheduled_datetime), 'MMM do, h:mm a')}</p>
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
          <h2 className="text-2xl font-black text-slate-900">Celebration Radar</h2>
          <div className="bg-gradient-brand rounded-[2.5rem] p-8 text-white relative overflow-hidden">
             <div className="relative z-10">
                <TrendingUp className="mb-4 text-white/80" size={32} />
                <h3 className="text-2xl font-black mb-2">Valentine's Day</h3>
                <p className="text-white/80 text-sm font-medium mb-6">Coming up in 14 days. Want to generate some message ideas for your contacts?</p>
                <button className="bg-white text-brand-rose font-bold py-3 px-6 rounded-2xl w-full hover:scale-105 transition-transform active:scale-95">
                  Prepare Wishes
                </button>
             </div>
             <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-pink-400/20 rounded-full blur-3xl" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
