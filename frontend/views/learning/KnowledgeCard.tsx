
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import ClarificationSection from './ClarificationSection';

const KnowledgeCard: React.FC = () => {
  const navigate = useNavigate();
  const [showComplete, setShowComplete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  // Internal card paging state
  const [currentPage, setCurrentPage] = useState(1);
  const totalPagesInCard = 5; 

  // Node progress state for Header component
  const nodeProgress = { current: 3, total: 3 };

  // Animation trigger for content changes
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  const handleNext = () => {
    if (currentPage < totalPagesInCard) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowComplete(true);
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/knowledge-tree');
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-white dark:bg-background-dark font-sans overflow-hidden">
      {/* Top Header - Restoring Menu style */}
      <header className="pt-12 px-5 pb-3 flex items-center justify-between w-full z-30 border-b border-black/[0.03] dark:border-white/[0.05] bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/knowledge-tree')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 active:scale-90 transition-transform"
          >
            <span className="material-symbols-rounded text-primary dark:text-white text-[20px]">menu</span>
          </button>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10"></div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-primary/40 dark:text-white/40 uppercase tracking-widest">Foundations</span>
          </div>
        </div>
        <div className="bg-accent-purple/10 px-2.5 py-1 rounded-full border border-accent-purple/20">
          <span className="text-[10px] font-extrabold text-accent-purple uppercase tracking-tight">Active Module</span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto no-scrollbar px-6 pt-6 pb-48 transition-all duration-300 ${animate ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
        <div className="mb-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-accent-purple mb-1.5 block">
            Module 03 • Deep Learning
          </span>
          <h1 className="text-[26px] font-extrabold text-primary dark:text-white leading-tight">
            Neural Networks Architecture
          </h1>
        </div>

        <div className="prose prose-sm max-w-none text-primary/80 dark:text-white/80 space-y-5">
          <p className="text-[15px] leading-relaxed">
            Neural networks are the backbone of modern AI. They are composed of computational nodes that mimic the way biological neurons transmit signals.
          </p>

          <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-5 border border-black/[0.03] dark:border-white/[0.03]">
            <h3 className="text-[14px] font-bold text-primary dark:text-white mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent-purple rounded-full"></span>
              Key Structural Elements
            </h3>
            <ul className="space-y-3 m-0 p-0 list-none">
              <li className="flex gap-3 text-[14px] leading-snug">
                <span className="text-accent-purple font-bold">•</span>
                <span><strong className="text-primary dark:text-white">Input Layer:</strong> Receives raw data like pixels or text embeddings.</span>
              </li>
              <li className="flex gap-3 text-[14px] leading-snug">
                <span className="text-accent-purple font-bold">•</span>
                <span><strong className="text-primary dark:text-white">Hidden Layers:</strong> Perform non-linear transformations using activation functions.</span>
              </li>
            </ul>
          </div>

          {/* Q&A Section Integration */}
          <ClarificationSection />
        </div>
      </main>

      {/* High-fidelity Footer */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-black/[0.05] dark:border-white/[0.05] pb-8 pt-4 px-6">
        {/* Segmented Progress Bars */}
        <div className="flex gap-1.5 mb-6 w-full">
          {[...Array(totalPagesInCard)].map((_, i) => (
            <div 
              key={i} 
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < currentPage ? 'bg-primary dark:bg-white' : 'bg-black/10 dark:bg-white/10'}`}
            ></div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Back Action */}
          <button 
            onClick={handleBack}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-white/5 neo-shadow active:scale-95 transition-all border border-black/[0.03] dark:border-white/10"
          >
            <span className="material-symbols-rounded text-[24px] text-black/30 dark:text-white/30">arrow_back</span>
          </button>

          {/* Ask Input */}
          <div className="flex-1 relative flex items-center">
            <input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/learning-chat')}
              className="w-full h-12 pl-12 pr-4 bg-white dark:bg-white/5 border border-black/[0.06] dark:border-white/10 rounded-full text-[14px] font-medium text-primary dark:text-white placeholder:text-black/20 dark:placeholder:text-white/20 focus:outline-none input-shadow" 
              placeholder="ask me" 
              type="text"
            />
            <div className="absolute left-4 flex items-center justify-center text-accent-purple">
              <span className="material-symbols-rounded text-[20px] fill-current">auto_awesome</span>
            </div>
          </div>

          {/* Forward Action */}
          <button 
            onClick={handleNext}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-white/5 neo-shadow active:scale-95 transition-all border border-black/[0.03] dark:border-white/10"
          >
            <span className="material-symbols-rounded text-[24px] text-black dark:text-white">arrow_forward</span>
          </button>
        </div>
      </footer>

      {/* Decorative Glows */}
      <div className="absolute top-20 -right-20 w-64 h-64 bg-accent-blue/10 blur-[80px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-40 -left-20 w-64 h-64 bg-accent-purple/10 blur-[80px] rounded-full pointer-events-none -z-10"></div>

      {/* Completion Modal */}
      {showComplete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[380px] bg-white dark:bg-card-dark rounded-[40px] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-100/10 rounded-3xl flex items-center justify-center mb-6">
              <span className="material-symbols-rounded text-amber-500 text-5xl">stars</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase italic">Goal Reached!</h2>
            <p className="text-slate-500 text-sm mb-6 font-medium px-4">You've finished this section. Great job staying focused!</p>
            <button 
              onClick={() => navigate('/game')}
              className="w-full py-4 bg-black dark:bg-white dark:text-black text-white rounded-full font-black text-[15px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Go to Travel
              <span className="material-symbols-rounded text-[18px]">sports_esports</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeCard;
