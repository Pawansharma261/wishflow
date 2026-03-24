import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Users, Calendar, Settings, LogOut, Gift } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Navbar = () => {
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: <Sparkles size={18} /> },
    { name: 'Contacts', path: '/contacts', icon: <Users size={18} /> },
    { name: 'Schedule', path: '/scheduler', icon: <Calendar size={18} /> },
    { name: 'My Wishes', path: '/wishes', icon: <Gift size={18} /> },
  ];

  return (
    <header className="hidden lg:block bg-white/5 backdrop-blur-2xl border-b border-white/10 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/30">
            <Sparkles size={20} className="text-white" />
          </div>
          <span className="text-xl font-black text-white tracking-tight">WishFlow</span>
        </Link>

        <nav className="flex items-center space-x-2">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200 ${
                location.pathname === link.path
                  ? 'bg-white/15 text-white shadow-inner'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {link.icon}
              <span>{link.name}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-2">
          <Link to="/settings" className="p-2.5 text-white/50 hover:text-white hover:bg-white/10 rounded-xl transition-all">
            <Settings size={20} />
          </Link>
          <button
            onClick={handleLogout}
            className="p-2.5 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded-xl transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
