import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Search, Trash2, Edit2, Phone, Camera, Smartphone, ScanFace, Contact, UserPlus, CheckCircle2 } from 'lucide-react';
import { Contacts as NativeContacts } from '@capacitor-community/contacts';

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [phoneSearchQuery, setPhoneSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', phone_number: '', occasion: 'birthday', occasion_date: '' });

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (data) setContacts(data);
    setLoading(false);
  };

  const handleImportContacts = async () => {
    try {
      setImporting(true);
      const permission = await NativeContacts.requestPermissions();
      if (permission.contacts !== 'granted') {
        alert("Permission denied. We cannot access your contacts.");
        setImporting(false);
        return;
      }
      
      const result = await NativeContacts.getContacts({
        projection: { name: true, phones: true }
      });
      
      const parsedContacts = result.contacts
        .filter(c => c.name?.display && c.phones && c.phones.length > 0)
        .map(c => ({
          name: c.name.display,
          phone: c.phones[0].number.replace(/[\s-]/g, '')
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
        
      setPhoneContacts(parsedContacts);
      setShowImportModal(true);
    } catch (err) {
      alert("Error accessing phone contacts: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const selectPhoneContact = (phoneContact) => {
    setFormData({
      id: null,
      name: phoneContact.name,
      phone_number: phoneContact.phone,
      occasion: 'birthday',
      occasion_date: ''
    });
    setShowImportModal(false);
    setShowForm(true);
  };

  const saveContact = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    
    // Mapping format for db
    const payload = {
      user_id: user.id,
      name: formData.name,
      phone_number: formData.phone_number,
      birthday: formData.occasion === 'birthday' ? formData.occasion_date : null,
      anniversary: formData.occasion === 'anniversary' ? formData.occasion_date : null
    };

    if (formData.id) {
      await supabase.from('contacts').update(payload).eq('id', formData.id);
    } else {
      await supabase.from('contacts').insert([payload]);
    }
    
    setShowForm(false);
    fetchContacts();
  };

  const editContact = (c) => {
    setFormData({
      id: c.id,
      name: c.name,
      phone_number: c.phone_number,
      occasion: c.anniversary ? 'anniversary' : 'birthday',
      occasion_date: c.anniversary || c.birthday || ''
    });
    setShowForm(true);
  };

  const deleteContact = async (id) => {
    if (confirm("Delete this contact?")) {
      await supabase.from('contacts').delete().eq('id', id);
      fetchContacts();
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (c.phone || c.phone_number || '').includes(searchQuery)
  );

  const filteredPhoneContacts = phoneContacts.filter(c => 
    c.name.toLowerCase().includes(phoneSearchQuery.toLowerCase()) || 
    c.phone?.includes(phoneSearchQuery)
  );

  return (
    <div className="container mx-auto px-4 py-8 pb-32">
      <div className="flex flex-col mb-8 mt-6">
        <h1 className="text-3xl font-black text-white mb-4">Contacts</h1>
        <p className="text-white/60 text-sm">Manage who you want to send wishes to.</p>
      </div>

      <div className="flex flex-col gap-4 mb-8">
        <button 
          onClick={handleImportContacts}
          disabled={importing}
          className="w-full bg-blue-500/20 border border-blue-400/30 text-blue-400 font-bold py-4 rounded-2xl flex items-center justify-center space-x-2 active:scale-95 transition-transform"
        >
          {importing ? <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Contact size={20} />}
          <span>{importing ? 'Importing...' : 'Import from Phone Book'}</span>
        </button>

        <button 
          onClick={() => {
            setFormData({ id: null, name: '', phone_number: '', occasion: 'birthday', occasion_date: '' });
            setShowForm(true);
          }}
          className="w-full bg-brand-rose text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-rose/30 active:scale-95 transition-transform flex items-center justify-center space-x-2"
        >
          <UserPlus size={20} />
          <span>Add Manually</span>
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
        <input 
          type="text" 
          placeholder="Search your contacts..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/40 focus:outline-none focus:bg-white/10"
        />
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-white/50 text-center py-10">Loading contacts...</p>
        ) : filteredContacts.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5">
            <Users size={48} className="mx-auto text-white/20 mb-4" />
            <p className="text-white/60 font-medium">No contacts found</p>
          </div>
        ) : (
          filteredContacts.map(c => (
            <div key={c.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white leading-tight">{c.name}</h3>
                  <p className="text-white/50 text-xs font-mono mt-1">{c.phone_number}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => editContact(c)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => deleteContact(c.id)} className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual / Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#1a1625] w-full max-w-sm rounded-[2rem] p-6 border border-white/10 shadow-2xl relative animate-scale-in">
            <h2 className="text-2xl font-black text-white mb-6">{formData.id ? 'Edit Contact' : 'New Contact'}</h2>
            
            <form onSubmit={saveContact} className="space-y-4">
              <div>
                <label className="text-white/50 text-xs font-bold uppercase tracking-widest pl-1 mb-1 block">Full Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" placeholder="John Doe" />
              </div>
              <div>
                <label className="text-white/50 text-xs font-bold uppercase tracking-widest pl-1 mb-1 block">Phone Number</label>
                <input required type="tel" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" placeholder="+91..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/50 text-xs font-bold uppercase tracking-widest pl-1 mb-1 block">Occasion</label>
                  <select value={formData.occasion} onChange={e => setFormData({...formData, occasion: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white appearance-none">
                    <option value="birthday" className="text-black">Birthday</option>
                    <option value="anniversary" className="text-black">Anniversary</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/50 text-xs font-bold uppercase tracking-widest pl-1 mb-1 block">Date</label>
                  <input type="date" value={formData.occasion_date} onChange={e => setFormData({...formData, occasion_date: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white" />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-4 font-bold text-white/60 bg-white/5 rounded-2xl">Cancel</button>
                <button type="submit" className="flex-1 py-4 font-bold text-white bg-brand-rose rounded-2xl shadow-lg shadow-brand-rose/20">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phone Book Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 shadow-2xl backdrop-blur-sm animate-fade-in pt-10 px-4">
          <div className="bg-[#1a1625] w-full max-w-sm rounded-[2rem] p-6 border border-white/10 shadow-2xl relative h-[80vh] flex flex-col">
            <h2 className="text-2xl font-black text-white mb-2">Phone Book</h2>
            <p className="text-white/50 text-sm mb-4">Select a contact to import.</p>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
              <input 
                type="text" 
                placeholder="Search phone contacts..." 
                value={phoneSearchQuery}
                onChange={e => setPhoneSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-white text-sm"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {filteredPhoneContacts.length === 0 ? (
                 <p className="text-white/40 text-center py-10 text-sm">No contacts found</p>
              ) : (
                filteredPhoneContacts.map((c, i) => (
                  <button 
                    key={i}
                    onClick={() => selectPhoneContact(c)}
                    className="w-full text-left bg-white/5 p-4 py-3 rounded-2xl flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-white text-sm">{c.name}</p>
                      <p className="text-xs text-white/50">{c.phone}</p>
                    </div>
                    <UserPlus size={16} className="text-brand-rose" />
                  </button>
                ))
              )}
            </div>

            <button onClick={() => setShowImportModal(false)} className="mt-4 w-full py-4 font-bold text-white/60 bg-white/5 rounded-2xl">
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
