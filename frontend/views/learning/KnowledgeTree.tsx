
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const KnowledgeTree: React.FC = () => {
  const navigate = useNavigate();
  
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
          
          <button 
            onClick={() => handleSwitch('prev')}
            className="absolute left-2 top-0 bottom-0 z-20 w-10 flex items-center justify-center opacity-40 hover:opacity-100 active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined font-black text-2xl">chevron_left</span>
          </button>

          {/* Banner content area - Click to go to detail */}
          <div 
            onClick={() => navigate('/course-detail')}
            className="flex-1 text-center px-8 z-10 animate-in fade-in slide-in-from-right-4 duration-300 cursor-pointer"
          >
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

          <button 
            onClick={() => handleSwitch('next')}
            className="absolute right-2 top-0 bottom-0 z-20 w-10 flex items-center justify-center opacity-40 hover:opacity-100 active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined font-black text-2xl">chevron_right</span>
          </button>

          <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-15 pointer-events-none rotate-12">
            <span className="material-symbols-outlined" style={{ fontSize: '100px' }}>psychology</span>
          </div>
          <div className="absolute -left-10 -top-10 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      <div className="relative px-6 flex-1 mt-6">
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFB938" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E5E7EB" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          <path d="M 190 55 Q 190 95 130 135" stroke="#FFB938" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M 190 55 Q 190 95 250 135" stroke="#FFB938" strokeWidth="6" fill="none" strokeLinecap="round" />
          
          <path d="M 130 160 Q 130 190 190 215" stroke="#FFB938" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M 250 160 Q 250 190 190 215" stroke="#FFB938" strokeWidth="6" fill="none" strokeLinecap="round" />
          
          <path d="M 190 255 Q 190 290 130 325" stroke="#E5E7EB" strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M 190 255 Q 190 290 250 325" stroke="#E5E7EB" strokeWidth="6" fill="none" strokeLinecap="round" />
        </svg>

        <div className="flex flex-col items-center gap-12 relative py-6 z-10">
          {/* Node: Completed Style */}
          <button 
            onClick={() => handleNodeClick('intro')}
            className="node-3d node-completed w-44 py-4 rounded-xl flex items-center justify-center gap-2 border border-white/20"
          >
            <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
            <span className="text-xs font-black uppercase tracking-wider">Introduction</span>
          </button>

          <div className="flex gap-4">
            <button 
              onClick={() => handleNodeClick('algebra')}
              className="node-3d node-completed w-36 py-4 rounded-xl flex items-center justify-center gap-2 border border-white/20"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
              <span className="text-xs font-black uppercase tracking-wider">Algebra</span>
            </button>
            <button 
              onClick={() => handleNodeClick('prob')}
              className="node-3d node-completed w-36 py-4 rounded-xl flex items-center justify-center gap-2 border border-white/20"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">edit_note</span>
              <span className="text-xs font-black uppercase tracking-wider">Probability</span>
            </button>
          </div>

          <div className="relative">
             {/* Node: Current Style (Neural Networks) */}
             <button 
              onClick={() => handleNodeClick('nn')}
              className="node-3d node-current w-52 py-4 rounded-xl flex items-center justify-center gap-2.5 ring-8 ring-charcoal/5"
            >
              <span className="material-symbols-outlined text-[20px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              <span className="text-xs font-black uppercase tracking-widest">Neural Networks</span>
            </button>
          </div>

          <div className="flex gap-4">
            {/* Node: Locked Style */}
            <button 
              onClick={() => handleNodeClick('backprop', true)}
              className="node-3d node-locked w-36 py-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">quiz</span>
              <span className="text-xs font-black uppercase tracking-wider">Backprop</span>
            </button>
            <button 
              onClick={() => handleNodeClick('opt', true)}
              className="node-3d node-locked w-36 py-4 rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-[18px]">lock</span>
              <span className="text-xs font-black uppercase tracking-wider">Optimizers</span>
            </button>
          </div>
        </div>
      </div>

      <BottomNav activeTab="learning" />
    </div>
  );
};

export default KnowledgeTree;
