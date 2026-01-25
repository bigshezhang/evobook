
import React, { useState } from 'react';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import Mascot from '../../components/Mascot';

const OutfitView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'Mine' | 'Shop'>('Mine');
  const [category, setCategory] = useState('Hats');

  const MASCOT_SRC = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";

  const categories = ['Hats', 'Clothes', 'Accessories', 'Shoes'];
  const items = [
    { id: 1, owned: true, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB67UsfUV6c1xqCgIQVTDrmG44Jr9S0gTc8ZKvpMi3fyIfKCIrZy9v4wU9eas5Nc8c71xVpp_bL0Z2JeLYEs_eGrbERSYHEVIXxHTzkD4DRAWEGvrSbH9mFSFRm_2WeHupOlGAIe-JbwWerH3lna0eM7nD4OHc9FWYemUZND25BfEuRamnRRnM0-klP7-s-aPduo7wS2SjedS-IeSgd4F118eaCPjLLBkrLRIaDidG7QaC6RuudzLEeaXFjHVLNRVT0zcoJYF5uYPvR' },
    { id: 2, owned: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBqOSpiUlLpglC4M92Qs5GfXNFW84eDMPGzR88B8UcVv8yO0T1W5ajnIprH_RvEEac8_4lm2s8JfXTcqMgXvOjtB3thoaz8-5v2JJnJv0OIsUbgoZLtr4nhPA7yvRStbs9AEnACwiZAcbapkWkGqQ52W9hSraLPRfH4ArVWXK8fWd6OBCDanx81fYAowu55CGdxMaEUd4Phib9en280FzSqmu7p3gFVnX0gCzI4VzXXkwqCF_MMrWqN0JLEl6TixlcdLXjeyip9ux9Z' },
    { id: 3, owned: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuANYg63Rg630ldNtnKhhbcP8xGYw35fxFLYHnuVJp2tiIc3klmvPeSi0-RqlA8YJEnWw4a-wRS0EzgYO4Q8Og93630Z4NfdmCZrUSk__wQ1k83xf55bIXcuvAPc-H_-aWq4dLj2OEe11Qf5gKX-5nBXPDi-mQihAeJpcL8_WppW0sqFzf7LAb5pdEruoddRETebKlIs5pq2oAHbLSSdDzeztBBgOvqd5UWUnvfWClSJgbYL5hhMU4r1MNJgb80DE1BrReBK1DfXFWpJ' },
    { id: 4, owned: false, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCXe-5BTwcI1ssHHKw0RhOaUcw6W1FRWzM9DEIoCOerlwxMsXGlODaoFdPPYiHqgwWbV9FUNu4LjGt4IP1yOKGaZH7Z5axmuYMD66kHYPf3OxP7hyrVjtqP1aj3MgMITETGM4uOwCzosLo3sbo-oOF_mpXkS-Hzd9TY0ikbD2kjT8kUEogKOtcrdGlp3FVWWlWOC1sXOy_lwVgEQLlT-tIa8eUd_ut-pCuFCLKnx3eGc3ZK3qqVV8J78dWB4_USuFDmOWZr3Tb3ms8D' },
    { id: 5, locked: true },
    { id: 6, locked: true },
    { id: 7, locked: true },
    { id: 8, locked: true },
    { id: 9, locked: true },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] overflow-hidden select-none font-sans">
      <GameHeader />
      
      <main className="h-[35%] relative flex flex-col items-center justify-center">
        <div className="absolute w-[240px] h-[240px] bg-primary/5 rounded-full blur-[60px] -z-10"></div>
        <div className="relative z-10 scale-110 drop-shadow-2xl animate-in fade-in zoom-in duration-500">
          <Mascot src={MASCOT_SRC} width="200" className="drop-shadow-2xl" />
        </div>
        <div className="absolute bottom-4 w-40 h-4 bg-black/5 blur-xl rounded-[100%]"></div>
      </main>

      <div className="h-[65%] bg-white rounded-t-[48px] shadow-[0_-30px_100px_rgba(0,0,0,0.08)] p-6 z-40 overflow-hidden flex flex-col border-t border-slate-50">
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-6 flex-shrink-0"></div>

        <div className="px-10 mb-6 flex-shrink-0">
          <div className="bg-slate-50 p-1 rounded-2xl flex items-center border border-slate-100 shadow-inner">
            <button 
              onClick={() => setActiveSubTab('Mine')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-300 ${activeSubTab === 'Mine' ? 'bg-white shadow-md text-slate-900 scale-[1.02]' : 'text-slate-400'}`}
            >Mine</button>
            <button 
              onClick={() => setActiveSubTab('Shop')}
              className={`flex-1 py-2.5 rounded-xl text-[13px] font-black transition-all duration-300 ${activeSubTab === 'Shop' ? 'bg-white shadow-md text-slate-900 scale-[1.02]' : 'text-slate-400'}`}
            >Shop</button>
          </div>
        </div>

        <div className="flex gap-2.5 mb-6 overflow-x-auto no-scrollbar flex-shrink-0">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-5 py-2.5 rounded-2xl text-[13px] font-black whitespace-nowrap transition-all duration-300 ${category === cat ? 'bg-black text-white shadow-xl scale-[1.05]' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-28">
          <div className="grid grid-cols-3 gap-4 p-1">
            {items.map(item => (
              <div 
                key={item.id}
                className={`aspect-square bg-slate-50/50 rounded-[32px] p-3 border-2 flex flex-col items-center justify-center relative active:scale-95 transition-all duration-200 ${item.owned ? 'border-primary/20 bg-white shadow-sm' : 'border-transparent'}`}
              >
                {item.owned && <div className="absolute top-3 right-3 w-2.5 h-2.5 bg-primary rounded-full shadow-lg ring-2 ring-white"></div>}
                {item.img ? (
                  <img alt="Item" className="w-full h-full object-contain drop-shadow-sm group-hover:scale-110 transition-transform" src={item.img}/>
                ) : (
                  <div className="w-full h-full rounded-[24px] border-2 border-dashed border-slate-200 flex items-center justify-center bg-slate-50/30">
                    <span className="material-symbols-outlined text-slate-300">lock</span>
                  </div>
                )}
                {item.owned && <span className="absolute bottom-3 text-[8px] font-black text-slate-300 uppercase tracking-widest">Selected</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <BottomNav activeTab="game" />
    </div>
  );
};

export default OutfitView;
