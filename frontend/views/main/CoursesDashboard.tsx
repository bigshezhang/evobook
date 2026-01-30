
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';
import SuccessFeedbackPill from '../../components/SuccessFeedbackPill';

const CoursesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mine';
  const [statusFilter, setStatusFilter] = useState<'progress' | 'completed' | 'tolearn'>('progress');
  const [showAddSuccess, setShowAddSuccess] = useState(false);

  // Discovery tab specific data based on the screenshot
  const discoveryData = {
    recommended: [
      { id: 1, title: 'Quantum Physics for Beginners', rating: 4.9, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN' },
      { id: 2, title: 'Modern UI Principles', rating: 4.7, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfyFpDVnX6bPRc7_brb8I3gZvDk5WlJpC2yBr0BdFC7YfNhCKeBuCR7vGACtp_fM-lvmVaQ3MvxTOVcfbKl69niLhNsvv9MUEPdyLYCtkeZK4YqqClWbMizn5pFcy6r1mwoBd389LYHrzCYZXsggF4ZrYkDh49bCW12VwKzL8aQC50EaL2C68uIybYjsd8tO2B6ItBD52q3tDXczyvK6fMHAR9dJ4iZIHf_2C1QjLJBf5G7Z8So-J6vMvjGXyjS4FDfUoEKUE3KHo8' }
    ],
    popular: [
      { id: 3, title: 'Generative Art AI', rating: 4.8, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7eD8fqZiz9LF_Ll3fcoZ4q2Hqvmzqpi7PwKaLjlRQTDUEF3Sp4cttbewU6EnbiOaoOHX5c5Is0fTMbIyPcw79WY0EWZBbQ97QbQtv-frVlBaNqRWXNWzwApZ8pp46xTyIX5Qi80odWX6IvSXgOk6uDzszDZejO-QTMh-HnICw62HutK9NE_yC3mrBDW7o8hkbpdgE4cWAAkhWhGdFeXCQuY6Alt8pVMkpLu77g78HtsxNLh3ssbnBkEk1c2AuKGa4cWksbCAMhpku' },
      { id: 4, title: 'Data Science Flow', rating: 4.6, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDNckK3K3HSkhpzQSVZHPYymsoJ0u8gm1yPi10mo0wStcEj4-7dZG1bILE4rC26eIQeidX23gTSAomuuIdBTQcsQPUo-6NhA5BtSppLaGvtnSGRXN9q2ToMiVLItW_gstbmp8PSd3PNnlXgnd7ICmbVR7Qyy72hClRGspmcZ2N1FjwF4z79e8jpLpJZ05HeST0AA4nbtnmj5D-TyZZmPRLWM-OFKH-V4qA6HZFU1N6-7XvSqG1gaecWd6tQ---Siy8btKsTKNNGXl4A' }
    ],
    friends: [
      { id: 5, title: 'Neural Architecture', rating: 4.9, img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN', hasFriends: true }
    ]
  };

  const handleAddCourse = () => {
    setShowAddSuccess(true);
  };

  // Fixed CourseCard type definition to allow 'key' prop in maps
  const CourseCard: React.FC<{ course: any }> = ({ course }) => (
    <div className="flex flex-col gap-3">
      <div 
        onClick={() => navigate('/course-detail')}
        className="aspect-square bg-[#F0EBE3] rounded-[2.5rem] overflow-hidden relative group cursor-pointer shadow-sm border border-black/5"
      >
        <img 
          alt={course.title} 
          className="w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-500" 
          src={course.img}
        />
        {/* Friends Avatars Overlay if applicable */}
        {course.hasFriends && (
          <div className="absolute bottom-4 left-4 flex -space-x-2">
            <div className="w-6 h-6 rounded-full border-2 border-white bg-reward-yellow flex items-center justify-center">
               <span className="material-symbols-rounded text-white text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-white bg-lavender-pale flex items-center justify-center overflow-hidden">
               <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCt71Z-R952rZoA5Dyxy1LTH2p1HWPZR02z3jKmrMAXMrghRSZGERWb-ClPhuYMDF-r-Zyr7Yod05-ut9OEF0prOA3_1WTbYusVxBtqn_5-Z_BZdkblCi0zAsqs7wAl-_eFZUWVf1OWUkHxiR_myf2LvObP77Rvsn5ht2k7QVasiJvwCrY5KGSrMw4itZvqEPQV5qQcZ1lY8AneuvV-XXSRMCCij31eKLWT8WxeEmSDvINmqAZb737upyCZTPBC9ao0r36RWikhSm8y" />
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-between items-start gap-1 pr-1">
        <div className="flex-1 cursor-pointer" onClick={() => navigate('/course-detail')}>
          <h4 className="font-extrabold text-[15px] leading-[1.2] text-primary line-clamp-2">{course.title}</h4>
          <div className="flex items-center gap-1 mt-1">
            <span className="material-symbols-rounded text-[14px] text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
            <span className="text-[12px] font-bold text-slate-400">{course.rating}</span>
          </div>
        </div>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            handleAddCourse();
          }}
          className="w-8 h-8 min-w-[32px] bg-black rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform cursor-pointer"
        >
          <span className="material-symbols-rounded text-white text-[18px]">add</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-white pb-32 overflow-x-hidden font-sans">
      {/* Header Section */}
      <header className="px-6 pt-12 pb-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-[32px] font-black tracking-tight text-primary">Courses</h1>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/assessment')}
              className="flex items-center gap-2 px-4 h-11 rounded-2xl bg-white border border-slate-100 shadow-sm active:scale-95 transition-all"
            >
              <span className="material-symbols-rounded text-secondary text-[22px]" style={{ fontVariationSettings: "'FILL' 0" }}>library_add</span>
              <span className="text-[13px] font-bold text-slate-700">Create</span>
            </button>
            <div className="w-11 h-11 rounded-full bg-[#E0E2D1] border border-slate-100 shadow-sm flex items-center justify-center">
               <span className="material-symbols-rounded text-white text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
            </div>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div className="bg-[#F1F3F9] p-1 rounded-2xl flex gap-1 mb-6 shadow-inner">
          <button 
            onClick={() => setSearchParams({ tab: 'mine' })}
            className={`flex-1 py-3 text-[14px] font-black rounded-xl transition-all ${activeTab === 'mine' ? 'bg-white shadow-md text-primary' : 'text-slate-400'}`}
          >
            Mine
          </button>
          <button 
            onClick={() => setSearchParams({ tab: 'discovery' })}
            className={`flex-1 py-3 text-[14px] font-black rounded-xl transition-all ${activeTab === 'discovery' ? 'bg-white shadow-md text-primary' : 'text-slate-400'}`}
          >
            Discovery
          </button>
        </div>
      </header>

      <main className="flex-1">
        {activeTab === 'mine' ? (
          <div className="px-6 space-y-8 animate-in fade-in duration-500">
            {/* Activity Graph Section */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-black text-[11px] uppercase tracking-[0.2em] text-[#9CA3AF]">Activity Graph</h3>
                <span className="text-[10px] font-bold text-[#D1D5DB]">PAST 6 MONTHS</span>
              </div>
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-50 shadow-soft">
                <div className="grid grid-cols-12 gap-2">
                  {[...Array(36)].map((_, i) => {
                    let bgColor = 'bg-[#F3F4F6]';
                    if (i === 0 || i === 4 || i === 11 || i === 13 || i === 22 || i === 23 || i === 31 || i === 32) bgColor = 'bg-secondary';
                    else if (i === 5 || i === 8 || i === 19 || i === 24 || i === 35) bgColor = 'bg-accent-purple/40';
                    return <div key={i} className={`aspect-square rounded-[4px] ${bgColor}`}></div>;
                  })}
                </div>
              </div>
            </section>

            {/* Status Tabs */}
            <section>
              <div className="bg-[#F1F3F9] p-1 rounded-2xl flex gap-1 shadow-inner">
                {['progress', 'completed', 'tolearn'].map((type) => (
                  <button 
                    key={type}
                    onClick={() => setStatusFilter(type as any)}
                    className={`flex-1 py-3 text-[13px] font-black rounded-xl transition-all ${statusFilter === type ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
                  >
                    {type === 'progress' ? 'In Progress' : type === 'completed' ? 'Completed' : 'To Learn'}
                  </button>
                ))}
              </div>
            </section>

            {/* Course Card */}
            <section>
              <div 
                onClick={() => navigate('/course-detail')}
                className="relative flex items-center gap-4 p-5 bg-white rounded-[2.5rem] border border-slate-50 shadow-soft group active:scale-[0.98] transition-all cursor-pointer overflow-hidden"
              >
                <div className="w-14 h-14 bg-lavender-pale rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-rounded text-secondary text-2xl">psychology</span>
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <h4 className="font-extrabold text-[15px] text-primary truncate">Neural Networks</h4>
                  <div className="w-full h-[6px] bg-[#F3F4F6] rounded-full mt-3 overflow-hidden">
                    <div className="bg-secondary h-full w-[65%] rounded-full shadow-[0_0_8px_rgba(124,58,237,0.3)]"></div>
                  </div>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/course-detail');
                  }}
                  className="h-10 px-6 bg-black text-white rounded-full flex-shrink-0 flex items-center justify-center shadow-lg active:scale-95 transition-all"
                >
                  <span className="text-[10px] font-black uppercase tracking-widest">Study</span>
                </button>
              </div>
            </section>
          </div>
        ) : (
          /* Discovery Content Restored from Screenshot */
          <div className="px-6 space-y-10 animate-in fade-in duration-500 pb-10">
            
            {/* Recommended */}
            <section>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-black text-primary tracking-tight">Recommended</h3>
                <button onClick={() => navigate('/discovery/recommended')} className="text-[12px] font-black text-secondary uppercase tracking-widest">See all</button>
              </div>
              <div className="grid grid-cols-2 gap-4 gap-y-8">
                {discoveryData.recommended.map(course => <CourseCard key={course.id} course={course} />)}
              </div>
            </section>

            {/* Popular */}
            <section>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-black text-primary tracking-tight">Popular</h3>
                <button onClick={() => navigate('/discovery/popular')} className="text-[12px] font-black text-secondary uppercase tracking-widest">See all</button>
              </div>
              <div className="grid grid-cols-2 gap-4 gap-y-8">
                {discoveryData.popular.map(course => <CourseCard key={course.id} course={course} />)}
              </div>
            </section>

            {/* Friends */}
            <section>
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-[18px] font-black text-primary tracking-tight">Friends</h3>
                <button onClick={() => navigate('/discovery/friends')} className="text-[12px] font-black text-secondary uppercase tracking-widest">See all</button>
              </div>
              <div className="grid grid-cols-2 gap-4 gap-y-8">
                {discoveryData.friends.map(course => <CourseCard key={course.id} course={course} />)}
              </div>
            </section>

          </div>
        )}
      </main>

      <SuccessFeedbackPill isOpen={showAddSuccess} onClose={() => setShowAddSuccess(false)} />
      <BottomNav activeTab="courses" />
    </div>
  );
};

export default CoursesDashboard;
