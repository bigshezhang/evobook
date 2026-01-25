
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const ProfileView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen bg-white pb-32 overflow-x-hidden font-sans">
      <Header 
        title="Profile"
        rightAction={
          <button 
            onClick={() => navigate('/assessment')}
            className="flex items-center gap-2 px-4 h-10 rounded-2xl bg-slate-50 border border-slate-100 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>library_add</span>
            <span className="text-xs font-bold text-slate-700">Course</span>
          </button>
        }
      />

      <main className="px-6 space-y-6 mt-4">
        <section className="flex flex-col items-center text-center pt-2">
          <div className="relative w-36 h-36 mb-4 flex items-center justify-center">
            <div className="w-28 h-28 bg-gradient-to-br from-primary/10 to-indigo-100 rounded-[2.5rem] rotate-3 absolute"></div>
            <div className="w-28 h-28 bg-white clay-card rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-lg">
              <span className="material-symbols-outlined text-6xl text-primary" style={{ fontVariationSettings: "'opsz' 48, 'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="absolute bottom-2 right-2 bg-green-500 w-7 h-7 rounded-full border-4 border-white z-20"></div>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-2xl font-extrabold text-black uppercase tracking-tight">Alex Rivers</h2>
            <div className="bg-black text-white text-[9px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              PRO
            </div>
          </div>
          <p className="text-slate-400 text-xs font-medium">Joined January 2024</p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <div className="clay-card p-4 rounded-[2rem] flex flex-col items-center text-center">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center mb-1.5 shadow-inner">
              <span className="material-symbols-outlined text-blue-500 text-lg">schedule</span>
            </div>
            <span className="text-lg font-extrabold leading-none text-charcoal">124</span>
            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Study Hrs</span>
          </div>
          <div className="clay-card p-4 rounded-[2rem] flex flex-col items-center text-center">
            <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center mb-1.5 shadow-inner">
              <span className="material-symbols-outlined text-orange-500 text-lg">workspace_premium</span>
            </div>
            <span className="text-lg font-extrabold leading-none text-charcoal">12</span>
            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Mastered</span>
          </div>
          <div className="clay-card p-4 rounded-[2rem] flex flex-col items-center text-center">
            <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center mb-1.5 shadow-inner">
              <span className="material-symbols-outlined text-purple-500 text-lg">leaderboard</span>
            </div>
            <span className="text-lg font-extrabold leading-none text-charcoal">#42</span>
            <span className="text-[9px] font-bold text-slate-400 mt-1 uppercase">Global Rank</span>
          </div>
        </section>

        <section className="!mt-4">
          <div className="flex justify-between items-center mb-3 px-1">
            <h3 className="font-extrabold text-base tracking-tight text-charcoal">Top Medals</h3>
            <span className="text-xs font-bold text-primary">View All</span>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            <div className="min-w-[160px] bg-gradient-to-br from-orange-400 to-yellow-300 rounded-3xl p-3 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 flex-shrink-0 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 backdrop-blur-sm">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/70 uppercase">Ranked</span>
                <span className="text-xs font-extrabold text-white uppercase tracking-tight">Top 100</span>
              </div>
            </div>
            <div className="min-w-[160px] bg-gradient-to-br from-indigo-600 to-purple-500 rounded-3xl p-3 flex items-center gap-3 shadow-md">
              <div className="w-10 h-10 flex-shrink-0 bg-white/20 rounded-2xl flex items-center justify-center border border-white/30 backdrop-blur-sm">
                <span className="material-symbols-outlined text-white text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white/70 uppercase">Badge</span>
                <span className="text-xs font-extrabold text-white uppercase tracking-tight">First AI</span>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="bg-indigo-50/50 p-4 rounded-[1.75rem] border border-indigo-100 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-extrabold tracking-tight text-charcoal">Invite Friends</span>
                <span className="text-[10px] font-black bg-white text-primary border border-indigo-100 px-1.5 py-0.5 rounded-md">+500 XP</span>
              </div>
              <span className="text-[11px] font-bold text-slate-500">Code: <span className="text-slate-900 font-extrabold">STITCH99</span></span>
            </div>
            <button className="h-9 px-5 bg-black text-white rounded-full font-bold text-xs active:scale-95 transition-all">Invite</button>
          </div>
        </section>

        <section className="pb-10">
          <div className="space-y-0.5 clay-card p-1.5 rounded-[1.75rem]">
            <button className="w-full flex items-center justify-between py-3 px-4 hover:bg-slate-50 rounded-xl transition-colors group">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-slate-400 text-lg">shield</span>
                <span className="text-sm font-bold text-slate-700">Privacy</span>
              </div>
              <span className="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
            </button>
            <div className="h-px bg-slate-50 mx-4"></div>
            <button className="w-full flex items-center justify-between py-3 px-4 hover:bg-rose-50 rounded-xl transition-colors group">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-rose-500 text-lg">logout</span>
                <span className="text-sm font-bold text-rose-600">Logout</span>
              </div>
              <span className="material-symbols-outlined text-rose-200 text-lg">logout</span>
            </button>
          </div>
        </section>
      </main>

      {/* Changed activeTab to 'courses' as 'profile' is invalid and logically part of the courses tab */}
      <BottomNav activeTab="courses" />
    </div>
  );
};

export default ProfileView;
