import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, MessageSquare, Calendar, Heart, Gift, Users, ChevronRight, Zap, ShieldCheck, Check } from 'lucide-react';

const slides = [
  {
    id: 1,
    title: "Never Miss a Moment",
    description: "WishFlow automatically greets your loved ones on their special days so you never forget to care.",
    icon: <Calendar className="w-12 h-12 text-pink-400" />,
    color: "from-pink-500/20 to-violet-600/20",
    accent: "bg-pink-500",
    emoji: "🎂"
  },
  {
    id: 2,
    title: "WhatsApp & Instagram",
    description: "Automated delivery across all platforms your friends and family use every single day.",
    icon: <MessageSquare className="w-12 h-12 text-green-400" />,
    color: "from-green-500/20 to-blue-600/20",
    accent: "bg-green-500",
    emoji: "📲"
  },
  {
    id: 3,
    title: "Smart AI Wishes",
    description: "Stuck on what to say? Our AI generates perfect, personalized messages for any relationship.",
    icon: <Sparkles className="w-12 h-12 text-amber-400" />,
    color: "from-amber-500/20 to-orange-600/20",
    accent: "bg-amber-500",
    emoji: "✨"
  },
  {
    id: 4,
    title: "Join the Celebration",
    description: "Ready to start automating your kindness? Create your free account in seconds.",
    icon: <Heart className="w-12 h-12 text-blue-400" />,
    color: "from-blue-500/20 to-indigo-600/20",
    accent: "bg-blue-500",
    emoji: "🚀"
  }
];

const Landing = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setInterval(() => {
      if (currentSlide < slides.length - 1) {
        setCurrentSlide(prev => prev + 1);
      }
    }, 4500);
    return () => clearInterval(timer);
  }, [currentSlide]);

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(prev => prev + 1);
    } else {
      navigate('/auth');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0f0c29] overflow-hidden flex flex-col font-['Outfit',sans-serif]">
      {/* Background Animated Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[300px] h-[300px] bg-pink-600/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-violet-600/20 rounded-full blur-[100px] animate-pulse" />
      
      {/* Top Header - Branded */}
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="pt-12 px-8 flex items-center justify-between z-20"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand-rose/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">WishFlow</span>
        </div>
        <Link to="/auth" className="text-white/40 text-[10px] font-black uppercase tracking-widest px-4 py-2 border border-white/10 rounded-full hover:bg-white/5 transition-colors">
          Skip
        </Link>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 relative mt-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentSlide}
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -100, opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 px-10 flex flex-col items-center justify-center text-center"
          >
            {/* Visual Element */}
            <motion.div
              initial={{ scale: 0.5, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              className={`w-64 h-64 rounded-[3rem] bg-gradient-to-br ${slides[currentSlide].color} border border-white/10 flex items-center justify-center mb-12 shadow-2xl backdrop-blur-3xl relative`}
            >
              <div className="absolute top-[-20px] right-[-20px] text-6xl animate-bounce-slow">
                {slides[currentSlide].emoji}
              </div>
              {slides[currentSlide].icon}
              
              {/* Glass Micro-cards */}
              <div className="absolute -bottom-4 -right-4 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-xl opacity-80">
                <Check className="text-white w-4 h-4" />
              </div>
              <div className="absolute -top-4 -left-4 bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20 shadow-xl opacity-80">
                <Zap className="text-amber-400 w-4 h-4" />
              </div>
            </motion.div>

            {/* Text Content */}
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white text-4xl font-black mb-6 leading-tight tracking-tight"
            >
              {slides[currentSlide].title}
            </motion.h2>

            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-white/50 text-base font-medium leading-relaxed max-w-xs"
            >
              {slides[currentSlide].description}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer Controls */}
      <div className="pb-16 px-10 z-20">
        {/* Progress Bar */}
        <div className="flex space-x-2 mb-10 justify-center">
          {slides.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-500 ${i === currentSlide ? 'w-10 bg-white' : 'w-2 bg-white/10'}`} 
            />
          ))}
        </div>

        {/* Action Button */}
        <button 
          onClick={nextSlide}
          className="w-full h-20 bg-white rounded-[2rem] flex items-center justify-between px-8 group active:scale-95 transition-all shadow-white/10 shadow-2xl overflow-hidden relative"
        >
          <span className="text-[#0f0c29] font-black uppercase tracking-widest text-sm">
            {currentSlide === slides.length - 1 ? "Let's Celebrate" : "Continue"}
          </span>
          <div className="w-12 h-12 bg-[#0f0c29] rounded-2xl flex items-center justify-center transition-all group-hover:scale-110">
            {currentSlide === slides.length - 1 ? <ArrowRight className="text-white" /> : <ChevronRight className="text-white" />}
          </div>
          
          {/* Animated Background Filler for visual weight */}
          {currentSlide === slides.length - 1 && (
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute inset-0 bg-gradient-brand opacity-10 pointer-events-none" 
            />
          )}
        </button>

        {/* Powered By */}
        <p className="text-center mt-8 text-[9px] font-black text-white/20 uppercase tracking-[0.3em]">
          Powered by KP Technologies
        </p>
      </div>

      {/* Final Safety Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f0c29] via-transparent to-transparent pointer-events-none" />
    </div>
  );
};

export default Landing;
