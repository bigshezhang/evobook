
import React from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../utils/routes';

interface RewardModalProps {
  isOpen: boolean;
  onClose: () => void;
  diceRolls?: number;
  expEarned?: number;
  goldEarned?: number;
  /** Number of correctly answered questions */
  correctCount?: number;
  /** Total number of questions */
  totalCount?: number;
  onGoToGame?: () => void;
}

const RewardModal: React.FC<RewardModalProps> = ({
  isOpen,
  onClose,
  diceRolls = 2,
  expEarned = 50,
  goldEarned = 0,
  correctCount,
  totalCount,
  onGoToGame
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleGoToGame = () => {
    if (onGoToGame) {
      onGoToGame();
    } else {
      navigate(ROUTES.GAME);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center px-6 animate-in fade-in duration-300">
      <div className="absolute inset-0"></div>

      <div className="relative w-full max-w-[380px] bg-white dark:bg-card-dark rounded-[48px] p-10 flex flex-col items-center text-center shadow-[0_20px_40px_-10px_rgba(0,0,0,0.1)] animate-in zoom-in duration-500">
        {/* Celebration Image */}
        <div className="relative w-48 h-48 mb-6 overflow-hidden rounded-[32px]">
          <div className="absolute inset-0 bg-accent-orange/20 blur-[40px] rounded-full"></div>
          <img
            alt="Celebration Trophy"
            className="relative w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrcgiX1RzOuQ20foFUyXSErk5C9X0S8bbS29NNzsC5WAQgUxxR0MHE4pgzhU-HEy8WY6S9lCh4CCL3xGatnmmYUfqddUlO84eXSSpuNahqFlavZE-I1brddW4uqZfB22Zy4WQOVOO6IHRe2QmdS50DaT-AHJHamw1G7arlmj_MCxhK5LPnChTufwfJbHo3iIbtbCYW-SFbp9ckcoPDRaHyqZlm2Fn4lYNQZLr5N_c3v3MV2f6cjlnMOl0E7WFDjIvdW-Vm4wsIIxnu"
          />
        </div>

        {/* Title */}
        <h2 className="text-[32px] font-extrabold text-primary dark:text-white mb-3 tracking-tight">Section Complete!</h2>

        {/* Quiz Score */}
        {totalCount != null && correctCount != null && (
          <div className="mb-8 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-5 py-2.5 rounded-full border border-emerald-200 dark:border-emerald-700/30">
            <span className="material-symbols-rounded text-emerald-500 text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <span className="text-[15px] font-bold text-emerald-700 dark:text-emerald-300">
              {correctCount}/{totalCount} Correct
            </span>
          </div>
        )}

        {/* Reward Cards */}
        <div className="flex gap-3 mb-10 w-full">
          {goldEarned > 0 && (
            <div className="flex-1 bg-background-light dark:bg-white/5 p-4 rounded-3xl shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)] border border-black/[0.03] dark:border-white/[0.05] flex flex-col items-center gap-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <span className="text-[24px]">💰</span>
              </div>
              <span className="text-[13px] font-extrabold text-primary dark:text-white">+{goldEarned} Gold</span>
            </div>
          )}
          <div className="flex-1 bg-background-light dark:bg-white/5 p-4 rounded-3xl shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)] border border-black/[0.03] dark:border-white/[0.05] flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-accent-purple/20 rounded-xl flex items-center justify-center">
              <span className="material-symbols-rounded text-accent-purple text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span>
            </div>
            <span className="text-[13px] font-extrabold text-primary dark:text-white">+{diceRolls} Dice Rolls</span>
          </div>
          <div className="flex-1 bg-background-light dark:bg-white/5 p-4 rounded-3xl shadow-[0_8px_16px_-4px_rgba(0,0,0,0.08)] border border-black/[0.03] dark:border-white/[0.05] flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-accent-orange/20 rounded-xl flex items-center justify-center">
              <span className="material-symbols-rounded text-accent-orange text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
            </div>
            <span className="text-[13px] font-extrabold text-primary dark:text-white">+{expEarned} EXP</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-5">
          <button
            onClick={handleGoToGame}
            className="w-full bg-primary dark:bg-white text-white dark:text-black py-5 px-8 rounded-full font-extrabold text-[17px] flex items-center justify-center gap-2 shadow-[0_12px_24px_rgba(0,0,0,0.15)] active:scale-95 transition-all"
          >
            Go Explore World
            <span className="material-symbols-rounded text-[22px]">arrow_forward</span>
          </button>
          <button
            onClick={onClose}
            className="w-full text-primary/40 dark:text-white/40 font-bold text-[15px] hover:text-primary dark:hover:text-white transition-colors"
          >
            Continue Learning
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default RewardModal;
