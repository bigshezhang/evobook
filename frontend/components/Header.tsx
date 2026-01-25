
import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  subtitle?: string;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  showBack = true, 
  onBack, 
  rightAction, 
  subtitle,
  className = ""
}) => {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <header className={`pt-12 px-6 pb-2 flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-40 ${className}`}>
      <div className="flex items-center gap-3">
        {showBack && (
          <button 
            onClick={handleBack} 
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white border border-slate-100 shadow-sm active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-slate-900 font-bold" style={{ fontVariationSettings: "'wght' 600" }}>arrow_back_ios_new</span>
          </button>
        )}
        <div>
          {title && <h1 className="text-xl font-extrabold tracking-tight text-charcoal">{title}</h1>}
          {subtitle && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center">
        {rightAction}
      </div>
    </header>
  );
};

export default Header;
