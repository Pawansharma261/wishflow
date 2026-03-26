import React from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CalendarHeart, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function MobileNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  // Don't show nav on auth or landing pages
  if (['/', '/auth', '/privacy'].includes(location.pathname)) return null;

  const NAV_ITEMS = [
    { icon: <LayoutDashboard size={24} />, label: 'Home', to: '/dashboard' },
    { icon: <Users size={24} />, label: 'Contacts', to: '/contacts' },
    { icon: <CalendarHeart size={24} />, label: 'Wishes', to: '/wishes' },
    { icon: <SettingsIcon size={24} />, label: 'Settings', to: '/settings' },
  ];

  return (
    <>
      {/* Floating Action / Scheduler Button */}
      <div className="fixed bottom-24 right-6 z-50">
         <button 
           onClick={() => navigate('/scheduler')}
           className="w-16 h-16 bg-gradient-to-tr from-brand-rose to-brand-purple rounded-full flex items-center justify-center text-white shadow-[0_10px_40px_-10px_rgba(244,63,94,0.5)] active:scale-90 transition-transform hover:rotate-180 duration-500"
         >
            <Sparkles size={24} />
         </button>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0f0c29]/90 backdrop-blur-xl border-t border-white/10 pb-safe">
        <div className="flex justify-around items-center h-20 px-2 relative">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => 
                `flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${
                  isActive ? 'text-brand-rose scale-110 -translate-y-1' : 'text-white/40 hover:text-white/70'
                }`
              }
            >
              {({ isActive }) => (
                 <>
                   <div className={`relative ${isActive ? 'animate-bounce-slow' : ''}`}>
                      {item.icon}
                      {isActive && <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-rose rounded-full" />}
                   </div>
                   <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>
                 </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
