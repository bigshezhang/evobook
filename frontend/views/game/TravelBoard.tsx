
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import Mascot from '../../components/Mascot';
import { buildLearningPath, getStoredCourseMapId } from '../../utils/api';

type TileType = 'gold' | 'xp' | 'roll' | 'normal' | 'star' | 'gift' | 'map';

interface TileData {
  id: number;
  type: TileType;
  icon: string;
  colorClass: string;
}

const TravelBoard: React.FC = () => {
  const navigate = useNavigate();
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0); 
  const [isJumping, setIsJumping] = useState(false);
  const [eventModal, setEventModal] = useState<{ type: string; title: string; desc: string } | null>(null);
  
  const [path, setPath] = useState<TileData[]>([]);
  const pathRef = useRef<TileData[]>([]);

  const TILE_H = 120; 
  const GAP = 80;    
  const STEP_UNIT = TILE_H + GAP; 

  useEffect(() => {
    generateMoreTiles(50);
  }, []);

  const generateMoreTiles = (count: number) => {
    const types: TileType[] = ['normal', 'gold', 'map', 'gift', 'star', 'roll', 'xp', 'normal'];
    const icons = ['circle', 'monetization_on', 'map', 'featured_seasonal_and_gifts', 'star', 'casino', 'bolt', 'circle'];
    const colors = ['bg-white', 'clay-gold', 'clay-map', 'clay-pink', 'clay-blue', 'bg-secondary', 'clay-blue', 'bg-white'];

    const startId = pathRef.current.length;
    const newTiles: TileData[] = [];
    for (let i = 0; i < count; i++) {
      const idx = (startId + i) % types.length;
      newTiles.push({
        id: startId + i,
        type: types[idx],
        icon: icons[idx],
        colorClass: colors[idx]
      });
    }
    const updatedPath = [...pathRef.current, ...newTiles];
    pathRef.current = updatedPath;
    setPath(updatedPath);
  };

  const handleRoll = () => {
    if (isRolling || isMoving) return;
    setIsRolling(true);
    setRollResult(null);
    
    setTimeout(() => {
      const result = Math.floor(Math.random() * 3) + 1; 
      setRollResult(result);
      
      setTimeout(() => {
        setIsRolling(false);
        startTravel(result);
      }, 1200);
    }, 1000);
  };

  const startTravel = async (steps: number) => {
    setIsMoving(true);

    for (let i = 0; i < steps; i++) {
      setIsJumping(true);

      await new Promise(r => setTimeout(r, 250));
      setCurrentStep(prev => {
        const next = prev + 1;
        if (pathRef.current.length - next < 15) {
          generateMoreTiles(30);
        }
        return next;
      });
      await new Promise(r => setTimeout(r, 250));
      setIsJumping(false);
      await new Promise(r => setTimeout(r, 150));
    }
    
    setIsMoving(false);
    
    const finalTile = pathRef.current[currentStep + steps];
    if (finalTile?.type === 'gold') {
      setEventModal({ type: 'gold', title: 'Coins Found!', desc: 'You gained +250 Gold' });
    }
  };

  const visibleTiles = useMemo(() => {
    return path.filter(tile => {
      const relIdx = tile.id - currentStep;
      return relIdx >= -3 && relIdx <= 15;
    });
  }, [path, currentStep]);

  return (
    <div className="relative h-screen flex flex-col bg-[#EBEDF5] overflow-hidden select-none font-sans">
      <GameHeader />

      <main className="flex-1 relative perspective-container overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/5 via-transparent to-white/95 pointer-events-none z-10"></div>

        <div className="absolute top-8 left-0 right-0 px-8 flex items-center justify-between z-[100]">
          <div className="flex items-center gap-4">
            <div 
              onClick={handleRoll}
              className={`w-16 h-16 claymorphic-dice rounded-[20px] flex items-center justify-center transition-all ${isMoving || isRolling ? 'grayscale opacity-50' : 'active:scale-90 cursor-pointer'}`}
            >
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => <div key={i} className="w-2.5 h-2.5 dice-dot rounded-full"></div>)}
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-3xl font-black text-slate-900 leading-none">15</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">rolls left</span>
            </div>
          </div>
          <button 
            onClick={() => navigate(buildLearningPath('/knowledge-tree', { cid: getStoredCourseMapId() }))}
            className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-full shadow-xl active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">auto_stories</span>
            <span className="text-[11px] font-black uppercase tracking-tight">Learning</span>
          </button>
        </div>

        <div 
          className="absolute inset-0 flex flex-col items-center pointer-events-none"
          style={{ perspective: '1000px', perspectiveOrigin: '50% 50%', transformStyle: 'preserve-3d' }}
        >
          <div 
            className="absolute w-full h-full transition-transform duration-500 ease-out"
            style={{ 
              top: 'calc(50% + 10px)',
              transformStyle: 'preserve-3d',
              transform: `rotateX(45deg) translateY(${currentStep * STEP_UNIT}px)`
            }}
          >
            {visibleTiles.map((tile) => {
              const relIdx = tile.id - currentStep;
              const isActive = relIdx === 0;
              const opacity = relIdx < 0 ? 1 - (Math.abs(relIdx) * 0.2) : 1 - (relIdx * 0.08);
              const scale = relIdx > 0 ? 1 - (relIdx * 0.04) : 1;

              return (
                <div 
                  key={tile.id}
                  className={`absolute w-80 h-[120px] rounded-[40px] flex items-center justify-center transition-all duration-300 border-t-2 border-white/50
                    ${isActive ? 'bg-secondary/10 ring-[6px] ring-secondary shadow-[0_30px_60px_rgba(124,58,237,0.4)]' : 'bg-white shadow-xl'}
                  `}
                  style={{ 
                    left: '50%',
                    top: `${-tile.id * STEP_UNIT}px`,
                    opacity: Math.max(0, opacity),
                    transform: `translateX(-50%) scale(${Math.max(0.4, scale)}) translateZ(${isActive ? '30px' : '0px'})`,
                    borderBottomWidth: '15px',
                    borderBottomColor: isActive ? '#7C3AED' : '#E2E8F0',
                  }}
                >
                  <div className={`w-18 h-18 claymorphic-icon ${tile.colorClass} shadow-xl scale-125`}>
                    <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>{tile.icon}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 z-[150] pointer-events-none flex flex-col items-center" style={{ top: 'calc(50% + 10px)' }}>
          <div className={`transition-all duration-[400ms] transform-gpu ${isJumping ? '-translate-y-40 scale-110' : '-translate-y-[85px] scale-100'}`}>
            {/* 使用 travel 场景显示背影，outfit 会自动从 localStorage 读取 */}
            <Mascot 
              scene="travel"
              width="90" 
              className="drop-shadow-[0_20px_40px_rgba(0,0,0,0.25)]"
            />
            <div className={`mt-1 bg-secondary/20 blur-2xl rounded-[100%] transition-all duration-400 mx-auto ${isJumping ? 'w-8 h-2 opacity-5 scale-50' : 'w-24 h-5 opacity-40 scale-100'}`}></div>
          </div>
        </div>
      </main>

      {isRolling && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white/60 backdrop-blur-3xl animate-in fade-in duration-500">
           {!rollResult ? (
             <>
               <div className="w-48 h-48 claymorphic-dice rounded-[48px] flex items-center justify-center animate-bounce">
                 <div className="grid grid-cols-2 gap-5 animate-spin">
                   {[...Array(4)].map((_, i) => <div key={i} className="w-6 h-6 dice-dot rounded-full"></div>)}
                 </div>
               </div>
               <h2 className="mt-12 text-4xl font-black text-slate-900 tracking-tighter italic animate-pulse uppercase">Rolling...</h2>
             </>
           ) : (
             <div className="flex flex-col items-center animate-in zoom-in duration-300">
               <div className="w-56 h-56 claymorphic-dice rounded-[56px] flex items-center justify-center relative">
                 <span className="text-[100px] font-black text-white drop-shadow-2xl">{rollResult}</span>
                 <div className="absolute -top-4 -right-4 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-secondary animate-in zoom-in slide-in-from-bottom-2">
                    <span className="material-symbols-rounded text-secondary text-3xl font-black">check</span>
                 </div>
               </div>
               <h2 className="mt-12 text-6xl font-black text-slate-900 tracking-tighter italic uppercase animate-bounce">Move {rollResult}!</h2>
             </div>
           )}
        </div>
      )}

      {eventModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-8 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-xs bg-white rounded-[48px] p-10 flex flex-col items-center shadow-2xl animate-in zoom-in border border-white/20">
            <div className="w-24 h-24 bg-amber-100 text-amber-500 rounded-[28px] flex items-center justify-center mb-6 shadow-inner">
              <span className="material-symbols-outlined text-[64px]" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{eventModal.title}</h3>
            <p className="text-slate-400 font-bold mb-8 text-center">{eventModal.desc}</p>
            <button 
              onClick={() => setEventModal(null)}
              className="w-full py-5 bg-black text-white rounded-full font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
            >
              Collect
            </button>
          </div>
        </div>
      )}

      <BottomNav activeTab="game" />
    </div>
  );
};

export default TravelBoard;
