
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCurrency } from '../utils/api';

const GameHeader: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [gold, setGold] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentExp, setCurrentExp] = useState(0);
  const [expToNextLevel, setExpToNextLevel] = useState(100);
  const [showGoldChange, setShowGoldChange] = useState<number | null>(null);
  const [goldAnimating, setGoldAnimating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const tabs = [
    { label: 'Travel', path: '/game' },
    { label: 'Outfit', path: '/game/outfit' },
  ];

  const currentTab = tabs.find(t => t.path === location.pathname)?.label || 'Travel';

  // 加载货币数据
  useEffect(() => {
    const loadCurrency = async () => {
      try {
        const data = await getCurrency();
        setGold(data.gold_balance);
        setLevel(data.level);
        setCurrentExp(data.current_exp);
        setExpToNextLevel(data.exp_to_next_level);
      } catch (error) {
        console.error('Failed to load currency:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadCurrency();
  }, []);

  // 监听金币变化事件
  useEffect(() => {
    const handleGoldChange = (e: CustomEvent) => {
      console.log('💰 GameHeader received gold-changed event:', e.detail);
      const amount = e.detail.amount;
      setGold(prev => prev + amount);
      setShowGoldChange(amount);
      setGoldAnimating(true);

      console.log('💰 Gold animation state set to true');

      setTimeout(() => {
        setShowGoldChange(null);
        console.log('💰 Float-up animation ended');
      }, 1000);

      setTimeout(() => {
        setGoldAnimating(false);
        console.log('💰 Bounce animation ended');
      }, 600);
    };

    window.addEventListener('gold-changed' as any, handleGoldChange as any);
    console.log('💰 GameHeader: gold-changed listener registered');
    return () => window.removeEventListener('gold-changed' as any, handleGoldChange as any);
  }, []);

  // 监听经验值变化事件
  useEffect(() => {
    const handleExpChange = (e: CustomEvent) => {
      console.log('✨ GameHeader received exp-changed event:', e.detail);
      if (e.detail.levelUp) {
        setLevel(e.detail.newLevel);
        setCurrentExp(e.detail.newExp);
        setExpToNextLevel(e.detail.expToNextLevel);
      } else {
        setCurrentExp(e.detail.newExp);
      }
    };

    window.addEventListener('exp-changed' as any, handleExpChange as any);
    return () => window.removeEventListener('exp-changed' as any, handleExpChange as any);
  }, []);

  return (
    <header className="sticky top-0 z-[110] bg-white/95 backdrop-blur-sm border-b border-slate-100 flex flex-col pt-6 pb-3">
      {/* Stats Section - Permanently at the Top */}
      <div className="px-6 py-1 flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {/* Gold */}
          <div className="relative flex items-center gap-2 bg-black text-white px-3 py-1.5 rounded-2xl shadow-md border border-white/10">
            <span className="text-lg">💰</span>
            <span className={`font-black text-xs ${goldAnimating ? 'animate-coin-bounce' : ''}`}>
              {gold.toLocaleString()}
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
