
import React, { useState, useRef } from 'react';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import Mascot from '../../components/Mascot';

interface ShopItem {
  id: number;
  name: string;
  price: number;
  icon: string;
  color: string;
}

const HomeShop: React.FC = () => {
  const [scrollTop, setScrollTop] = useState(0);
  const [category, setCategory] = useState('Furniture');
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  const MASCOT_SRC = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";

  const categories = ['Furniture', 'Decor', 'Walls', 'Floor'];
  const shopItems: ShopItem[] = [
    { id: 1, name: 'Modern Chair', price: 250, icon: 'chair', color: 'text-indigo-500' },
    { id: 2, name: 'Palm Tree', price: 180, icon: 'potted_plant', color: 'text-emerald-500' },
    { id: 3, name: 'Neo Lamp', price: 420, icon: 'table_lamp', color: 'text-rose-400' },
    { id: 4, name: 'Cozy Sofa', price: 890, icon: 'weekend', color: 'text-blue-400' },
    { id: 5, name: 'Gaming Desk', price: 1200, icon: 'desktop_windows', color: 'text-slate-600' },
    { id: 6, name: 'Bookshelf', price: 550, icon: 'library_books', color: 'text-amber-600' },
    { id: 7, name: 'Floor Lamp', price: 300, icon: 'light', color: 'text-yellow-500' },
    { id: 8, name: 'Round Rug', price: 150, icon: 'texture', color: 'text-orange-400' },
  ];

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const roomScale = Math.max(0.65, 1 - scrollTop / 600);
  const roomTranslateY = scrollTop * 0.4; 
  const roomOpacity = Math.max(0.1, 1 - scrollTop / 400);

  return (
    <div className="relative h-screen flex flex-col bg-[#F9F9F9] overflow-hidden select-none">
      <GameHeader />
      
      <main onScroll={handleScroll} className="flex-1 overflow-y-auto no-scrollbar relative">
        <section 
          className="sticky top-0 w-full h-[40vh] flex flex-col items-center justify-center pointer-events-none z-10"
          style={{ transform: `translateY(${-roomTranslateY}px) scale(${roomScale})`, opacity: roomOpacity }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[380px] h-[380px] bg-indigo-50 rounded-full blur-[90px] -z-10"></div>
          
          <div className="relative flex flex-col items-center">
             <div className="isometric-room relative w-[280px] h-[280px] bg-white rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.06)] border-4 border-white transition-transform duration-300">
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-[0.04]">
                  {[...Array(16)].map((_, i) => <div key={i} className="border border-slate-900"></div>)}
                </div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 flex items-center justify-center">
                  <div className="transform rotate-[45deg] rotate-x-[-55deg] scale-[2] translate-y-[-15px]">
                    <Mascot 
                      src={MASCOT_SRC} 
                      className="drop-shadow-2xl animate-bounce"
                      style={{ animationDuration: '3.5s' }}
                    />
                  </div>
                </div>
             </div>
             <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-56 h-6 bg-black/[0.03] blur-xl rounded-[100%]"></div>
          </div>

          <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-auto">
             <button className="clay-pill bg-black/90 backdrop-blur-md text-white w-14 h-14 rounded-full flex flex-col items-center justify-center active:scale-90 shadow-xl border border-white/10 transition-transform">
                <span className="material-symbols-outlined text-amber-300" style={{ fontVariationSettings: "'FILL' 1" }}>cookie</span>
                <span className="text-[8px] font-black uppercase mt-0.5 tracking-tighter">Feed</span>
             </button>
             <button className="clay-pill bg-black/90 backdrop-blur-md text-white w-14 h-14 rounded-full flex flex-col items-center justify-center active:scale-90 shadow-xl border border-white/10 transition-transform">
                <span className="material-symbols-outlined text-blue-400" style={{ fontVariationSettings: "'FILL' 1" }}>water_full</span>
                <span className="text-[8px] font-black uppercase mt-0.5 tracking-tighter">Drink</span>
             </button>
          </div>
        </section>

        <section className="relative z-20 min-h-[65vh] bg-white rounded-t-[48px] shadow-[0_-30px_100px_rgba(0,0,0,0.08)] px-6 pt-4 border-t border-slate-100 flex flex-col">
          <div className="absolute -top-12 left-0 right-0 h-12 bg-transparent"></div>
          
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-1.5 bg-slate-100 rounded-full mb-8"></div>
            <div className="w-full flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight">Home Shop</h3>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-1">Customize Your Room</p>
              </div>
              <div className="flex items-center gap-1.5 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100/50 shadow-sm">
                <span className="material-symbols-outlined text-amber-500 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
                <span className="text-base font-black text-amber-700">4,850</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 mb-8 overflow-x-auto no-scrollbar">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-6 py-3 rounded-2xl font-black text-[13px] uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${category === cat ? 'bg-black text-white shadow-xl scale-[1.05]' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 pb-48">
            {shopItems.map(item => (
              <div 
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-slate-50/50 rounded-[32px] p-5 flex flex-col items-center border border-slate-100 active:scale-[0.96] transition-all duration-200 group hover:bg-white hover:shadow-md cursor-pointer"
              >
                <div className="w-full aspect-square flex items-center justify-center bg-white rounded-2xl shadow-sm mb-4 border border-slate-50 group-hover:scale-105 transition-transform">
                  <span className={`material-symbols-outlined text-[56px] ${item.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                </div>
                <span className="text-sm font-black mb-3 text-slate-800">{item.name}</span>
                <div className="bg-white px-4 py-2 rounded-full flex items-center gap-1 shadow-sm border border-slate-100">
                  <span className="material-symbols-outlined text-amber-500 text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>monetization_on</span>
                  <span className="text-[12px] font-black text-slate-700 tracking-tight">{item.price}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNav activeTab="game" />

      {selectedItem && (
        <div className="absolute inset-0 z-[200] flex items-center justify-center px-8 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-sm rounded-[40px] p-10 flex flex-col items-center shadow-2xl animate-in zoom-in duration-300 border border-white/20">
            <div className="w-32 h-32 bg-indigo-50 rounded-[32px] flex items-center justify-center mb-8 shadow-inner border border-indigo-100">
              <span className={`material-symbols-outlined text-[64px] ${selectedItem.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>{selectedItem.icon}</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 text-center">Buy {selectedItem.name}?</h2>
            <div className="w-full flex flex-col gap-3">
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-full bg-black text-white py-5 rounded-full font-black text-base shadow-xl active:scale-95 transition-all"
              >Confirm ({selectedItem.price} Gold)</button>
              <button 
                onClick={() => setSelectedItem(null)}
                className="w-full text-slate-400 font-bold py-4"
              >Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeShop;
