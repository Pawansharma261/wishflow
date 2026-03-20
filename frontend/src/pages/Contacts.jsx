import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Plus, Search, Trash2, Edit2, Phone, Instagram, Calendar } from 'lucide-react';
import { format } from 'date-fns';

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    name: '', relationship: 'friend', phone_number: '', instagram_username: '', birthday: '', anniversary: '', callmebot_api_key: ''
  });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (data) setContacts(data);
    setLoading(false);
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('contacts').insert({ ...formData, user_id: user.id });
    if (!error) {
      setShowModal(false);
      setFormData({ name: '', relationship: 'friend', phone_number: '', instagram_username: '', birthday: '', anniversary: '', callmebot_api_key: '' });
      fetchContacts();
    }
  };

  const deleteContact = async (id) => {
    if (confirm('Delete this contact?')) {
      await supabase.from('contacts').delete().eq('id', id);
      fetchContacts();
    }
  };

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">My Contacts</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center justify-center space-x-2">
          <Plus size={20} />
          <span>Add New Contact</span>
        </button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-4 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Search contacts by name..." 
          className="input-field pl-12 h-14"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading contacts...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="card group hover:border-brand-rose/20 transition-all">
              <div className="flex justify-between items-start mb-6">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl font-black text-brand-violet">
                  {contact.name[0]}
                </div>
                <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 text-slate-400 hover:text-brand-violet"><Edit2 size={16} /></button>
                  <button onClick={() => deleteContact(contact.id)} className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
              
              <h3 className="text-xl font-black text-slate-900 mb-1">{contact.name}</h3>
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold uppercase tracking-wider mb-6">
                {contact.relationship}
              </span>

              <div className="space-y-3">
                <div className="flex items-center space-x-3 text-slate-500 text-sm">
                  <Phone size={14} />
                  <span>{contact.phone_number || 'No phone'}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-500 text-sm">
                  <Instagram size={14} />
                  <span>@{contact.instagram_username || 'n/a'}</span>
                </div>
                <div className="flex items-center space-x-3 text-slate-500 text-sm">
                  <Calendar size={14} />
                  <span>{contact.birthday ? format(new Date(contact.birthday), 'MMM do') : 'No birthday'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Contact Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-black mb-6">Add New Contact</h2>
            <form onSubmit={handleAddContact} className="space-y-4">
              <input 
                type="text" placeholder="Full Name" className="input-field" required
                value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
              />
              <select 
                className="input-field" 
                value={formData.relationship} onChange={e => setFormData({...formData, relationship: e.target.value})}
              >
                <option value="partner">Partner 💖</option>
                <option value="friend">Friend 🤝</option>
                <option value="family">Family 🏠</option>
                <option value="colleague">Colleague 💼</option>
              </select>
              <input 
                type="text" placeholder="WhatsApp Number (with country code)" className="input-field"
                value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})}
              />
              <input 
                type="text" placeholder="Instagram Username" className="input-field"
                value={formData.instagram_username} onChange={e => setFormData({...formData, instagram_username: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="text-xs font-bold text-slate-400 block mb-1 px-2 uppercase">Birthday</label>
                   <input 
                    type="date" className="input-field"
                    value={formData.birthday} onChange={e => setFormData({...formData, birthday: e.target.value})}
                  />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-400 block mb-1 px-2 uppercase">Anniversary</label>
                   <input 
                    type="date" className="input-field"
                    value={formData.anniversary} onChange={e => setFormData({...formData, anniversary: e.target.value})}
                  />
                 </div>
              </div>
              <input 
                type="text" placeholder="CallMeBot API Key (for WhatsApp)" className="input-field"
                value={formData.callmebot_api_key} onChange={e => setFormData({...formData, callmebot_api_key: e.target.value})}
              />
              
              <div className="flex space-x-4 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Contact</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
