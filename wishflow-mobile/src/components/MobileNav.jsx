import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Sparkles, Users, Calendar, Plus, Settings } from 'lucide-react';

const MobileNav = () => {
  const location = useLocation();

  const navLinks = [
    { name: 'Home', path: '/', icon: <Sparkles size={24} /> },
    { name: 'Contacts', path: '/contacts', icon: <Users size={24} /> },
    { name: 'Schedule', path: '/scheduler', icon: <Plus size={28} />, special: true },
    { name: 'Wishes', path: '/wishes', icon: <Calendar size={24} /> },
    { name: 'Settings', path: '/settings', icon: <Settings size={24} /> },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-4 py-2 flex justify-around items-center z-50 rounded-t-[2rem] shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
      {navLinks.map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={`flex flex-col items-center justify-center p-2 transition-all ${
            link.special 
              ? 'bg-gradient-brand text-white rounded-full -mt-10 w-16 h-16 shadow-xl active:scale-90'
              : location.pathname === link.path 
                ? 'text-brand-rose' 
                : 'text-slate-400'
          }`}
        >
          {link.icon}
          {!link.special && <span className="text-[10px] mt-1 font-semibold">{link.name}</span>}
        </Link>
      ))}
    </nav>
  );
};

export default MobileNav;
