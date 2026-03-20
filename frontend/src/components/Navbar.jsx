import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Users, Calendar, Settings, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const Navbar = () => {
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: <Sparkles size={20} /> },
    { name: 'Contacts', path: '/contacts', icon: <Users size={20} /> },
    { name: 'Schedule', path: '/scheduler', icon: <Calendar size={20} /> },
    { name: 'My Wishes', path: '/wishes', icon: <Calendar size={20} /> },
  ];

  return (
    <header className="hidden lg:block bg-white/80 backdrop-blur-md border-b sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="bg-gradient-brand w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Sparkles size={24} />
          </div>
          <span className="text-2xl font-black bg-gradient-brand bg-clip-text text-transparent tracking-tighter">
            WishFlow
          </span>
        </Link>

        <nav className="flex items-center space-x-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center space-x-2 font-medium transition-colors ${
                location.pathname === link.path 
                  ? 'text-brand-rose' 
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {link.icon}
              <span>{link.name}</span>
            </Link>
          ))}
        </nav>

        <div className="flex items-center space-x-4">
          <Link to="/settings" className="p-2 text-slate-500 hover:text-brand-violet transition-colors">
            <Settings size={22} />
          </Link>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
          >
            <LogOut size={22} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
