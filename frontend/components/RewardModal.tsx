
import React from 'react';
import { createPortal } from 'react-dom';

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  correctCount: number;
  totalCount: number;
  goldEarned: number;
}

const RewardModal: React.FC<RewardModalProps> = ({ isOpen, onClose, correctCount, totalCount, goldEarned }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center px-6 animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      
      <div className="relative w-full max-w-[380px] bg-white dark:bg-card-dark rounded-[48px] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-500">
        {/* Decorative Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-amber-400/20 blur-[80px] rounded-full pointer-events-none"></div>

        {/* Reward Visual (Claymorphic Coin) */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-amber-400 rounded-full flex items-center justify-center shadow-[inset_-4px_-4px_10px_rgba(0,0,0,0.1),inset_4px_4px_10px_rgba(255,255,255,0.5),0_20px_40px_rgba(251,191,36,0.3)] animate-bounce" style={{ animationDuration: '3s' }}>
            <span className="material-symbols-rounded text-white text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
          </div>
          <div className="absolute -top-2 -right-2 bg-black text-white px-3 py-1 rounded-full text-[12px] font-black border-2 border-white shadow-lg">
            +{goldEarned}G
          </div>
        </div>

        {/* Score Information */}
        <div className="space-y-2 mb-10 z-10">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500">Knowledge Mastered</p>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic uppercase">Excellent!</h2>
          <div className="flex items-center justify-center gap-2 mt-4 bg-slate-50 dark:bg-white/5 px-6 py-3 rounded-2xl border border-slate-100 dark:border-white/5">
            <span className="text-[15px] font-bold text-slate-400">Score:</span>
            <span className="text-[20px] font-black text-slate-900 dark:text-white">{correctCount} <span className="text-slate-300 font-medium">/ {totalCount}</span></span>
          </div>
        </div>

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-10 px-4 leading-relaxed">
          You've successfully analyzed the neural architecture. Your companion gained valuable experience!
        </p>

        {/* Action Button */}
        <button 
          onClick={onClose}
          className="w-full py-5 bg-black dark:bg-white text-white dark:text-black rounded-full font-black text-[15px] uppercase tracking-widest shadow-[0_12px_30px_rgba(0,0,0,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3"
        >
          Claim Rewards
          <span className="material-symbols-rounded text-[20px]">auto_awesome</span>
        </button>
      </div>
    </div>,
    document.body
  );
};

export default RewardModal;
