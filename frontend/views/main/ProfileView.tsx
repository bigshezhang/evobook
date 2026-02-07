
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';

const ProfileView: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [showInvite, setShowInvite] = useState(false);

  // The high-fidelity mascot image for the poster
  const POSTER_MASCOT = "https://lh3.googleusercontent.com/aida-public/AB6AXuA46trIZajUdPDtcb5Mve4AANhBVcFPf7hD1VJlypb0dFYRxS2hXKwdShsNFVNhbqxXKQFSjVVMsE3mxGpTikZ_57rFFad-Wac1TeLu7mkLVUcNcXHe1dMp94PSQWv0zRukZyCVX_0DBZ2YWtZ3z95XJoYIk-kHHf_jOtCXVxwOascf_uy1-xN9B6LDuY7LUnDzKY4Em18_6PP7pnkilqsGpMh1-4xyIUGnBpFdw5egLxog1wDMZwcwvb0tgobqJaobQeIGVn7VCUfO";

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FB] pb-32 overflow-x-hidden font-sans">
      {/* Header with explicit back navigation to dashboard */}
      <Header 
        title="Profile"
        onBack={() => navigate('/dashboard')}
        rightAction={
          <button 
            onClick={() => navigate('/assessment')}
            className="flex items-center gap-2 px-4 h-10 rounded-2xl bg-white border border-slate-100 active:scale-95 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>library_add</span>
            <span className="text-xs font-bold text-slate-700">Course</span>
          </button>
        }
      />

      <main className="px-6 space-y-6 mt-4">
        {/* User Profile Header - Square Avatar style */}
        <section className="flex flex-col items-center text-center pt-2">
          <div className="relative mb-6">
            <div className="w-32 h-32 bg-white rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-xl border border-slate-50">
              <span className="material-symbols-outlined text-5xl text-primary/60" style={{ fontVariationSettings: "'opsz' 48, 'FILL' 1" }}>auto_awesome</span>
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-8 h-8 rounded-full border-4 border-[#F8F9FB] z-20"></div>
            {/* Subtle glow background */}
            <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl -z-10 scale-125"></div>
          </div>
          
          <div className="flex items-center gap-2 mb-1 justify-center">
            <h2 className="text-2xl font-black text-black uppercase tracking-tight">Alex Rivers</h2>
            <div className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-sm">
              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              PRO
            </div>
          </div>
          <p className="text-slate-400 text-sm font-bold opacity-80">Joined January 2024</p>
        </section>

        {/* Stats Grid - Square card style */}
        <section className="grid grid-cols-3 gap-3">
          <div className="bg-white p-5 rounded-[2rem] flex flex-col items-center text-center shadow-sm border border-slate-50">
            <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-blue-500 text-xl">schedule</span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">124</span>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">Study Hrs</span>
          </div>
          <div className="bg-white p-5 rounded-[2rem] flex flex-col items-center text-center shadow-sm border border-slate-50">
            <div className="w-10 h-10 bg-orange-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-orange-500 text-xl">workspace_premium</span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">12</span>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">Mastered</span>
          </div>
          <div className="bg-white p-5 rounded-[2rem] flex flex-col items-center text-center shadow-sm border border-slate-50">
            <div className="w-10 h-10 bg-purple-50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
              <span className="material-symbols-outlined text-purple-500 text-xl">leaderboard</span>
            </div>
            <span className="text-xl font-black text-slate-900 leading-none">#42</span>
            <span className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">Global Rank</span>
          </div>
        </section>

        {/* Invite Friends Section - Lavender style */}
        <section className="space-y-3">
          <div className="bg-[#EEF1FF] p-5 rounded-[2rem] border border-primary/10 flex items-center justify-between shadow-sm">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-black tracking-tight text-slate-900">Invite Friends</span>
                <span className="text-[10px] font-black bg-white text-primary border border-primary/20 px-2 py-0.5 rounded-lg">+500 XP</span>
              </div>
              <span className="text-xs font-bold text-slate-500">Code: <span className="text-slate-900 font-black">STITCH99</span></span>
            </div>
            <button 
              onClick={() => setShowInvite(true)}
              className="h-10 px-6 bg-black text-white rounded-full font-black text-[13px] active:scale-95 transition-all shadow-lg"
            >
              Invite
            </button>
          </div>
        </section>

        {/* Menu Options Section */}
        <section className="pb-10">
          <div className="bg-white p-2 rounded-[2.5rem] shadow-sm border border-slate-50">
            <button className="w-full flex items-center justify-between py-4 px-5 hover:bg-slate-50 rounded-2xl transition-colors">
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-slate-400 text-xl">shield</span>
                <span className="text-[15px] font-black text-slate-800">Privacy</span>
              </div>
              <span className="material-symbols-outlined text-slate-300 text-lg">chevron_right</span>
            </button>
            <div className="h-px bg-slate-100/50 mx-5 my-1"></div>
            <button 
              onClick={async () => {
                localStorage.clear();
                await signOut();
                navigate('/login', { replace: true });
              }}
              className="w-full flex items-center justify-between py-4 px-5 hover:bg-rose-50 rounded-2xl transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className="material-symbols-outlined text-rose-500 text-xl">logout</span>
                <span className="text-[15px] font-black text-slate-800">Logout</span>
              </div>
              <span className="material-symbols-outlined text-rose-100 text-xl">logout</span>
            </button>
          </div>
        </section>
      </main>

      {/* Social Invitation Poster Modal Overlay */}
      {showInvite && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          
          {/* Poster Content Card */}
          <div className="w-full max-w-[340px] max-h-[80vh] bg-vibrant-gradient rounded-[3.5rem] shadow-2xl relative overflow-hidden flex flex-col animate-in zoom-in duration-400">
            
            {/* Close Button Inside Card (X icon) */}
            <button 
              onClick={() => setShowInvite(false)}
              className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center z-[110] active:scale-90"
            >
              <span className="material-symbols-outlined text-slate-400 text-[22px] font-bold">close</span>
            </button>

            {/* Square Mascot Container */}
            <div className="w-full pt-10 px-10 flex justify-center">
              <div className="relative w-full aspect-square bg-[#223344] rounded-none overflow-hidden shadow-2xl border-4 border-white/20">
                <img 
                  alt="Mascot" 
                  className="w-full h-full object-cover"
                  src={POSTER_MASCOT} 
                />
                {/* Floating sparkle icon badge */}
                <div className="absolute -right-3 top-6 w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center rotate-12 z-20 border border-slate-50">
                  <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
              </div>
            </div>

            {/* Poster Text Content */}
            <div className="flex flex-col items-center py-6 px-10 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.45em] text-primary/40 mb-3">Invited By</p>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-8 leading-none">Alex Rivers</h1>

              {/* Reward Pill - Yellow style */}
              <div className="w-full bg-[#FFFBEB] rounded-[28px] p-5 flex items-center gap-4 border border-amber-100/60 shadow-sm relative overflow-hidden">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="material-symbols-outlined text-amber-500 text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>card_giftcard</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-[13px] font-bold text-slate-800 leading-snug">
                    Help Alex get <span className="text-amber-500 font-black">+500 EXP</span>,<br/>and you'll get it too!
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom White Section - QR style */}
            <div className="bg-white rounded-t-[4rem] p-10 mt-auto flex flex-col items-center shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
              <div className="text-center mb-8">
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Scan to Download</h3>
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-1.5">Join the learning revolution</p>
              </div>

              {/* Abstract QR Grid */}
              <div className="w-28 h-28 p-4 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex items-center justify-center">
                 <div className="grid grid-cols-7 gap-1.5 w-full h-full">
                    {[...Array(49)].map((_, i) => (
                      <div key={i} className={`w-1.5 h-1.5 rounded-[2px] ${(i % 3 === 0 || i % 7 === 0 || i % 11 === 0) ? 'bg-slate-800' : 'bg-transparent'}`}></div>
                    ))}
                 </div>
              </div>
            </div>

            {/* Background Glows */}
            <div className="absolute top-0 right-0 w-56 h-56 bg-primary/10 rounded-full blur-[90px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[70px] pointer-events-none"></div>
          </div>

          {/* Floating Share Button at the bottom of the screen */}
          <div className="w-full max-w-[440px] px-2 mt-8 animate-in slide-in-from-bottom-6 duration-500">
            <button className="w-full bg-white py-5 rounded-[2.5rem] font-black text-slate-900 shadow-2xl active:scale-[0.97] transition-all flex items-center justify-center gap-3">
              <span className="material-symbols-outlined text-slate-900 font-bold">share</span>
              <span className="text-[16px] tracking-tight">Share Image</span>
            </button>
          </div>

        </div>
      )}

      <BottomNav activeTab="courses" />
    </div>
  );
};

export default ProfileView;
