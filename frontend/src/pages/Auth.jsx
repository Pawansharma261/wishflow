import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Link } from 'react-router-dom';
import {
  Sparkles, Mail, Lock, Eye, EyeOff, Phone, User, CreditCard, ArrowRight, ArrowLeft, Instagram
} from 'lucide-react';

const REDIRECT_URL = window.location.origin;

const FloatingOrb = ({ className }) => (
  <div className={`absolute rounded-full blur-3xl opacity-30 animate-pulse ${className}`} />
);

const InputField = ({ icon: Icon, label, name, type = 'text', value, onChange, placeholder, required, right }) => (
  <div className="space-y-1.5">
    <label className="text-sm font-semibold text-white/80 pl-1">{label}</label>
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" size={18} />
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full bg-white/10 border border-white/20 rounded-2xl pl-11 pr-11 py-3.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 focus:bg-white/15 transition-all duration-200 text-sm"
      />
      {right && <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>}
    </div>
  </div>
);

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [signupStep, setSignupStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [formData, setFormData] = useState({
    email: '', password: '', confirmPassword: '',
    firstName: '', lastName: '', mobile: '', govtId: '',
  });

  const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

  const switchMode = (login) => { setIsLogin(login); setSignupStep(1); };

  const handleAuth = async (e) => {
    e.preventDefault();
    if (!isLogin && formData.password !== formData.confirmPassword) {
      return alert('Passwords do not match!');
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email, password: formData.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              first_name: formData.firstName,
              last_name: formData.lastName,
              full_name: `${formData.firstName} ${formData.lastName}`,
              mobile: formData.mobile,
              govt_id: formData.govtId,
            },
            emailRedirectTo: REDIRECT_URL,
          },
        });
        if (error) throw error;
        alert('✅ Account created! Please check your email to verify your account.');
      }
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: REDIRECT_URL },
    });
    if (error) alert(error.message);
  };

  const handleInstagram = () => {
    alert('📸 Instagram login is pending Meta App Review approval (3-7 business days). Use Google or Email login for now!');
  };

  const step1Valid = formData.email && formData.password && formData.confirmPassword && formData.password === formData.confirmPassword;

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-4 overflow-hidden bg-[#0f0c29]">
      {/* Animated Background */}
      <FloatingOrb className="w-[500px] h-[500px] bg-pink-500 top-[-10%] left-[-15%]" />
      <FloatingOrb className="w-[400px] h-[400px] bg-violet-600 bottom-[-10%] right-[-10%]" />
      <FloatingOrb className="w-[300px] h-[300px] bg-blue-500 top-[40%] left-[60%]" />
      <FloatingOrb className="w-[200px] h-[200px] bg-pink-400 bottom-[20%] left-[5%]" />

      {/* Noise overlay for texture */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] opacity-90" />

      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
      }} />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <Link to="/" className="flex flex-col items-center mb-8 group">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-violet-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-pink-500/30 mb-4 group-hover:scale-105 transition-transform rotate-3 group-hover:rotate-0">
            <Sparkles className="text-white" size={38} />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight">WishFlow</h1>
          <p className="text-white/60 mt-1 font-medium text-sm">Smart wishes for your loved ones ✨</p>
        </Link>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] p-8 shadow-2xl">

          {/* Tab switcher */}
          <div className="flex bg-white/10 p-1.5 rounded-2xl mb-8">
            <button
              onClick={() => switchMode(true)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/70 hover:text-white'}`}
            >
              Login
            </button>
            <button
              onClick={() => switchMode(false)}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 ${!isLogin ? 'bg-white text-slate-900 shadow-lg' : 'text-white/70 hover:text-white'}`}
            >
              Sign Up
            </button>
          </div>

          {/* LOGIN FORM */}
          {isLogin && (
            <form onSubmit={handleAuth} className="space-y-5">
              <InputField icon={Mail} label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
              <InputField
                icon={Lock} label="Password" name="password"
                type={showPass ? 'text' : 'password'} value={formData.password} onChange={handleChange}
                placeholder="Your password" required
                right={
                  <button type="button" onClick={() => setShowPass(!showPass)} className="text-white/50 hover:text-white transition-colors">
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />
              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold py-4 rounded-2xl hover:shadow-lg hover:shadow-pink-500/30 hover:scale-[1.02] transition-all duration-300 active:scale-95 disabled:opacity-60 flex items-center justify-center space-x-2">
                {loading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><span>Welcome Back</span><ArrowRight size={18} /></>}
              </button>
            </form>
          )}

          {/* SIGNUP FORM — Step 1: Credentials */}
          {!isLogin && signupStep === 1 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Step 1 of 2 — Account Details</span>
              </div>
              <InputField icon={Mail} label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" required />
              <InputField
                icon={Lock} label="Password" name="password"
                type={showPass ? 'text' : 'password'} value={formData.password} onChange={handleChange}
                placeholder="Min. 6 characters" required
                right={<button type="button" onClick={() => setShowPass(!showPass)} className="text-white/50 hover:text-white transition-colors">{showPass ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
              />
              <InputField
                icon={Lock} label="Confirm Password" name="confirmPassword"
                type={showConfirm ? 'text' : 'password'} value={formData.confirmPassword} onChange={handleChange}
                placeholder="Repeat your password" required
                right={<button type="button" onClick={() => setShowConfirm(!showConfirm)} className="text-white/50 hover:text-white transition-colors">{showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}</button>}
              />
              {formData.password && formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-red-400 text-xs pl-1">⚠️ Passwords do not match</p>
              )}
              <button
                disabled={!step1Valid}
                onClick={() => setSignupStep(2)}
                className="w-full bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold py-4 rounded-2xl hover:shadow-lg hover:shadow-pink-500/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <span>Continue</span><ArrowRight size={18} />
              </button>
            </div>
          )}

          {/* SIGNUP FORM — Step 2: Personal Details */}
          {!isLogin && signupStep === 2 && (
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="text-center mb-2">
                <span className="text-white/50 text-xs font-bold uppercase tracking-widest">Step 2 of 2 — Personal Info</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField icon={User} label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} placeholder="Pawan" required />
                <InputField icon={User} label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Sharma" required />
              </div>
              <InputField icon={Phone} label="Mobile Number" name="mobile" type="tel" value={formData.mobile} onChange={handleChange} placeholder="+91 98765 43210" required />
              <InputField icon={CreditCard} label="Govt. ID Number" name="govtId" value={formData.govtId} onChange={handleChange} placeholder="Aadhaar / PAN / Passport" required />

              {/* Privacy Policy Agreement */}
              <label className="flex items-start space-x-3 bg-white/5 border border-white/10 p-3 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                <input 
                  type="checkbox" 
                  checked={agreePrivacy} 
                  onChange={(e) => setAgreePrivacy(e.target.checked)} 
                  className="mt-1 w-4 h-4 rounded border-white/30 text-pink-500 focus:ring-pink-500/50 bg-white/10"
                  required
                />
                <span className="text-xs text-white/70 leading-snug">
                  I agree to the <Link to="/privacy" className="text-white font-bold hover:underline" target="_blank">Privacy Policy</Link> and Terms of Service.
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSignupStep(1)} className="flex items-center justify-center space-x-1 bg-white/10 border border-white/20 text-white font-bold py-3.5 px-5 rounded-2xl hover:bg-white/20 transition-all">
                  <ArrowLeft size={18} />
                </button>
                <button type="submit" disabled={loading || !formData.firstName || !formData.mobile || !formData.govtId || !agreePrivacy}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:shadow-pink-500/30 hover:scale-[1.02] transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2">
                  {loading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <><span>Create Account</span><Sparkles size={16} /></>}
                </button>
              </div>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center my-6">
            <div className="flex-1 h-px bg-white/20" />
            <span className="px-4 text-white/40 text-xs font-bold uppercase tracking-widest">Or</span>
            <div className="flex-1 h-px bg-white/20" />
          </div>

          {/* Social login */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogle}
              className="flex items-center justify-center space-x-2.5 bg-white/10 border border-white/20 text-white font-semibold py-3 rounded-2xl hover:bg-white/20 transition-all duration-200 hover:scale-[1.02]"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              <span className="text-sm">Google</span>
            </button>
            <button
              onClick={handleInstagram}
              className="flex items-center justify-center space-x-2.5 bg-gradient-to-r from-pink-500/20 to-violet-600/20 border border-pink-500/30 text-white font-semibold py-3 rounded-2xl hover:bg-pink-500/30 transition-all duration-200 hover:scale-[1.02]"
            >
              <Instagram size={16} className="text-pink-400" />
              <span className="text-sm">Instagram</span>
            </button>
          </div>
        </div>

        <div className="mt-8 text-center space-y-2 text-white/40 text-xs">
          <p>
            By continuing, you agree to our{' '}
            <Link to="/privacy" className="text-white/60 underline hover:text-white transition-colors">Privacy Policy</Link>
          </p>
          <p className="font-medium tracking-wide">
            Powered by <span className="font-black text-white/80">KP Technologies</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
