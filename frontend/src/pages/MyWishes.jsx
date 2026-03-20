import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, Filter, Clock, CheckCircle2, XCircle, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

const MyWishes = () => {
  const [wishes, setWishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchWishes();
  }, []);

  const fetchWishes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('wishes')
      .select('*, contacts(name)')
      .eq('user_id', user.id)
      .order('scheduled_datetime', { ascending: false });
    
    if (data) setWishes(data);
    setLoading(false);
  };

  const deleteWish = async (id) => {
    if (confirm('Delete this scheduled wish?')) {
      await supabase.from('wishes').delete().eq('id', id);
      fetchWishes();
    }
  };

  const filteredWishes = filter === 'all' ? wishes : wishes.filter(w => w.status === filter);

  const getStatusStyle = (status) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-600';
      case 'failed': return 'bg-red-100 text-red-600';
      default: return 'bg-orange-100 text-orange-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckCircle2 size={14} />;
      case 'failed': return <XCircle size={14} />;
      default: return <Clock size={14} />;
    }
  };

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">Timeline</h1>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl">
          {['all', 'pending', 'sent'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${filter === f ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="capitalize">{f}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden !p-0 border-none shadow-2xl shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Recipient</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Occasion</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Scheduled For</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Channels</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-5 text-xs font-black text-slate-400 uppercase tracking-widest"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredWishes.map((wish) => (
                <tr key={wish.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-6">
                    <p className="font-bold text-slate-900">{wish.contacts.name}</p>
                  </td>
                  <td className="px-8 py-6 uppercase font-black tracking-widest text-[10px] text-brand-violet">
                    {wish.occasion_type}
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-sm font-medium text-slate-700">{format(new Date(wish.scheduled_datetime), 'MMM do, yyyy')}</p>
                    <p className="text-xs text-slate-400 font-bold">{format(new Date(wish.scheduled_datetime), 'h:mm a')}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex -space-x-1">
                      {wish.channels.map(c => (
                        <div key={c} title={c} className="w-6 h-6 rounded-full border border-white bg-slate-200 flex items-center justify-center text-[8px] font-black uppercase text-slate-600">
                          {c[0]}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${getStatusStyle(wish.status)}`}>
                      {getStatusIcon(wish.status)}
                      <span>{wish.status}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => deleteWish(wish.id)} className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredWishes.length === 0 && (
             <div className="py-20 text-center">
                <p className="text-slate-400 font-medium">No results found.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyWishes;
