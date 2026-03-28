
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { trpc } from '../utils/trpc/client';
import { ROUTES } from '../utils/routes';

const GameHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // tRPC 查询
  const { data: currencyData, isLoading } = trpc.game.getCurrency.useQuery();

  const gold = currencyData?.goldBalance ?? 0;
  const level = currencyData?.level ?? 1;
  const currentExp = currencyData?.currentExp ?? 0;
  const expToNextLevel = currencyData?.expToNextLevel ?? 100;

  // 金币动画相关状态（需要本地管理，因为来自 CustomEvent 而非服务端）
  const [localGoldOffset, setLocalGoldOffset] = useState(0);
  const [showGoldChange, setShowGoldChange] = useState<number | null>(null);
  const [goldAnimating, setGoldAnimating] = useState(false);

  const displayGold = gold + localGoldOffset;

  const tabs = [
    { label: 'Travel', path: ROUTES.GAME },
    { label: 'Outfit', path: ROUTES.GAME_OUTFIT },
  ];

  const currentTab = tabs.find(t => t.path === location.pathname)?.label || 'Travel';

  // 监听金币变化事件（乐观更新本地偏移量）
  useEffect(() => {
    const handleGoldChange = (e: CustomEvent) => {
      console.log('💰 GameHeader received gold-changed event:', e.detail);
      const amount = e.detail.amount;
      setLocalGoldOffset(prev => prev + amount);
      setShowGoldChange(amount);
      setGoldAnimating(true);

      setTimeout(() => setShowGoldChange(null), 1000);
      setTimeout(() => setGoldAnimating(false), 600);
    };

    window.addEventListener('gold-changed' as any, handleGoldChange as any);
    return () => window.removeEventListener('gold-changed' as any, handleGoldChange as any);
  }, []);

  // 监听经验值变化事件，通过 invalidate 刷新 tRPC 缓存
  const utils = trpc.useUtils();
  useEffect(() => {
    const handleExpChange = (e: CustomEvent) => {
      console.log('✨ GameHeader received exp-changed event:', e.detail);
      utils.game.getCurrency.invalidate();
    };

    window.addEventListener('exp-changed' as any, handleExpChange as any);
    return () => window.removeEventListener('exp-changed' as any, handleExpChange as any);
  }, [utils]);

  return (
    <header className="sticky top-0 z-[110] bg-white/95 backdrop-blur-sm border-b border-slate-100 flex flex-col pt-6 pb-3">
      {/* Stats Section - Permanently at the Top */}
      <div className="px-6 py-1 flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* Gold */}
          <div className="relative flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-2xl shadow-md border border-white/10">
            <span className="text-lg">💰</span>
            <span className={`font-black text-xs ${goldAnimating ? 'animate-coin-bounce' : ''}`}>
              {displayGold.toLocaleString()}
            </span>
            {/* 飘出的增加数字 */}
            {showGoldChange && showGoldChange > 0 && (
              <span className="absolute -top-6 right-0 text-green-500 font-black text-sm animate-float-up pointer-events-none">
                +{showGoldChange}
              </span>
            )}
          </div>
          {/* Level */}
          <div className="flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-2xl shadow-md border border-white/10">
            <span className="text-lg">✨</span>
            <span className="font-black text-xs">LV. {isLoading ? '?' : level}</span>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100 shadow-inner">
          <div className="h-1.5 w-12 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#B5A3FF] transition-all duration-300"
              style={{ width: isLoading ? '0%' : `${(currentExp / expToNextLevel) * 100}%` }}
            ></div>
          </div>
          <span className="font-black text-[10px] text-black uppercase tracking-tight">
            {isLoading ? '...' : `${currentExp}/${expToNextLevel}`}
          </span>
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
