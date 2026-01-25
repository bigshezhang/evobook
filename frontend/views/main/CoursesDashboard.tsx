
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const DiscoveryCard = ({ item, children }: { item: any, children?: React.ReactNode }) => (
  <div className="min-w-[164px] w-[164px] flex flex-col gap-2.5">
    <div className="aspect-[4/3] clay-img overflow-hidden relative group">
      <img alt={item.title} className="w-full h-full object-cover opacity-95 mix-blend-multiply" src={item.img} />
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/20 to-transparent"></div>
      {children}
    </div>
    <div className="flex justify-between items-start gap-1">
      <div className="flex-1">
        <h4 className="font-bold text-[14px] leading-[1.3] text-black line-clamp-2">{item.title}</h4>
        <div className="flex items-center gap-1 mt-1">
          <span className="material-symbols-outlined text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
          <span className="text-[12px] font-bold text-slate-500">{item.rating}</span>
        </div>
      </div>
      <button className="w-8 h-8 min-w-[32px] bg-black rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform mt-0.5">
        <span className="material-symbols-outlined text-white text-[20px]">add</span>
      </button>
    </div>
  </div>
);

const CoursesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mine';
  const [statusFilter, setStatusFilter] = useState<'progress' | 'completed' | 'tolearn'>('progress');

  const discoverySections = [
    {
      id: 'recommended',
      title: 'Recommended',
      items: [
        { id: 1, title: 'Quantum Physics for Beginners', rating: 4.9, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN' },
        { id: 2, title: 'Modern UI Principles', rating: 4.7, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfyFpDVnX6bPRc7_brb8I3gZvDk5WlJpC2yBr0BdFC7YfNhCKeBuCR7vGACtp_fM-lvmVaQ3MvxTOVcfbKl69niLhNsvv9MUEPdyLYCtkeZK4YqqClWbMizn5pFcy6r1mwoBd389LYHrzCYZXsggF4ZrYkDh49bCW12VwKzL8aQC50EaL2C68uIybYjsd8tO2B6ItBD52q3tDXczyvK6fMHAR9dJ4iZIHf_2C1QjLJBf5G7Z8So-J6vMvjGXyjS4FDfUoEKUE3KHo8' },
      ]
    },
    {
      id: 'popular',
      title: 'Popular',
      items: [
        { id: 3, title: 'Generative Art AI', rating: 4.8, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7eD8fqZiz9LF_Ll3fcoZ4q2Hqvmzqpi7PwKaLjlRQTDUEF3Sp4cttbewU6EnbiOaoOHX5c5Is0fTMbIyPcw79WY0EWZBbQ97QbQtv-frVlBaNqRWXNWzwApZ8pp46xTyIX5Qi80odWX6IvSXgOk6uDzszDZejO-QTMh-HnICw62HutK9NE_yC3mrBDW7o8hkbpdgE4cWAAkhWhGdFeXCQuY6Alt8pVMkpLu77g78HtsxNLh3ssbnBkEk1c2AuKGa4cWksbCAMhpku' },
        { id: 4, title: 'Data Science Flow', rating: 4.6, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNckK3K3HSkhpzQSVZHPYymsoJ0u8gm1yPi10mo0wStcEj4-7dZG1bILE4rC26eIQeidX23gTSAomuuIdBTQcsQPUo-6NhA5BtSppLaGvtnSGRXN9q2ToMiVLItW_gstbmp8PSd3PNnlXgnd7ICmbVR7Qyy72hClRGspmcZ2N1FjwF4z79e8jpLpJZ05HeST0AA4nbtnmj5D-TyZZmPRLWM-OFKH-V4qA6HZFU1N6-7XvSqG1gaecWd6tQ---Siy8btKsTKNNGXl4A' },
      ]
    },
    {
      id: 'friends',
      title: 'Friends',
      items: [
        { id: 5, title: 'Neural Architecture', rating: 4.9, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN' },
      ]
    }
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white pb-32">
      <header className="px-6 pt-10 sticky top-0 bg-white/90 backdrop-blur-md z-30">
        <div className="flex justify-between items-center mb-3">
          <h1 className="text-3xl font-extrabold tracking-tight text-black">Courses</h1>
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => navigate('/assessment')}
              className="flex items-center gap-2 px-3 h-10 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>library_add</span>
              <span className="text-xs font-bold text-slate-600 pr-1">Create</span>
            </button>
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 rounded-2xl overflow-hidden border-2 border-white shadow-sm active:scale-95 transition-transform"
            >
              <img alt="User" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCt71Z-R952rZoA5Dyxy1LTH2p1HWPZR02z3jKmrMAXMrghRSZGERWb-ClPhuYMDF-r-Zyr7Yod05-ut9OEF0prOA3_1WTbYusVxBtqn_5-Z_BZdkblCi0zAsqs7wAl-_eFZUWVf1OWUkHxiR_myf2LvObP77Rvsn5ht2k7QVasiJvwCrY5KGSrMw4itZvqEPQV5qQcZ1lY8AneuvV-XXSRMCCij31eKLWT8WxeEmSDvINmqAZb737upyCZTPBC9ao0r36RWikhSm8y" />
            </button>
          </div>
        </div>
        <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1 mb-3 shadow-inner">
          <button 
            onClick={() => setSearchParams({ tab: 'mine' })}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'mine' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Mine
          </button>
          <button 
            onClick={() => setSearchParams({ tab: 'discovery' })}
            className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${activeTab === 'discovery' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
          >
            Discovery
          </button>
        </div>
      </header>

      <main className="flex-1 mt-2">
        {activeTab === 'mine' ? (
          <div className="px-6 space-y-8 animate-in fade-in duration-300">
            <section>
              <div className="flex justify-between items-end mb-4">
                <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-slate-400">Activity Graph</h3>
                <span className="text-[10px] font-bold text-slate-300">PAST 6 MONTHS</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
                <div className="grid grid-cols-12 gap-1.5">
                  {[...Array(36)].map((_, i) => (
                    <div key={i} className={`aspect-square rounded-[4px] ${i % 3 === 0 ? 'bg-primary' : i % 5 === 0 ? 'bg-primary/40' : 'bg-slate-50 border border-slate-100/50'}`}></div>
                  ))}
                </div>
              </div>
            </section>

            {/* Missing Status Filters Added Here */}
            <section>
              <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1 shadow-inner">
                <button 
                  onClick={() => setStatusFilter('progress')}
                  className={`flex-1 py-2.5 text-[13px] font-black rounded-xl transition-all ${statusFilter === 'progress' ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}
                >
                  In Progress
                </button>
                <button 
                  onClick={() => setStatusFilter('completed')}
                  className={`flex-1 py-2.5 text-[13px] font-black rounded-xl transition-all ${statusFilter === 'completed' ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}
                >
                  Completed
                </button>
                <button 
                  onClick={() => setStatusFilter('tolearn')}
                  className={`flex-1 py-2.5 text-[13px] font-black rounded-xl transition-all ${statusFilter === 'tolearn' ? 'bg-white shadow-sm text-black' : 'text-slate-400'}`}
                >
                  To Learn
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-white rounded-3xl border border-slate-100 shadow-sm group active:scale-[0.98] transition-all">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-sm truncate text-charcoal">Neural Networks</h4>
                  <div className="w-full h-1.5 bg-slate-50 rounded-full mt-2">
                    <div className="bg-primary h-full w-[65%] rounded-full"></div>
                  </div>
                </div>
                <button onClick={() => navigate('/knowledge-tree')} className="h-10 px-4 bg-black rounded-full flex-shrink-0 flex items-center justify-center shadow-lg">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">Study</span>
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="px-6 space-y-10 animate-in fade-in duration-300">
            {discoverySections.map(section => (
              <section key={section.id} className="relative">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xl text-black">{section.title}</h3>
                  <button 
                    onClick={() => navigate(`/discovery/${section.id}`)}
                    className="text-xs font-bold text-primary"
                  >
                    See all
                  </button>
                </div>
                <div className="overflow-x-auto no-scrollbar -mx-6 px-6">
                  <div className="flex gap-4 pb-2">
                    {section.items.map(item => (
                      <DiscoveryCard key={item.id} item={item}>
                        {section.id === 'friends' && (
                          <div className="absolute bottom-2 left-2 flex -space-x-1.5">
                            <img alt="friend" className="w-6 h-6 rounded-full border-2 border-white" src="https://picsum.photos/40/40?random=1"/>
                            <img alt="friend" className="w-6 h-6 rounded-full border-2 border-white" src="https://picsum.photos/40/40?random=2"/>
                          </div>
                        )}
                      </DiscoveryCard>
                    ))}
                    {/* Add extra spacer for horizontal scroll end padding */}
                    <div className="min-w-[1px] invisible"></div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <BottomNav activeTab="courses" />
    </div>
  );
};

export default CoursesDashboard;
