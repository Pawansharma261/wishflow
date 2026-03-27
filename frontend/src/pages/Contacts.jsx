import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Users, Plus, Search, Trash2, Edit2, Phone, Instagram, Calendar, ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { useRealtimeSync } from '../hooks/useRealtimeSync';

// ─── Country Data ───────────────────────────────────────────────────────────
const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF', dial: '+93', flag: '🇦🇫' },
  { name: 'Albania', code: 'AL', dial: '+355', flag: '🇦🇱' },
  { name: 'Algeria', code: 'DZ', dial: '+213', flag: '🇩🇿' },
  { name: 'Argentina', code: 'AR', dial: '+54', flag: '🇦🇷' },
  { name: 'Australia', code: 'AU', dial: '+61', flag: '🇦🇺' },
  { name: 'Austria', code: 'AT', dial: '+43', flag: '🇦🇹' },
  { name: 'Bahrain', code: 'BH', dial: '+973', flag: '🇧🇭' },
  { name: 'Bangladesh', code: 'BD', dial: '+880', flag: '🇧🇩' },
  { name: 'Belgium', code: 'BE', dial: '+32', flag: '🇧🇪' },
  { name: 'Brazil', code: 'BR', dial: '+55', flag: '🇧🇷' },
  { name: 'Canada', code: 'CA', dial: '+1', flag: '🇨🇦' },
  { name: 'China', code: 'CN', dial: '+86', flag: '🇨🇳' },
  { name: 'Colombia', code: 'CO', dial: '+57', flag: '🇨🇴' },
  { name: 'Croatia', code: 'HR', dial: '+385', flag: '🇭🇷' },
  { name: 'Czech Republic', code: 'CZ', dial: '+420', flag: '🇨🇿' },
  { name: 'Denmark', code: 'DK', dial: '+45', flag: '🇩🇰' },
  { name: 'Egypt', code: 'EG', dial: '+20', flag: '🇪🇬' },
  { name: 'Ethiopia', code: 'ET', dial: '+251', flag: '🇪🇹' },
  { name: 'Finland', code: 'FI', dial: '+358', flag: '🇫🇮' },
  { name: 'France', code: 'FR', dial: '+33', flag: '🇫🇷' },
  { name: 'Germany', code: 'DE', dial: '+49', flag: '🇩🇪' },
  { name: 'Ghana', code: 'GH', dial: '+233', flag: '🇬🇭' },
  { name: 'Greece', code: 'GR', dial: '+30', flag: '🇬🇷' },
  { name: 'Hong Kong', code: 'HK', dial: '+852', flag: '🇭🇰' },
  { name: 'Hungary', code: 'HU', dial: '+36', flag: '🇭🇺' },
  { name: 'India', code: 'IN', dial: '+91', flag: '🇮🇳' },
  { name: 'Indonesia', code: 'ID', dial: '+62', flag: '🇮🇩' },
  { name: 'Iran', code: 'IR', dial: '+98', flag: '🇮🇷' },
  { name: 'Iraq', code: 'IQ', dial: '+964', flag: '🇮🇶' },
  { name: 'Ireland', code: 'IE', dial: '+353', flag: '🇮🇪' },
  { name: 'Israel', code: 'IL', dial: '+972', flag: '🇮🇱' },
  { name: 'Italy', code: 'IT', dial: '+39', flag: '🇮🇹' },
  { name: 'Japan', code: 'JP', dial: '+81', flag: '🇯🇵' },
  { name: 'Jordan', code: 'JO', dial: '+962', flag: '🇯🇴' },
  { name: 'Kenya', code: 'KE', dial: '+254', flag: '🇰🇪' },
  { name: 'Kuwait', code: 'KW', dial: '+965', flag: '🇰🇼' },
  { name: 'Lebanon', code: 'LB', dial: '+961', flag: '🇱🇧' },
  { name: 'Malaysia', code: 'MY', dial: '+60', flag: '🇲🇾' },
  { name: 'Mexico', code: 'MX', dial: '+52', flag: '🇲🇽' },
  { name: 'Morocco', code: 'MA', dial: '+212', flag: '🇲🇦' },
  { name: 'Nepal', code: 'NP', dial: '+977', flag: '🇳🇵' },
  { name: 'Netherlands', code: 'NL', dial: '+31', flag: '🇳🇱' },
  { name: 'New Zealand', code: 'NZ', dial: '+64', flag: '🇳🇿' },
  { name: 'Nigeria', code: 'NG', dial: '+234', flag: '🇳🇬' },
  { name: 'Norway', code: 'NO', dial: '+47', flag: '🇳🇴' },
  { name: 'Oman', code: 'OM', dial: '+968', flag: '🇴🇲' },
  { name: 'Pakistan', code: 'PK', dial: '+92', flag: '🇵🇰' },
  { name: 'Philippines', code: 'PH', dial: '+63', flag: '🇵🇭' },
  { name: 'Poland', code: 'PL', dial: '+48', flag: '🇵🇱' },
  { name: 'Portugal', code: 'PT', dial: '+351', flag: '🇵🇹' },
  { name: 'Qatar', code: 'QA', dial: '+974', flag: '🇶🇦' },
  { name: 'Romania', code: 'RO', dial: '+40', flag: '🇷🇴' },
  { name: 'Russia', code: 'RU', dial: '+7', flag: '🇷🇺' },
  { name: 'Saudi Arabia', code: 'SA', dial: '+966', flag: '🇸🇦' },
  { name: 'Singapore', code: 'SG', dial: '+65', flag: '🇸🇬' },
  { name: 'South Africa', code: 'ZA', dial: '+27', flag: '🇿🇦' },
  { name: 'South Korea', code: 'KR', dial: '+82', flag: '🇰🇷' },
  { name: 'Spain', code: 'ES', dial: '+34', flag: '🇪🇸' },
  { name: 'Sri Lanka', code: 'LK', dial: '+94', flag: '🇱🇰' },
  { name: 'Sweden', code: 'SE', dial: '+46', flag: '🇸🇪' },
  { name: 'Switzerland', code: 'CH', dial: '+41', flag: '🇨🇭' },
  { name: 'Taiwan', code: 'TW', dial: '+886', flag: '🇹🇼' },
  { name: 'Thailand', code: 'TH', dial: '+66', flag: '🇹🇭' },
  { name: 'Turkey', code: 'TR', dial: '+90', flag: '🇹🇷' },
  { name: 'UAE', code: 'AE', dial: '+971', flag: '🇦🇪' },
  { name: 'Ukraine', code: 'UA', dial: '+380', flag: '🇺🇦' },
  { name: 'United Kingdom', code: 'GB', dial: '+44', flag: '🇬🇧' },
  { name: 'United States', code: 'US', dial: '+1', flag: '🇺🇸' },
  { name: 'Vietnam', code: 'VN', dial: '+84', flag: '🇻🇳' },
];

