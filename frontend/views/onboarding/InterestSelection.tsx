
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const interests = [
  { id: 'ai', label: 'AI', icon: 'smart_toy', color: 'bg-violet-200' },
  { id: 'design', label: 'Design', icon: 'palette', color: 'bg-blue-200' },
  { id: 'english', label: 'English', icon: 'language', color: 'bg-amber-200' },
  { id: 'movie', label: 'Movie', icon: 'movie', color: 'bg-rose-200' },
  { id: 'tech', label: 'Tech', icon: 'devices', color: 'bg-sky-200' },
  { id: 'music', label: 'Music', icon: 'music_note', color: 'bg-orange-200' },
  { id: 'math', label: 'Math', icon: 'functions', color: 'bg-emerald-200' },
  { id: 'logic', label: 'Logic', icon: 'psychology', color: 'bg-fuchsia-200' },
  { id: 'sport', label: 'Sport', icon: 'fitness_center', color: 'bg-lime-200' },
];

const InterestSelection: React.FC = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] relative overflow-hidden">
      <header className="pt-14 px-8 pb-8 z-20">
        <h1 className="text-4xl font-black text-gray-900 leading-[1.1] mb-8 tracking-tighter">
          Which world <br /> do you want to <br /> explore?
        </h1>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          <input 
            type="text" 
            placeholder="Search interests..." 
            className="w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm text-lg focus:ring-1 focus:ring-black/10"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 no-scrollbar pb-32">
        <div className="grid grid-cols-3 gap-3">
          {interests.map(item => (
            <button 
              key={item.id}
              onClick={() => toggle(item.id)}
              className={`h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${item.color} ${selected.includes(item.id) ? 'ring-2 ring-black' : 'opacity-90'}`}
            >
              <span className="material-symbols-outlined text-3xl mb-1">{item.icon}</span>
              <span className="font-bold text-sm">{item.label}</span>
            </button>
          ))}
          <button className="h-24 rounded-2xl bg-white border-2 border-dashed border-gray-200 flex flex-col items-center justify-center opacity-60">
            <span className="material-symbols-outlined text-3xl mb-1">add</span>
            <span className="font-bold text-sm">Custom</span>
          </button>
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-md flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-gray-400">1 / 3</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: '33.3%' }}></div>
          </div>
        </div>
        <button 
          onClick={() => navigate('/assessment')}
          className="w-full h-16 rounded-full bg-black text-white font-black text-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          Next Step
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
};

export default InterestSelection;
