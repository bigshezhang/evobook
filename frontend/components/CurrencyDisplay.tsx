
import React from 'react';

interface CurrencyDisplayProps {
  gold?: string;
  level?: string;
  progress?: string;
  className?: string;
}

const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ 
  gold = "12,450", 
  level = "14", 
  progress = "42/60",
  className = ""
}) => {
  return (
    <div className={`px-6 py-2 z-40 flex items-center justify-between ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-2xl shadow-md">
          <div className="w-5 h-5 bg-accent-gold rounded-full flex items-center justify-center border border-black/10">
            <span className="material-icons-round text-black text-[12px] font-bold">monetization_on</span>
          </div>
          <span className="font-bold text-xs">{gold}</span>
        </div>
        <div className="flex items-center gap-2 bg-black text-white px-3 py-2 rounded-2xl shadow-md">
          <div className="w-5 h-5 bg-[#B5A3FF] rounded-full flex items-center justify-center border border-black/10">
            <span className="material-icons-round text-white text-[12px]">auto_awesome</span>
          </div>
          <span className="font-bold text-xs">LV. {level}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-white px-3 py-2 rounded-2xl shadow-sm border border-slate-100">
        <div className="h-2 w-12 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#B5A3FF]" style={{ width: '66.6%' }}></div>
        </div>
        <span className="font-black text-[10px] text-black uppercase tracking-tight">{progress}</span>
      </div>
    </div>
  );
};

export default CurrencyDisplay;
