import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabaseClient';

// Pages
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import Scheduler from './pages/Scheduler';
import MyWishes from './pages/MyWishes';
import Settings from './pages/Settings';
import Auth from './pages/Auth';
import Privacy from './pages/Privacy';

// Components
import Navbar from './components/Navbar';
import MobileNav from './components/MobileNav';

const App = () => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // SECURITY GUARD: Ensure we don't hang forever if Supabase is slow or environment keys are missing
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[AUTH] Session check timed out. Falling back to public view.');
        setLoading(false);
      }
    }, 4500);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(err => {
      console.error('[AUTH] Failed to get session:', err);
      setLoading(false); // Still show the app (landing) even if auth fails
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-brand">
        <div className="animate-bounce-slow mb-4">
          <span className="text-6xl">🌟</span>
        </div>
        <h1 className="text-white text-2xl font-bold tracking-widest">WISHFLOW</h1>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col min-h-screen">
        {session && <Navbar />}
        <main className={`flex-grow ${session ? 'pb-24 lg:pb-0' : ''}`}>
          <Routes>
            <Route path="/" element={session ? <Dashboard /> : <Landing />} />
            <Route path="/contacts" element={session ? <Contacts /> : <Navigate to="/auth" />} />
            <Route path="/scheduler" element={session ? <Scheduler /> : <Navigate to="/auth" />} />
            <Route path="/wishes" element={session ? <MyWishes /> : <Navigate to="/auth" />} />
            <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" />} />
            <Route path="/auth" element={!session ? <Auth /> : <Navigate to="/" />} />
            <Route path="/login" element={<Navigate to="/auth" />} />
            <Route path="/privacy" element={<Privacy />} />
          </Routes>
        </main>
        {session && <MobileNav />}
      </div>
    </Router>
  );
};

export default App;
