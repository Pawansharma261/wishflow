import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Calendar, Users, MessageSquare, Bell, Repeat, Star, ChevronRight, Instagram, Phone, Shield, Zap, Heart, Gift, ArrowRight, Check, Menu, X } from 'lucide-react';

const features = [
  {
    icon: <Calendar className="text-pink-500" size={28} />,
    title: 'Smart Scheduling',
    desc: 'Set it once, and WishFlow sends your wishes automatically every year on the right date — birthdays, anniversaries, festivals and more.',
    bg: 'bg-pink-50',
  },
  {
    icon: <MessageSquare className="text-violet-500" size={28} />,
    title: 'Multi-Channel Delivery',
    desc: 'Reach your loved ones wherever they are — WhatsApp, Instagram DM, or push notifications, all from one place.',
    bg: 'bg-violet-50',
  },
  {
    icon: <Repeat className="text-blue-500" size={28} />,
    title: 'Auto-Recurring Wishes',
    desc: 'Never miss an occasion again. WishFlow auto-reschedules recurring wishes for next year as soon as one is sent.',
    bg: 'bg-blue-50',
  },
  {
    icon: <Zap className="text-amber-500" size={28} />,
    title: 'AI Message Suggestions',
    desc: 'Stuck on what to write? Our AI generates warm, personalized messages tailored to the occasion and relationship.',
    bg: 'bg-amber-50',
  },
  {
    icon: <Users className="text-green-500" size={28} />,
    title: 'Contact Management',
    desc: 'Organize all your contacts with their special dates, phone numbers, and Instagram handles in one beautiful dashboard.',
    bg: 'bg-green-50',
  },
  {
    icon: <Shield className="text-indigo-500" size={28} />,
    title: 'Secure & Private',
    desc: 'Your data is encrypted and protected with row-level security. Your contacts and messages are yours alone.',
    bg: 'bg-indigo-50',
  },
];

const steps = [
  { emoji: '👤', title: 'Add Contacts', desc: 'Add your friends & family with their birthdays, anniversaries, and contact details.' },
  { emoji: '✨', title: 'Create a Wish', desc: 'Pick the occasion, write a message (or use AI suggestions), and choose when to send.' },
  { emoji: '📲', title: 'Choose Channel', desc: 'Select WhatsApp, Instagram DM, or push notifications — or all three at once.' },
  { emoji: '🎉', title: 'Auto-Delivered', desc: 'WishFlow sends your wishes exactly on time, automatically, every single year.' },
];

const occasions = ['🎂 Birthdays', '💍 Anniversaries', '🪔 Diwali', '🎄 Christmas', '🌙 Eid', '🌈 Holi', '🎆 New Year', '💝 Valentine\'s'];

