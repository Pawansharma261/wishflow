import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Sparkles, Mail, Lock, User, Github } from 'lucide-react';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Verification email sent!');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
    if (error) alert(error.message);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-rose/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-violet/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-brand rounded-[2rem] text-white shadow-2xl shadow-brand-rose/30 mb-6 rotate-12 transition-transform hover:rotate-0 cursor-pointer">
            <Sparkles size={40} />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">WishFlow</h1>
          <p className="text-slate-500 mt-2 font-medium">Smart wishes for your loved ones ✨</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 p-8 border border-white relative z-10">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${isLogin ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2.5 rounded-xl font-bold transition-all ${!isLogin ? 'bg-white shadow-md text-slate-900' : 'text-slate-500'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  type="email" 
                  placeholder="Email Address" 
                  className="input-field pl-12"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-4 text-slate-400" size={18} />
                <input 
                  type="password" 
                  placeholder="Password" 
                  className="input-field pl-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Processing...' : (isLogin ? 'Welcome Back' : 'Create Account')}
            </button>
          </form>

          <div className="mt-8 flex items-center justify-between">
            <hr className="w-full border-slate-100" />
            <span className="px-4 text-slate-400 text-xs font-bold uppercase tracking-widest whitespace-nowrap">Or Continue With</span>
            <hr className="w-full border-slate-100" />
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <button 
              onClick={handleGoogleAuth}
              className="flex items-center justify-center space-x-2 py-3 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              <span className="font-bold text-slate-700 text-sm">Google</span>
            </button>
            <button className="flex items-center justify-center space-x-2 py-3 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-colors">
              <Github size={18} className="text-slate-700" />
              <span className="font-bold text-slate-700 text-sm">GitHub</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
