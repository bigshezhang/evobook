
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AssessmentChat: React.FC = () => {
  const navigate = useNavigate();
  const [isOnboarding, setIsOnboarding] = useState(true);

  useEffect(() => {
    const completed = localStorage.getItem('evo_onboarding_completed') === 'true';
    setIsOnboarding(!completed);
  }, []);

  const handleNext = () => {
    if (isOnboarding) {
      navigate('/companion');
    } else {
      navigate('/generating');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] font-display">
      <header className="sticky top-0 z-30 bg-background-light/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-8 h-8 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400">arrow_back_ios</span>
          </button>
          <div className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center border-2 border-white overflow-hidden">
            <img alt="AI Avatar" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBufi6vIupd79iwaMItI7pa065WbcFVQYd5Eb83gyp9Uu72dPsWgYGV6uhObIyOffgBUNsGns6F_BOXaFKsFFgmw1fKdqyqaJMe6665WGqw7KHwGVPLF2gZmkzMBPOPMf4vehRlyltv0HV6CCpxW_cWDoaqsNvsmcFd8UiG0z6dPvs4PdToxv50Lba_48fdo8EXhWPFsCPBbwQafVJHbAc2DPeOth4efr8KWT7Uin3IM_6luU4WxD_OKNYTsGnVR0FxlGov9KUMfl6U" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1a1b23]">Athena AI</h2>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-tight">
                {isOnboarding ? 'Customizing your path' : 'Crafting new module'}
              </span>
            </div>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#1a1b23]/40">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6 no-scrollbar">
        <div className="flex flex-col gap-2 max-w-[90%] self-start">
          <div className="relative bg-white p-5 rounded-bubble rounded-tl-none shadow-soft border border-white/50">
            <p className="text-[15px] font-semibold text-[#1a1b23]">
              {isOnboarding 
                ? "Hello! I'm Athena. To tailor your learning experience, I've prepared a quick assessment. Tell me about your preferences! 🦉"
                : "Welcome back! Let's define the parameters for your next learning adventure. What's the focus today? 🚀"}
            </p>
            <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full three-d-element opacity-80"></div>
          </div>
        </div>

        <div className="relative bg-white p-6 rounded-bubble shadow-soft flex flex-col gap-4 border border-white/50">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">Question 1/5</span>
            <div className="w-6 h-6 rounded-full three-d-element"></div>
          </div>
          <p className="text-[15px] font-bold text-[#1a1b23]">What is your primary goal for this session?</p>
          <div className="flex flex-wrap gap-2">
            <button className="px-4 py-2 rounded-full bg-charcoal text-white text-xs font-bold">Deep Mastery</button>
            <button className="px-4 py-2 rounded-full border border-gray-100 text-xs font-bold opacity-60">Quick Review</button>
            <button className="px-4 py-2 rounded-full border border-gray-100 text-xs font-bold opacity-60">Exam Prep</button>
          </div>
        </div>

        <div className="relative bg-white p-8 rounded-bubble shadow-soft text-center flex flex-col items-center gap-4 border border-white/50 mt-auto">
          <div className="w-12 h-12 rounded-full three-d-element flex items-center justify-center mb-1">
            <span className="material-symbols-outlined text-primary text-2xl">auto_awesome</span>
          </div>
          <button 
            onClick={handleNext}
            className="w-full bg-charcoal text-white rounded-full py-4 text-[15px] font-extrabold shadow-lg active:scale-95 transition-all"
          >
            {isOnboarding ? 'Start Crafting Course' : 'Generate New Path'}
          </button>
          <p className="text-[11px] font-medium text-black/40 px-4">
            {isOnboarding 
              ? "Or enter more information to customize your course further."
              : "AI will use your previous performance data to balance the difficulty."}
          </p>
        </div>
      </main>

      <div className="p-6 bg-background-light/95 backdrop-blur-xl border-t border-gray-100">
        <div className="relative flex items-center">
          <input className="w-full bg-white h-[60px] pl-6 pr-16 rounded-input border-none shadow-soft text-[15px] placeholder:text-black/20 font-medium" placeholder="Ask AI anything..." type="text"/>
          <button className="absolute right-2 w-11 h-11 bg-charcoal text-white rounded-full flex items-center justify-center active:scale-90 shadow-lg">
            <span className="material-symbols-outlined font-bold text-xl">arrow_upward</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentChat;
