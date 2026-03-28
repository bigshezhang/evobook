
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
  className?: string;
  progress?: {
    current: number;
    total: number;
  };
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  showBack = true, 
  onBack, 
  rightAction, 
  subtitle,
  className = "",
  progress
}) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className={`pt-4 px-5 pb-3 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-40 border-b border-black/[0.03] ${className}`}>
      <div className="flex items-center gap-3">
        {showBack && (
          <button 
            onClick={handleBack} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 active:scale-90 transition-transform"
          >
            <span className="material-symbols-rounded text-slate-900 text-[20px]">{progress ? 'close' : 'arrow_back'}</span>
          </button>
        )}
        
        {progress && (
          <>
            <div className="h-4 w-px bg-black/10"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-[0.1em]">
                {subtitle || `Section ${Math.ceil(progress.current / 5).toString().padStart(2, '0')}`}
              </span>
            </div>
          </>
        )}

        {!progress && (
          <div>
            {title && <h1 className="text-lg font-extrabold tracking-tight text-slate-900">{title}</h1>}
            {subtitle && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {progress ? (
          <div className="bg-accent-blue/10 px-2.5 py-1 rounded-full border border-accent-blue/20">
            <span className="text-[10px] font-extrabold text-accent-blue uppercase tracking-tight">
              Step {progress.current.toString().padStart(2, '0')}/{progress.total.toString().padStart(2, '0')}
            </span>
          </div>
        ) : (
          rightAction
        )}
      </div>
    </header>
  );
};

export default Header;
