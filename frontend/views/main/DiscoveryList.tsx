
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const DiscoveryList: React.FC = () => {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();

  const titleMap: Record<string, string> = {
    recommended: 'Recommended',
    popular: 'Popular Courses',
    friends: 'Friend\'s Favorites'
  };

  const mockCourses = [
    { id: 1, title: 'Quantum Physics for Beginners', rating: 4.9, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN' },
    { id: 2, title: 'Modern UI Principles', rating: 4.7, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfyFpDVnX6bPRc7_brb8I3gZvDk5WlJpC2yBr0BdFC7YfNhCKeBuCR7vGACtp_fM-lvmVaQ3MvxTOVcfbKl69niLhNsvv9MUEPdyLYCtkeZK4YqqClWbMizn5pFcy6r1mwoBd389LYHrzCYZXsggF4ZrYkDh49bCW12VwKzL8aQC50EaL2C68uIybYjsd8tO2B6ItBD52q3tDXczyvK6fMHAR9dJ4iZIHf_2C1QjLJBf5G7Z8So-J6vMvjGXyjS4FDfUoEKUE3KHo8' },
    { id: 3, title: 'Generative Art AI', rating: 4.8, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7eD8fqZiz9LF_Ll3fcoZ4q2Hqvmzqpi7PwKaLjlRQTDUEF3Sp4cttbewU6EnbiOaoOHX5c5Is0fTMbIyPcw79WY0EWZBbQ97QbQtv-frVlBaNqRWXNWzwApZ8pp46xTyIX5Qi80odWX6IvSXgOk6uDzszDZejO-QTMh-HnICw62HutK9NE_yC3mrBDW7o8hkbpdgE4cWAAkhWhGdFeXCQuY6Alt8pVMkpLu77g78HtsxNLh3ssbnBkEk1c2AuKGa4cWksbCAMhpku' },
    { id: 4, title: 'Data Science Flow', rating: 4.6, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNckK3K3HSkhpzQSVZHPYymsoJ0u8gm1yPi10mo0wStcEj4-7dZG1bILE4rC26eIQeidX23gTSAomuuIdBTQcsQPUo-6NhA5BtSppLaGvtnSGRXN9q2ToMiVLItW_gstbmp8PSd3PNnlXgnd7ICmbVR7Qyy72hClRGspmcZ2N1FjwF4z79e8jpLpJZ05HeST0AA4nbtnmj5D-TyZZmPRLWM-OFKH-V4qA6HZFU1N6-7XvSqG1gaecWd6tQ---Siy8btKsTKNNGXl4A' },
    { id: 5, title: 'Neural Architecture', rating: 4.9, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN' },
    { id: 6, title: 'Creative Coding 101', rating: 4.5, img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400' }
  ];

  const handleBack = () => {
    navigate('/dashboard?tab=discovery');
  };

  return (
    <div className="flex flex-col min-h-screen bg-white pb-32">
      <header className="px-6 pt-12 pb-4 sticky top-0 bg-white/90 backdrop-blur-lg z-40">
        <div className="flex flex-col gap-4">
          <button 
            onClick={handleBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-50 border border-slate-100 active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined text-slate-900">arrow_back</span>
          </button>
          <h1 className="text-3xl font-extrabold tracking-tight text-black">{titleMap[category || ''] || 'Discovery'}</h1>
        </div>
      </header>

      <main className="px-6 mt-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          {mockCourses.map(item => (
            <div key={item.id} className="flex flex-col gap-2.5">
              <div 
                onClick={() => navigate('/course-detail')}
                className="aspect-[4/3] clay-img overflow-hidden relative group cursor-pointer"
              >
                <img alt={item.title} className="w-full h-full object-cover opacity-95 mix-blend-multiply" src={item.img}/>
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-100/30 to-transparent"></div>
              </div>
              <div className="flex justify-between items-start gap-1">
                <div className="flex-1 cursor-pointer" onClick={() => navigate('/course-detail')}>
                  <h4 className="font-bold text-[14px] leading-[1.3] text-black line-clamp-2">{item.title}</h4>
                  <div className="flex items-center gap-1 mt-1">
                    <span className="material-symbols-outlined text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                    <span className="text-[12px] font-bold text-slate-500">{item.rating}</span>
                  </div>
                </div>
                <button className="w-8 h-8 min-w-[32px] bg-black rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform">
                  <span className="material-symbols-outlined text-white text-[20px]">add</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav activeTab="courses" />
    </div>
  );
};

export default DiscoveryList;
