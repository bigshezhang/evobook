
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MascotCharacter, setSelectedCharacter } from '../../utils/mascotUtils';

const companions: { id: MascotCharacter; name: string; title: string; desc: string; icon: string; color: string }[] = [
  { id: 'oliver', name: 'Oliver', title: 'Oliver the Owl', desc: 'WISE & FOCUSED', icon: 'skillet', color: 'bg-card-purple' },
  { id: 'luna', name: 'Luna', title: 'Luna the Cat', desc: 'PLAYFUL & ALERT', icon: 'pets', color: 'bg-card-yellow' },
  { id: 'bolt', name: 'Bolt', title: 'Bolt the Robot', desc: 'LOGICAL & FAST', icon: 'smart_toy', color: 'bg-card-blue' },
  // 你可以在这里加入新角色，例如：
  // { id: 'dog', name: 'Buddy', title: 'Buddy the Dog', desc: 'LOYAL & ACTIVE', icon: 'potted_plant', color: 'bg-emerald-400' }
];

const CompanionSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(companions[0]);

  const handleContinue = () => {
    // 1. 保存选中的角色到本地存储（模拟后端交互）
    setSelectedCharacter(selected.id);
    // 2. 进入下一环节
    navigate('/notifications');
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] font-display overflow-hidden">
      <header className="pt-16 px-8 pb-4">
        <h1 className="text-[24px] font-bold text-black tracking-tight">Choose your learning companion</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative w-full max-h-[340px] flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75"></div>
          <div className={`w-64 h-64 rounded-[48px] ${selected.color} flex items-center justify-center shadow-xl border-4 border-white mb-6 transition-all duration-300`}>
            <span className="material-symbols-outlined text-[120px] text-white drop-shadow-2xl">{selected.icon}</span>
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-black">{selected.title}</h2>
            <p className="text-sm font-medium text-gray-500 mt-1 uppercase tracking-widest">{selected.desc}</p>
          </div>
        </div>
      </main>

      <div className="pb-8 pt-4">
        <div className="flex gap-4 px-8 overflow-x-auto no-scrollbar pb-4">
          {companions.map(pet => (
            <button 
              key={pet.id}
              onClick={() => setSelected(pet)}
              className={`flex-shrink-0 w-24 h-28 rounded-[24px] ${pet.color} flex flex-col items-center justify-center border-2 ${selected.id === pet.id ? 'border-black' : 'border-transparent opacity-80'}`}
            >
              <span className="material-symbols-outlined text-3xl text-white mb-1">{pet.icon}</span>
              <span className="font-bold text-[10px]">{pet.name}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="px-8 pb-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400">2 / 4</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-black rounded-full" style={{ width: '50%' }}></div>
            </div>
          </div>
          <button 
            onClick={handleContinue}
            className="w-full h-16 rounded-full bg-black text-white font-bold text-lg active:scale-95 transition-all shadow-xl"
          >
            Continue
          </button>
        </div>
      </footer>
    </div>
  );
};

export default CompanionSelection;
