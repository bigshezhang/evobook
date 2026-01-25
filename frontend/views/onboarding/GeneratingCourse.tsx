
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const GeneratingCourse: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Navigate to Knowledge Tree (Learning Management default) after generation
    const timer = setTimeout(() => navigate('/knowledge-tree'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#F8F9FD] p-8 overflow-hidden font-display">
      <div className="relative w-80 h-80 mb-12 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
          <circle cx="100" cy="100" fill="none" r="92" stroke="#E2E8F0" strokeWidth="10" className="opacity-30" />
          <circle cx="100" cy="100" fill="none" r="92" stroke="url(#purpleGradient)" strokeWidth="12" strokeDasharray="578" strokeDashoffset="203" className="transition-all duration-1000" />
          <defs>
            <linearGradient id="purpleGradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#D946EF" />
            </linearGradient>
          </defs>
        </svg>
        <div className="relative z-10 w-60 h-60 bg-white/40 rounded-full clay-shadow flex items-center justify-center backdrop-blur-md border border-white/60">
          <div className="relative flex flex-col items-center">
            <div className="w-28 h-36 bg-[#E0E7FF] rounded-[4rem] relative shadow-inner overflow-hidden flex flex-col items-center justify-center border-4 border-white">
              <div className="flex gap-2 mt-4">
                <div className="w-8 h-8 bg-white rounded-full border-2 border-slate-800 flex items-center justify-center">
                  <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
                </div>
                <div className="w-8 h-8 bg-white rounded-full border-2 border-slate-800 flex items-center justify-center">
                  <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="absolute -top-10 -right-6 w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-white">
              <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="absolute -bottom-2 px-4 py-1.5 bg-white/90 rounded-full shadow-lg border border-primary/20">
              <span className="text-xl font-extrabold text-primary tracking-tight">65%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center space-y-4 px-6">
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Crafting Your Path...</h2>
        <p className="text-sm font-medium text-slate-400">
          AI is tailoring your <span className="text-slate-900 font-bold">Neural Networks 101</span> journey...
        </p>
        <div className="flex gap-1.5 justify-center">
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
          <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
        </div>
      </div>
    </div>
  );
};

export default GeneratingCourse;
