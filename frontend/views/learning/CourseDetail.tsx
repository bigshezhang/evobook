
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const CourseDetail: React.FC = () => {
  const navigate = useNavigate();
  
  const [commitment, setCommitment] = useState<'Deep' | 'Fast' | 'Lite'>('Deep');
  const [velocity, setVelocity] = useState<'15m' | '30m' | '45m' | '1h'>('30m');
  const [formats, setFormats] = useState<string[]>(['Video', 'Lab', 'Read']);

  const toggleFormat = (format: string) => {
    setFormats(prev => 
      prev.includes(format) ? prev.filter(f => f !== format) : [...prev, format]
    );
  };

  const handleConfirm = () => {
    localStorage.setItem('evo_onboarding_completed', 'true');
    navigate('/knowledge-tree');
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans overflow-hidden">
      <Header 
        subtitle="Editorial Plan" 
        rightAction={
          <button className="w-10 h-10 flex items-center justify-center active:scale-90 transition-transform">
            <span className="material-symbols-outlined text-[24px] text-charcoal">bookmark</span>
          </button>
        }
      />

      <main className="flex-1 px-8 flex flex-col overflow-y-auto no-scrollbar pb-56">
        <section className="flex flex-col items-center pt-4">
          <div className="relative w-44 h-56 bg-[#A28FFF] rounded-[40px] shadow-[0_20px_40px_-15px_rgba(162,143,255,0.5)] flex flex-col items-center justify-center overflow-hidden mb-6">
            <div className="relative z-10 w-24 h-24 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/30">
              <span className="material-symbols-outlined text-[64px] text-white">psychology</span>
            </div>
            <div className="absolute bottom-6 left-8 space-y-2">
              <div className="h-2 w-16 bg-white/30 rounded-full"></div>
              <div className="h-2 w-10 bg-white/30 rounded-full"></div>
            </div>
          </div>
          <h2 className="text-[28px] font-black tracking-tight text-center leading-none text-charcoal">Neural Networks</h2>
          <p className="mt-2 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">Mastering Intelligence</p>
        </section>

        <section className="mt-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Knowledge Graph</h3>
          <div className="flex flex-wrap gap-2.5">
            {['Neurons', 'Backprop', 'Gradients', 'Weights', 'Biases', 'Layers'].map(tag => (
              <span key={tag} className="bg-[#F0EFFF] text-charcoal px-4 py-2 rounded-full text-[13px] font-bold border border-black/5">
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Total Commitment</h3>
            <span className="text-[13px] font-black text-charcoal">12H</span>
          </div>
          <div className="bg-[#F3F4F6] p-1.5 rounded-2xl flex">
            {(['Deep', 'Fast', 'Lite'] as const).map(item => (
              <button 
                key={item}
                onClick={() => setCommitment(item)}
                className={`flex-1 py-3 text-[14px] font-black rounded-xl transition-all ${commitment === item ? 'bg-charcoal text-white shadow-lg' : 'text-slate-400'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Daily Velocity</h3>
            <span className="text-[13px] font-black text-charcoal">30M</span>
          </div>
          <div className="bg-[#F3F4F6] p-1.5 rounded-2xl flex gap-1">
            {(['15m', '30m', '45m', '1h'] as const).map(item => (
              <button 
                key={item}
                onClick={() => setVelocity(item)}
                className={`flex-1 py-3 text-[14px] font-black rounded-xl transition-all ${velocity === item ? 'bg-charcoal text-white shadow-lg' : 'text-slate-400'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Delivery Format</h3>
          <div className="flex gap-3">
            {[
              { id: 'Video', icon: 'play_circle' },
              { id: 'Lab', icon: 'touch_app' },
              { id: 'Read', icon: 'description' }
            ].map(format => (
              <button 
                key={format.id}
                onClick={() => toggleFormat(format.id)}
                className={`flex-1 py-4 rounded-2xl flex items-center justify-center gap-2 border-2 transition-all active:scale-95 ${
                  formats.includes(format.id) 
                    ? 'bg-[#F3F4F6] border-charcoal/10' 
                    : 'bg-white border-transparent text-slate-300 grayscale'
                }`}
              >
                <span className="material-symbols-outlined text-[20px] font-bold">{format.icon}</span>
                <span className="text-[13px] font-black tracking-tight">{format.id}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <div className="fixed bottom-28 left-0 right-0 p-8 flex justify-center pointer-events-none z-40">
        <div className="max-w-md w-full px-8 pointer-events-auto">
          <button 
            onClick={handleConfirm}
            className="w-full bg-charcoal text-white py-5 rounded-[24px] flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all group"
          >
            <span className="font-black text-[15px] uppercase tracking-[0.15em] ml-4">Confirm & Start</span>
            <span className="material-symbols-outlined text-[22px] font-bold group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </button>
        </div>
      </div>

      {/* Changed activeTab to 'learning' as 'explore' is invalid */}
      <BottomNav activeTab="learning" />
    </div>
  );
};

export default CourseDetail;
