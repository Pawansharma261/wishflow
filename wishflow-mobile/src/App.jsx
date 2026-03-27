import React, { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';
import { Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Scheduler from './pages/Scheduler';
import MyWishes from './pages/MyWishes';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Privacy from './pages/Privacy';

import Navbar from './components/Navbar';

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });


    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    CapacitorApp.addListener('appUrlOpen', async (event) => {
      const url = new URL(event.url);
      // Supabase sends tokens in the fragment (#) for OAuth
      const fragment = url.hash.substring(1);
      const params = new URLSearchParams(fragment || url.search);
      
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (!error) {
           // Force session update
           const { data: { session } } = await supabase.auth.getSession();
           setSession(session);
        }
      }
    });


    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0f0c29]">
        <motion.div 
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-24 h-24 bg-gradient-brand rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-brand-rose/20 mb-8"
        >
          <Sparkles className="text-white w-12 h-12" />
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-white text-4xl font-black tracking-[0.4em]"
        >
          WISHFLOW
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.3 }}
          transition={{ delay: 1 }}
          className="text-white text-[10px] font-black uppercase tracking-widest mt-6"
        >
          KP Technologies
        </motion.p>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        <main className={`flex-grow h-full`}>
          <Routes>
            <Route path="/" element={session ? <Dashboard /> : <Landing />} />
            <Route path="/dashboard" element={session ? <Dashboard /> : <Navigate to="/auth" />} />
            <Route path="/contacts" element={session ? <Contacts /> : <Navigate to="/auth" />} />
            <Route path="/scheduler" element={session ? <Scheduler /> : <Navigate to="/auth" />} />
            <Route path="/wishes" element={session ? <MyWishes /> : <Navigate to="/auth" />} />
            <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
            <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
        {session && <Navbar />}
      </div>
    </Router>
  );
};

export default App;
