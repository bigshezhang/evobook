
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import Mascot from '../../components/Mascot';
import SuccessFeedbackPill from '../../components/SuccessFeedbackPill';
import { buildLearningPath, getActiveCourse, getCurrency, rollDice, claimReward } from '../../utils/api';

type TileType = 'gold' | 'xp' | 'roll' | 'normal' | 'star' | 'gift' | 'map';

interface TileData {
  id: number;
  type: TileType;
  icon: string;
  colorClass: string;
  bgColor: string;
}

const TravelBoard: React.FC = () => {
  const navigate = useNavigate();
  const [isRolling, setIsRolling] = useState(false);
  const [rollResult, setRollResult] = useState<number | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isJumping, setIsJumping] = useState(false);
  const [eventModal, setEventModal] = useState<{ type: string; title: string; desc: string; reward?: number } | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  
  // Toast state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const [path, setPath] = useState<TileData[]>([]);
  const pathRef = useRef<TileData[]>([]);

  // 骰子动画状态
  const [rollsLeft, setRollsLeft] = useState(15);
  const [showRollChange, setShowRollChange] = useState<number | null>(null);
  const [rollAnimating, setRollAnimating] = useState(false);

  const TILE_H = 120;
  const GAP = 40;
  const STEP_UNIT = TILE_H + GAP;

  useEffect(() => {
    generateMoreTiles(50);
    loadActiveCourse();
    loadCurrency();
  }, []);

  const loadActiveCourse = async () => {
    try {
      const { course_map_id } = await getActiveCourse();
      setActiveCourseId(course_map_id);
    } catch (error) {
      console.error('Failed to load active course:', error);
    }
  };

  const loadCurrency = async () => {
    try {
      const data = await getCurrency();
      setRollsLeft(data.dice_rolls_count);
    } catch (error) {
      console.error('Failed to load currency:', error);
    }
  };

  const generateMoreTiles = (count: number) => {
    // 奖励类型和权重配置
    const tileConfig = [
      { type: 'normal', weight: 50, icon: '', color: 'tile-gold', bgColor: 'bg-white' },              // 50% 空地砖
      { type: 'gold', weight: 20, icon: 'monetization_on', color: 'tile-gold', bgColor: 'bg-mute-gold' },   // 20% 金币
      { type: 'roll', weight: 15, icon: 'casino', color: 'tile-roll', bgColor: 'bg-mute-purple' },          // 15% 骰子
      { type: 'gift', weight: 15, icon: 'redeem', color: 'tile-gift', bgColor: 'bg-mute-pink' },            // 15% 特殊奖励
    ];

    // 计算总权重
    const totalWeight = tileConfig.reduce((sum, config) => sum + config.weight, 0);

    const startId = pathRef.current.length;
    const newTiles: TileData[] = [];

    for (let i = 0; i < count; i++) {
      // 加权随机选择
      let random = Math.random() * totalWeight;
      let selectedConfig = tileConfig[0];

      for (const config of tileConfig) {
        random -= config.weight;
        if (random <= 0) {
          selectedConfig = config;
          break;
        }
      }

      newTiles.push({
        id: startId + i,
        type: selectedConfig.type as TileType,
        icon: selectedConfig.icon,
        colorClass: selectedConfig.color,
        bgColor: selectedConfig.bgColor
      });
    }

    const updatedPath = [...pathRef.current, ...newTiles];
    pathRef.current = updatedPath;
    setPath(updatedPath);
  };

  const handleRoll = async () => {
    if (isRolling || isMoving || rollsLeft <= 0 || !activeCourseId) return;

    console.log('🎲 Rolling dice, rolls left before:', rollsLeft);

    // 先扣减骰子次数并触发动画（让用户先看到 -1 动画）
    setShowRollChange(-1);
    setRollAnimating(true);

    console.log('🎲 Animation triggered: shake + float');

    setTimeout(() => setShowRollChange(null), 800);
    setTimeout(() => setRollAnimating(false), 500);

    // 延迟 600ms 后再显示掷骰遮罩，让 -1 动画先播放完
    setTimeout(async () => {
      setIsRolling(true);
      setRollResult(null);

      try {
        // 调用后端 API 掷骰子
        const response = await rollDice({
          course_map_id: activeCourseId,
          current_position: currentStep,
        });

        // 更新骰子数量
        setRollsLeft(response.dice_rolls_remaining);

        // 显示掷骰结果
        setTimeout(() => {
          setRollResult(response.dice_result);

          setTimeout(() => {
            setIsRolling(false);
            startTravel(response.dice_result);
          }, 1200);
        }, 1000);
      } catch (error: any) {
        console.error('Failed to roll dice:', error);
        setIsRolling(false);

        // 显示错误提示
        if (error.code === 'INSUFFICIENT_DICE') {
          setToastMessage('Insufficient dice!');
          setShowToast(true);
        } else {
          setToastMessage('Failed to roll dice, please try again');
          setShowToast(true);
        }
      }
    }, 600);
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

    // 处理落地后的奖励
    const finalTile = pathRef.current[currentStep + steps];
    if (finalTile) {
      switch (finalTile.type) {
        case 'gold':
          const goldAmount = Math.floor(Math.random() * 151) + 50; // 50-200金币
          console.log('💰 Gold reward triggered:', goldAmount);

          // 先只显示弹窗，金币动画在弹窗关闭后触发
          setEventModal({
            type: 'gold',
            title: 'Coins Found!',
            desc: `You gained +${goldAmount} Gold`,
            reward: goldAmount
          });
          break;
        case 'roll':
          console.log('🎲 Roll reward triggered, rolls left before:', rollsLeft);

          // 先只显示弹窗，骰子动画在弹窗关闭后触发
          setEventModal({
            type: 'roll',
            title: 'Extra Roll!',
            desc: 'You gained +1 Dice Roll',
            reward: 1
          });
          break;
        case 'gift':
          const gifts = ['Mystery Outfit', 'Special Item', 'Limited Decoration'];
          const randomGift = gifts[Math.floor(Math.random() * gifts.length)];
          setEventModal({
            type: 'gift',
            title: 'Special Reward!',
            desc: `You received: ${randomGift}`
          });
          break;
      }
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
              className={`w-16 h-16 claymorphic-dice rounded-[20px] flex items-center justify-center transition-all ${isMoving || isRolling || rollsLeft <= 0 ? 'grayscale opacity-50' : 'active:scale-90 cursor-pointer'}`}
            >
              <div className="grid grid-cols-2 gap-2">
                {[...Array(4)].map((_, i) => <div key={i} className="w-2.5 h-2.5 dice-dot rounded-full"></div>)}
              </div>
            </div>
            <div className="flex flex-col relative">
              <span className={`text-3xl font-black text-slate-900 leading-none ${rollAnimating ? 'animate-shake-number' : ''}`}>
                {rollsLeft}
              </span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">rolls left</span>

              {/* 飘出的变化数字 */}
              {showRollChange !== null && (
                <span className={`absolute -top-2 -right-6 font-black text-lg pointer-events-none ${
                  showRollChange > 0
                    ? 'text-green-500 animate-float-up'
                    : 'text-red-400 animate-fade-out-left'
                }`}>
                  {showRollChange > 0 ? `+${showRollChange}` : showRollChange}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              if (activeCourseId) {
                navigate(buildLearningPath('/knowledge-tree', { cid: activeCourseId }));
              } else {
                navigate('/courses');
              }
            }}
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
              top: 'calc(50% + 80px)',
              transformStyle: 'preserve-3d',
              transform: `rotateX(20deg) translateY(${currentStep * STEP_UNIT}px)`
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
                    ${isActive ? 'bg-secondary/10 ring-[6px] ring-secondary shadow-[0_30px_60px_rgba(124,58,237,0.4)]' : `${tile.bgColor} shadow-xl`}
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
                  {tile.icon ? (
                    <div className={`tile-icon-sphere ${tile.colorClass}`}>
                      <div className="glass-overlay"></div>
                      {tile.type === 'roll' ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="w-2.5 h-2.5 bg-white rounded-full opacity-90 shadow-sm"></div>
                          <div className="w-2.5 h-2.5 bg-white rounded-full opacity-90 shadow-sm"></div>
                          <div className="w-2.5 h-2.5 bg-white rounded-full opacity-90 shadow-sm"></div>
                          <div className="w-2.5 h-2.5 bg-white rounded-full opacity-90 shadow-sm"></div>
                        </div>
                      ) : (
                        <span className="material-symbols-outlined text-white text-[44px]" style={{ fontVariationSettings: "'FILL' 1" }}>{tile.icon}</span>
                      )}
                    </div>
                  ) : null}
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
            <div className={`w-24 h-24 rounded-[28px] flex items-center justify-center mb-6 shadow-inner ${
              eventModal.type === 'gold' ? 'bg-amber-100 text-amber-500' :
              eventModal.type === 'roll' ? 'bg-purple-100 text-purple-500' :
              'bg-pink-100 text-pink-500'
            }`}>
              <span className="material-symbols-outlined text-[64px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {eventModal.type === 'gold' ? 'monetization_on' :
                 eventModal.type === 'roll' ? 'casino' :
                 'redeem'}
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">{eventModal.title}</h3>
            <p className="text-slate-400 font-bold mb-8 text-center">{eventModal.desc}</p>
            <button
              onClick={async () => {
                const modal = eventModal;
                setEventModal(null);

                // 弹窗关闭后，调用后端 API 领取奖励
                if (modal && activeCourseId) {
                  try {
                    if (modal.type === 'gold' && modal.reward) {
                      // 调用后端 API 领取金币
                      await claimReward({
                        reward_type: 'gold',
                        amount: modal.reward,
                        source: 'tile_reward',
                        source_details: {
                          course_map_id: activeCourseId,
                          tile_position: currentStep,
                          tile_type: 'gold',
                        },
                      });

                      // 延迟触发动画
                      setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('gold-changed', { detail: { amount: modal.reward } }));
                        console.log('💰 Dispatched gold-changed event after modal closed:', modal.reward);
                      }, 200);
                    } else if (modal.type === 'roll' && modal.reward) {
                      // 调用后端 API 领取骰子
                      await claimReward({
                        reward_type: 'dice',
                        amount: modal.reward,
                        source: 'tile_reward',
                        source_details: {
                          course_map_id: activeCourseId,
                          tile_position: currentStep,
                          tile_type: 'roll',
                        },
                      });

                      // 延迟触发动画
                      setTimeout(() => {
                        setRollsLeft(prev => prev + modal.reward);
                        setShowRollChange(modal.reward);
                        setRollAnimating(true);
                        console.log('🎲 Roll +1 animation triggered after modal closed');

                        setTimeout(() => setShowRollChange(null), 800);
                        setTimeout(() => setRollAnimating(false), 500);
                      }, 200);
                    }
                  } catch (error) {
                    console.error('Failed to claim reward:', error);
                    // 即使 API 失败也显示动画（乐观更新）
                    setTimeout(() => {
                      if (modal.type === 'gold' && modal.reward) {
                        window.dispatchEvent(new CustomEvent('gold-changed', { detail: { amount: modal.reward } }));
                      } else if (modal.type === 'roll' && modal.reward) {
                        setRollsLeft(prev => prev + modal.reward);
                        setShowRollChange(modal.reward);
                        setRollAnimating(true);
                        setTimeout(() => setShowRollChange(null), 800);
                        setTimeout(() => setRollAnimating(false), 500);
                      }
                    }, 200);
                  }
                }
              }}
              className="w-full py-5 bg-black text-white rounded-full font-black uppercase tracking-widest shadow-xl active:scale-95 transition-transform"
            >
              {eventModal.type === 'gift' ? 'Claim Reward' : 'Collect'}
            </button>
          </div>
        </div>
      )}

      <SuccessFeedbackPill 
        isOpen={showToast} 
        onClose={() => setShowToast(false)} 
        message={toastMessage}
      />

      <BottomNav activeTab="game" />
    </div>
  );
};

export default TravelBoard;
