
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MascotCharacter, setSelectedCharacter } from '../../utils/mascotUtils';
import Mascot from '../../components/Mascot';
import { updateProfile } from '../../utils/api';

const companions: { id: MascotCharacter; name: string; title: string; desc: string; icon: string; color: string; profileImage: string }[] = [
  { id: 'oliver', name: 'Oliver', title: 'Oliver the Owl', desc: 'WISE & FOCUSED', icon: 'skillet', color: 'bg-card-purple', profileImage: '/compressed_output/processed_image_profile/owl_profile.jpg' },
  { id: 'luna', name: 'Luna', title: 'Luna the Bee', desc: 'PLAYFUL & ALERT', icon: 'pets', color: 'bg-card-yellow', profileImage: '/compressed_output/processed_image_profile/bee_profile.jpg' },
  { id: 'bolt', name: 'Bolt', title: 'Bolt the Sheep', desc: 'LOGICAL & FAST', icon: 'smart_toy', color: 'bg-card-blue', profileImage: '/compressed_output/processed_image_profile/sheep_profile.jpg' },
];

const CompanionSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(companions[0]);

  const [isLoading, setIsLoading] = useState(false);

  const handleContinue = async () => {
    setIsLoading(true);
    try {
      // 1. 保存选中的角色到后端
      await updateProfile({ mascot: selected.id });

      // 2. 同步到本地存储
      setSelectedCharacter(selected.id);

      // 3. 进入下一环节
      navigate('/notifications');
    } catch (error) {
      console.error('Failed to save mascot:', error);
      // 即使失败也保存到本地，让用户继续
      setSelectedCharacter(selected.id);
      navigate('/notifications');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] font-display overflow-hidden">
      <header className="pt-16 px-8 pb-4">
        <h1 className="text-[24px] font-bold text-black tracking-tight">Choose your learning companion</h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="relative w-full max-h-[340px] flex flex-col items-center justify-center">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-75"></div>
          <div className={`w-64 h-64 rounded-[48px] ${selected.color} flex items-center justify-center shadow-xl border-4 border-white mb-6 transition-all duration-300 overflow-hidden`}>
            {/* 使用 Mascot 组件显示 smile 微笑动画 */}
            <Mascot
              character={selected.id}
              scene="onboarding"
              autoPlay={true}
              width="100%"
              className="scale-110"
            />
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
              className={`flex-shrink-0 w-24 h-28 rounded-[24px] ${pet.color} flex flex-col items-center justify-center border-2 ${selected.id === pet.id ? 'border-black' : 'border-transparent opacity-80'} overflow-hidden`}
            >
              <img
                src={pet.profileImage}
                alt={pet.name}
                className="w-16 h-16 object-cover rounded-xl mb-1"
                loading="lazy"
              />
              <span className="font-bold text-[10px]">{pet.name}</span>
            </button>
          ))}
        </div>
      </div>

      <footer className="px-8 pb-10">
        <div className="flex flex-col items-center gap-6">
          <div className="w-full flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400">3 / 4</span>
            <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-black rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>
          <button
            onClick={handleContinue}
            disabled={isLoading}
            className="w-full h-16 rounded-full bg-black text-white font-bold text-lg active:scale-95 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </footer>
    </div>
  );
};

export default CompanionSelection;
