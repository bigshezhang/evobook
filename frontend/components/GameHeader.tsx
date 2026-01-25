
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const GameHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const tabs = [
    { label: 'Travel', path: '/game' },
    { label: 'Outfit', path: '/game/outfit' },
    { label: 'Home', path: '/game/home' },
  ];

  const currentTab = tabs.find(t => t.path === location.pathname)?.label || 'Travel';

  return (
    <header className="sticky top-0 z-[110] bg-white/95 backdrop-blur-sm border-b border-slate-100 flex flex-col pt-6 pb-3">
      {/* Stats Section - Permanently at the Top */}
      <div className="px-6 py-1 flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* Gold */}
          <div className="flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-2xl shadow-md border border-white/10">
            <div className="w-5 h-5 bg-accent-gold rounded-full flex items-center justify-center">
              <span className="material-icons-round text-black text-[12px] font-bold">monetization_on</span>
            </div>
            <span className="font-black text-xs">12,450</span>
          </div>
          {/* Level */}
          <div className="flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-2xl shadow-md border border-white/10">
            <div className="w-5 h-5 bg-[#B5A3FF] rounded-full flex items-center justify-center">
              <span className="material-icons-round text-white text-[12px]">auto_awesome</span>
            </div>
            <span className="font-black text-xs">LV. 14</span>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100 shadow-inner">
          <div className="h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#B5A3FF]" style={{ width: '66.6%' }}></div>
          </div>
          <span className="font-black text-[10px] text-black uppercase tracking-tight">42/60</span>
        </div>
      </div>

      {/* Tabs Section - Below Stats */}
      <div className="px-6 mt-1">
        <div className="bg-slate-100/80 p-1.5 rounded-full flex items-center border border-slate-200/50 shadow-inner">
          {tabs.map((tab) => (
            <button
              key={tab.label}
              onClick={() => navigate(tab.path)}
              className={`flex-1 py-2 rounded-full text-[13px] transition-all duration-300 ${
                currentTab === tab.label
                  ? 'bg-white shadow-sm font-black text-slate-900 scale-[1.02]'
                  : 'text-slate-500 font-bold hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
};

export default GameHeader;
