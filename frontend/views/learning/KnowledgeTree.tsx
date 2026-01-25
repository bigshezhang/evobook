
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const KnowledgeTree: React.FC = () => {
  const navigate = useNavigate();
  
  // Simulated course data
  const courses = [
    { title: "AI Foundations", progress: 42, color: "bg-primary" },
    { title: "UX Design Pro", progress: 15, color: "bg-indigo-400" },
    { title: "Python Basics", progress: 88, color: "bg-fuchsia-400" }
  ];
  
  const [courseIdx, setCourseIdx] = useState(0);
  const current = courses[courseIdx];

  const handleSwitch = (dir: 'next' | 'prev') => {
    if (dir === 'next') setCourseIdx((prev) => (prev + 1) % courses.length);
    else setCourseIdx((prev) => (prev - 1 + courses.length) % courses.length);
  };

  const handleNodeClick = (id: string, locked: boolean = false) => {
    if (!locked) {
      navigate('/knowledge-card');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] relative pb-40 overflow-x-hidden">
      <Header 
        title="Learning"
        showBack={false}
        rightAction={
          <div className="flex items-center gap-2 pr-2">
            <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">EvoBook</span>
          </div>
        }
      />

      {/* Switchable Course Progress Banner */}
      <div className="px-6 mb-4 relative mt-4">
        <div className={`${current.color} rounded-[28px] p-5 text-white shadow-xl flex items-center justify-between relative overflow-hidden transition-colors duration-500`}>
          
          {/* Left Switcher - Simplified Style */}
          <button 
            onClick={() => handleSwitch('prev')}
            className="absolute left-2 top-0 bottom-0 z-20 w-10 flex items-center justify-center opacity-40 hover:opacity-100 active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined font-black text-2xl">chevron_left</span>
          </button>

          <div className="flex-1 text-center px-8 z-10 animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-xl font-extrabold tracking-tight">{current.title}</h2>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="flex-1 max-w-[140px] bg-white/25 h-1.5 rounded-full overflow-hidden border border-white/10 shadow-inner">
                <div 
                  className="bg-white h-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700 ease-out" 
                  style={{ width: `${current.progress}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-black opacity-90 uppercase tracking-wider">{current.progress}% DONE</span>
            </div>
          </div>

          {/* Right Switcher - Simplified & Unified Style */}
          <button 
            onClick={() => handleSwitch('next')}
            className="absolute right-2 top-0 bottom-0 z-20 w-10 flex items-center justify-center opacity-40 hover:opacity-100 active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined font-black text-2xl">chevron_right</span>
          </button>

          {/* Background Decorative Element */}
          <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-15 pointer-events-none rotate-12">
            <span className="material-symbols-outlined" style={{ fontSize: '100px' }}>psychology</span>
          </div>
          <div className="absolute -left-10 -top-10 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      <div className="relative px-6 flex-1 mt-6">
        {/* SVG Connections Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#b6a3ff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#b6a3ff" stopOpacity="0.1" />
            </linearGradient>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
               <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
               <feOffset dx="0" dy="2" result="offsetblur" />
               <feComponentTransfer>
                 <feFuncA type="linear" slope="0.1" />
               </feComponentTransfer>
               <feMerge>
                 <feMergeNode />
                 <feMergeNode in="SourceGraphic" />
               </feMerge>
            </filter>
          </defs>
          
          <path d="M 190 55 Q 190 95 130 135" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeDasharray="5" filter="url(#shadow)" />
          <path d="M 190 55 Q 190 95 250 135" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeDasharray="5" filter="url(#shadow)" />
          
          <path d="M 130 160 Q 130 190 190 215" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeDasharray="5" filter="url(#shadow)" />
          <path d="M 250 160 Q 250 190 190 215" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeDasharray="5" filter="url(#shadow)" />
          
          <path d="M 190 255 Q 190 290 130 325" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeDasharray="5" filter="url(#shadow)" />
          <path d="M 190 255 Q 190 290 250 325" stroke="url(#lineGrad)" strokeWidth="2" fill="none" strokeDasharray="5" filter="url(#shadow)" />
        </svg>

        {/* Knowledge Nodes Container */}
        <div className="flex flex-col items-center gap-12 relative py-6 z-10">
          
          {/* Layer 1: Intro */}
          <button 
            onClick={() => handleNodeClick('intro')}
            className="node-3d w-44 py-4 bg-primary text-slate-800 rounded-2xl flex items-center justify-center gap-2 shadow-[0_6px_0_#9a8bd9] border border-white/20 transition-all"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
            <span className="text-sm font-black uppercase tracking-wider">Introduction</span>
          </button>

          {/* Layer 2: Foundations */}
          <div className="flex gap-4">
            <button 
              onClick={() => handleNodeClick('algebra')}
              className="node-3d w-36 py-4 bg-primary text-slate-800 rounded-2xl flex items-center justify-center gap-2 shadow-[0_6px_0_#9a8bd9] border border-white/20 transition-all"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
              <span className="text-sm font-black uppercase tracking-wider">Algebra</span>
            </button>
            <button 
              onClick={() => handleNodeClick('prob')}
              className="node-3d w-36 py-4 bg-primary text-slate-800 rounded-2xl flex items-center justify-center gap-2 shadow-[0_6px_0_#9a8bd9] border border-white/20 transition-all"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
              <span className="text-sm font-black uppercase tracking-wider">Probability</span>
            </button>
          </div>

          {/* Layer 3: Main Topic (Focus) */}
          <div className="relative">
             <button 
              onClick={() => handleNodeClick('nn')}
              className="node-3d w-48 py-4 bg-charcoal text-white rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_8px_0_#000000] border border-white/10 transition-all"
            >
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
              <span className="text-sm font-black uppercase tracking-widest">Neural Networks</span>
            </button>
          </div>

          {/* Layer 4: Advanced (Locked) */}
          <div className="flex gap-4">
            <button 
              onClick={() => handleNodeClick('backprop', true)}
              className="node-3d w-36 py-4 bg-slate-200 text-slate-400 rounded-2xl flex items-center justify-center gap-2 shadow-[0_5px_0_#CBD5E1] border border-slate-300 opacity-80 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span className="text-sm font-black uppercase tracking-wider">Backprop</span>
            </button>
            <button 
              onClick={() => handleNodeClick('opt', true)}
              className="node-3d w-36 py-4 bg-slate-200 text-slate-400 rounded-2xl flex items-center justify-center gap-2 shadow-[0_5px_0_#CBD5E1] border border-slate-300 opacity-80 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span className="text-sm font-black uppercase tracking-wider">Optimizers</span>
            </button>
          </div>
        </div>
      </div>

      <BottomNav activeTab="learning" />
    </div>
  );
};

export default KnowledgeTree;