const Landing = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [currentOccasion, setCurrentOccasion] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentOccasion(prev => (prev + 1) % occasions.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-white font-['Outfit',sans-serif]">
      {/* Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Sparkles className="text-white" size={20} />
            </div>
            <span className="text-xl font-black text-slate-900">WishFlow</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Features</a>
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">How it works</a>
            <a href="#occasions" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Occasions</a>
            <Link to="/auth" className="text-slate-600 hover:text-slate-900 font-medium transition-colors">Login</Link>
            <Link to="/auth" className="bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold px-6 py-2.5 rounded-2xl hover:shadow-lg hover:shadow-pink-200 transition-all hover:scale-105">
              Get Started Free
            </Link>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 rounded-xl hover:bg-slate-100 transition-colors">
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-6 py-4 space-y-4">
            <a href="#features" className="block text-slate-700 font-medium" onClick={() => setMenuOpen(false)}>Features</a>
            <a href="#how-it-works" className="block text-slate-700 font-medium" onClick={() => setMenuOpen(false)}>How it works</a>
            <Link to="/auth" className="block text-slate-700 font-medium" onClick={() => setMenuOpen(false)}>Login</Link>
            <Link to="/auth" className="block w-full text-center bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold px-6 py-3 rounded-2xl" onClick={() => setMenuOpen(false)}>
              Get Started Free
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-pink-100 via-violet-50 to-pink-50 rounded-full blur-3xl opacity-60 -z-10" />
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-pink-50 to-violet-50 border border-pink-100 text-pink-600 px-5 py-2.5 rounded-full text-sm font-bold mb-8 shadow-sm">
            <Heart size={14} className="fill-pink-500" />
            <span>Automate your celebrations ✨</span>
            <span className="text-pink-300 font-normal px-1">|</span>
            <span className="text-slate-500 font-medium">Powered by <strong className="text-slate-800">KP Technologies</strong></span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-6 leading-tight">
            Never Miss to Wish
            <br />
            <span className="relative">
              <span className="bg-gradient-to-r from-pink-500 to-violet-600 bg-clip-text text-transparent">
                {occasions[currentOccasion]}
              </span>
            </span>
          </h1>

          <p className="text-xl text-slate-500 font-medium mb-10 max-w-2xl mx-auto leading-relaxed">
            WishFlow automatically sends heartfelt wishes to your loved ones on WhatsApp and Instagram — on birthdays, anniversaries, festivals, and every special occasion. Set it once, celebrate forever.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth" className="group flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold px-8 py-4 rounded-2xl shadow-2xl shadow-pink-200 hover:shadow-pink-300 hover:scale-105 transition-all duration-300 text-lg w-full sm:w-auto justify-center">
              <span>Start For Free</span>
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a href="#how-it-works" className="flex items-center space-x-2 bg-white border-2 border-slate-200 text-slate-700 font-bold px-8 py-4 rounded-2xl hover:border-violet-300 hover:bg-violet-50 transition-all duration-300 text-lg w-full sm:w-auto justify-center">
              <span>See How It Works</span>
            </a>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            {['Free to start', 'No credit card', 'Works with WhatsApp', 'Instagram DM'].map(item => (
              <div key={item} className="flex items-center space-x-1.5">
                <Check size={14} className="text-green-500" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Floating cards */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/80 border border-slate-100 p-6 max-w-sm mx-auto md:mx-0 md:absolute md:top-0 md:left-0">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">📱</div>
              <div>
                <p className="font-bold text-slate-900 text-sm">WhatsApp Sent!</p>
                <p className="text-xs text-slate-500">2 min ago</p>
              </div>
            </div>
            <p className="text-slate-700 text-sm">"Happy Birthday Priya! 🎂 Hope your day is as amazing as you are!"</p>
          </div>

          <div className="hidden md:block bg-gradient-to-br from-pink-500 to-violet-600 rounded-3xl shadow-2xl shadow-violet-200 p-6 max-w-xs absolute top-0 right-0 text-white">
            <div className="flex items-center space-x-2 mb-3">
              <Gift size={20} />
              <p className="font-bold text-sm">Next Birthday</p>
            </div>
            <p className="text-2xl font-black mb-1">Rahul Kumar</p>
            <p className="text-white/80 text-sm">In 3 days — April 2nd 🎂</p>
            <div className="mt-4 bg-white/20 rounded-xl px-3 py-2 text-xs font-bold">Auto-wish scheduled ✅</div>
          </div>
        </div>
      </section>

      {/* Occasions Ticker */}
      <section id="occasions" className="py-12 bg-slate-900 overflow-hidden">
        <div className="flex animate-marquee space-x-8 whitespace-nowrap">
          {[...occasions, ...occasions].map((o, i) => (
            <span key={i} className="text-white/70 font-bold text-lg px-4">{o}</span>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">Everything You Need</h2>
            <p className="text-slate-500 text-lg font-medium max-w-xl mx-auto">Built for people who care deeply but lead busy lives.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group">
                <div className={`w-14 h-14 ${f.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4">How WishFlow Works</h2>
            <p className="text-slate-500 text-lg font-medium">Set up in minutes. Celebrate for a lifetime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="text-center relative">
                <div className="w-20 h-20 bg-gradient-to-br from-pink-50 to-violet-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm border border-pink-100">
                  {s.emoji}
                </div>
                <div className="absolute top-9 left-[60%] hidden lg:block w-full h-0.5 bg-gradient-to-r from-pink-200 to-violet-200" style={{ display: i < steps.length - 1 ? '' : 'none' }} />
                <span className="inline-block bg-pink-100 text-pink-600 font-black text-xs px-3 py-1 rounded-full mb-3">STEP {i + 1}</span>
                <h3 className="text-lg font-black text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="py-24 px-6 bg-gradient-to-br from-slate-900 to-violet-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6">Reach Them Where They Are</h2>
          <p className="text-white/70 text-lg mb-14">WishFlow connects with the platforms your loved ones already use.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '💬', name: 'WhatsApp', desc: 'Send instant personal messages via CallMeBot API integration', color: 'bg-green-500/20 border-green-500/30' },
              { icon: '📸', name: 'Instagram DM', desc: 'Reach contacts through their Instagram inbox automatically', color: 'bg-pink-500/20 border-pink-500/30' },
              { icon: '🔔', name: 'Push Notifications', desc: 'Instant browser & mobile push notifications via Firebase', color: 'bg-violet-500/20 border-violet-500/30' },
            ].map((c, i) => (
              <div key={i} className={`${c.color} border rounded-3xl p-8 text-white backdrop-blur-sm hover:scale-105 transition-transform duration-300`}>
                <div className="text-5xl mb-4">{c.icon}</div>
                <h3 className="text-xl font-black mb-3">{c.name}</h3>
                <p className="text-white/70 text-sm leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-gradient-to-br from-pink-50 to-violet-50 rounded-[3rem] p-12 border border-pink-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-pink-200/20 rounded-full blur-3xl" />
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6 relative z-10">
              Start Wishing Smarter 🌟
            </h2>
            <p className="text-slate-500 text-lg font-medium mb-10 relative z-10 max-w-xl mx-auto">
              Join thousands of people who never miss a birthday or special occasion. Free to get started, no credit card needed.
            </p>
            <Link to="/auth" className="inline-flex items-center space-x-2 bg-gradient-to-r from-pink-500 to-violet-600 text-white font-bold px-10 py-5 rounded-2xl shadow-2xl shadow-pink-200 hover:shadow-pink-300 hover:scale-105 transition-all duration-300 text-xl relative z-10">
              <Sparkles size={22} />
              <span>Create Your Free Account</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-violet-600 rounded-2xl flex items-center justify-center">
                  <Sparkles className="text-white" size={20} />
                </div>
                <span className="text-xl font-black">WishFlow</span>
              </div>
              <p className="text-white/60 leading-relaxed max-w-xs">Smart automated wishes for your loved ones. Never miss a birthday, anniversary, or special occasion again.</p>
            </div>
            <div>
              <h4 className="font-black text-white mb-4 uppercase tracking-widest text-xs">Product</h4>
              <div className="space-y-3 text-white/60">
                <a href="#features" className="block hover:text-white transition-colors">Features</a>
                <a href="#how-it-works" className="block hover:text-white transition-colors">How it Works</a>
                <Link to="/auth" className="block hover:text-white transition-colors">Login</Link>
                <Link to="/auth" className="block hover:text-white transition-colors">Sign Up</Link>
              </div>
            </div>
            <div>
              <h4 className="font-black text-white mb-4 uppercase tracking-widest text-xs">Legal</h4>
              <div className="space-y-3 text-white/60">
                <Link to="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                <Link to="/privacy" className="block hover:text-white transition-colors">Terms of Service</Link>
                <a href="mailto:pawansharmavats61@gmail.com" className="block hover:text-white transition-colors">Contact Us</a>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-white/40 text-sm">
            <p>© 2026 KP Technologies. All rights reserved.</p>
            <p className="mt-2 md:mt-0 font-medium tracking-wider">
              Powered by <span className="font-black text-white/80">KP Technologies</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