// ─── Country Picker Component ────────────────────────────────────────────────
const CountryCodePicker = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="flex items-center space-x-2 bg-white/10 border border-white/20 rounded-xl px-3 py-3.5 text-white hover:bg-white/20 transition-all w-full min-w-[130px]"
      >
        <span className="text-xl">{selected.flag}</span>
        <span className="font-bold text-sm">{selected.dial}</span>
        <ChevronDown size={14} className={`ml-auto text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1e1b4b] border border-white/20 rounded-2xl shadow-2xl z-[200] overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                autoFocus
                type="text"
                placeholder="Search country or code..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-pink-500/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          {/* List */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-white/40 text-sm">No results</div>
            ) : (
              filtered.map(country => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => { onChange(country); setOpen(false); setSearch(''); }}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-white/10 transition-colors text-left ${selected.code === country.code ? 'bg-pink-500/20' : ''}`}
                >
                  <span className="text-xl">{country.flag}</span>
                  <span className="text-white text-sm flex-1 truncate">{country.name}</span>
                  <span className="text-white/50 text-xs font-mono">{country.dial}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const Contacts = () => {
  const [userId, setUserId] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES.find(c => c.code === 'IN'));
  const [editingId, setEditingId] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);

  const [formData, setFormData] = useState({
    name: '', relationship: 'friend', phone_number: '',
    instagram_username: '', birthday: '', anniversary: '', callmebot_api_key: ''
  });

  // REALTIME SYNC: Refresh data when anything changes on different devices
  useRealtimeSync({
    userId,
    onContactsChange: () => fetchContacts(),
  });

  useEffect(() => { fetchContacts(); }, []);

  const fetchContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data } = await supabase.from('contacts').select('*').eq('user_id', user.id).order('name');
    if (data) setContacts(data);
    setLoading(false);
  };

  const handleEditClick = (contact) => {
    let phoneNum = contact.phone || contact.phone_number || '';
    let matchedCountry = COUNTRIES.find(c => phoneNum.startsWith(c.dial));
    
    if (matchedCountry) {
       setSelectedCountry(matchedCountry);
       phoneNum = phoneNum.substring(matchedCountry.dial.length);
    } else {
       setSelectedCountry(COUNTRIES.find(c => c.code === 'IN'));
    }
    
    setFormData({
      name: contact.name,
      relationship: contact.relationship,
      phone_number: phoneNum,
      instagram_username: contact.instagram_username || '',
      birthday: contact.birthday ? contact.birthday.substring(0, 10) : '',
      anniversary: contact.anniversary ? contact.anniversary.substring(0, 10) : '',
      callmebot_api_key: contact.callmebot_api_key || ''
    });
    setEditingId(contact.id);
    setShowModal(true);
  };

  const closeFormModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({ name: '', relationship: 'friend', phone_number: '', instagram_username: '', birthday: '', anniversary: '', callmebot_api_key: '' });
    setSelectedCountry(COUNTRIES.find(c => c.code === 'IN'));
  };

  const handleSaveContact = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const fullPhone = formData.phone_number
      ? `${selectedCountry.dial}${formData.phone_number.replace(/^0/, '')}`
      : '';
    const payload = {
      name: formData.name,
      relationship: formData.relationship,
      phone: fullPhone,
      instagram_username: formData.instagram_username || null,
      birthday: formData.birthday || null,
      anniversary: formData.anniversary || null,
      callmebot_api_key: formData.callmebot_api_key || null
    };
      
    if (editingId) {
       const { error } = await supabase.from('contacts').update(payload).eq('id', editingId);
       if (!error) {
         fetchContacts();
         closeFormModal();
       }
    } else {
       const { error } = await supabase.from('contacts').insert({ ...payload, user_id: user.id });
       if (!error) {
         fetchContacts();
         closeFormModal();
       }
    }
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    const { error } = await supabase.from('contacts').delete().eq('id', contactToDelete);
    if (error) {
       console.error(error);
       alert('Failed to delete contact.');
    } else {
       fetchContacts();
    }
    setContactToDelete(null);
  };

  const filteredContacts = contacts.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="container mx-auto px-4 lg:px-10 py-8 lg:py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <h1 className="text-3xl lg:text-4xl font-black text-white tracking-tight">My Contacts</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center space-x-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold py-3 px-6 rounded-2xl hover:shadow-lg hover:scale-105 transition-all"
        >
          <Plus size={20} /><span>Add New Contact</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
        <input
          type="text"
          placeholder="Search contacts by name..."
          className="w-full bg-white/10 border border-white/20 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Contact grid */}
      {loading ? (
        <div className="text-center py-20 text-white/40">Loading contacts...</div>
      ) : filteredContacts.length === 0 ? (
        <div className="text-center py-20 text-white/30">
          <Users size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-semibold">No contacts yet</p>
          <p className="text-sm mt-1">Add your first contact to get started!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map((contact) => (
            <div key={contact.id} className="bg-white/10 backdrop-blur-md border border-white/15 rounded-3xl p-6 group hover:bg-white/15 transition-all">
              <div className="flex justify-between items-start mb-5">
                <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-violet-600 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-lg">
                  {contact.name[0]}
                </div>
                <div className="flex space-x-1 transition-opacity">
                  <button onClick={() => handleEditClick(contact)} className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all" title="Edit Contact"><Edit2 size={18} /></button>
                  <button onClick={() => setContactToDelete(contact.id)} className="p-2 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all" title="Delete Contact"><Trash2 size={18} /></button>
                </div>
              </div>
              <h3 className="text-lg font-black text-white mb-1">{contact.name}</h3>
              <span className="inline-block px-3 py-1 bg-white/10 text-white/60 rounded-full text-[10px] font-bold uppercase tracking-wider mb-5">
                {contact.relationship}
              </span>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2 text-white/60">
                  <Phone size={13} /><span>{contact.phone || contact.phone_number || 'No phone'}</span>
                </div>
                <div className="flex items-center space-x-2 text-white/60">
                  <Instagram size={13} /><span>@{contact.instagram_username || 'n/a'}</span>
                </div>
                <div className="flex items-center space-x-2 text-white/60">
                  <Calendar size={13} />
                  <span>{contact.birthday ? format(new Date(contact.birthday), 'MMM do') : 'No birthday'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add/Edit Contact Modal ───────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-[#1a1740] border border-white/15 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-7">
              <h2 className="text-2xl font-black text-white">{editingId ? 'Edit Contact' : 'Add New Contact'}</h2>
              <button onClick={closeFormModal} className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="space-y-4">
              {/* Name */}
              <input
                type="text" placeholder="Full Name" required
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all cursor-text font-medium"
                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
              />

              {/* Relationship */}
              <select
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all appearance-none cursor-pointer font-medium"
                value={formData.relationship} onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <option value="partner" style={{ background: '#1a1740' }}>Partner 💖</option>
                <option value="friend" style={{ background: '#1a1740' }}>Friend 🤝</option>
                <option value="family" style={{ background: '#1a1740' }}>Family 🏠</option>
                <option value="colleague" style={{ background: '#1a1740' }}>Colleague 💼</option>
              </select>

              {/* Phone with Country Code */}
              <div>
                <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2 block pl-1">WhatsApp Number</label>
                <div className="flex space-x-2">
                  <CountryCodePicker selected={selectedCountry} onChange={setSelectedCountry} />
                  <input
                    type="tel"
                    placeholder="Phone number"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all cursor-text"
                    value={formData.phone_number}
                    onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                  />
                </div>
                {formData.phone_number && (
                  <p className="text-white/40 text-xs mt-1 pl-1">
                    Will be saved as: {selectedCountry.dial}{formData.phone_number.replace(/^0/, '')}
                  </p>
                )}
              </div>

              {/* Instagram */}
              <input
                type="text" placeholder="Instagram Username (without @)"
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all cursor-text"
                value={formData.instagram_username} onChange={e => setFormData({ ...formData, instagram_username: e.target.value })}
              />

              {/* Birthday & Anniversary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2 block pl-1">Birthday</label>
                  <input type="date"
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all cursor-pointer font-medium"
                    value={formData.birthday} onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2 block pl-1">Anniversary</label>
                  <input type="date"
                    className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all cursor-pointer font-medium"
                    value={formData.anniversary} onChange={e => setFormData({ ...formData, anniversary: e.target.value })}
                  />
                </div>
              </div>

              {/* CallMeBot (Optional) */}
              <input
                type="text" placeholder="CallMeBot API Key (optional fallback)"
                className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3.5 text-white/40 focus:outline-none focus:ring-2 focus:ring-pink-500/50 transition-all"
                value={formData.callmebot_api_key} onChange={e => setFormData({ ...formData, callmebot_api_key: e.target.value })}
              />

              {/* Buttons */}
              <div className="flex space-x-3 pt-2">
                <button
                  type="button" onClick={closeFormModal}
                  className="flex-1 bg-white/10 border border-white/20 text-white font-bold py-3.5 rounded-2xl hover:bg-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:scale-[1.02] transition-all"
                >
                  {editingId ? 'Save Edits' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay */}
      {contactToDelete && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-scale-in">
             <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={32} />
             </div>
             <h3 className="text-2xl font-black text-center mb-2 text-slate-900">Delete Contact?</h3>
             <p className="text-slate-500 text-center mb-8 font-medium border-none outline-none">
               This contact will be permanently removed. Scheduled wishes for them may fail.
             </p>
             <div className="flex space-x-4">
                <button onClick={() => setContactToDelete(null)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl font-bold bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all">Delete</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
