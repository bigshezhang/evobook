
import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../../components/BottomNav';

const CoursesDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'mine';
  const [statusFilter, setStatusFilter] = useState<'progress' | 'completed' | 'tolearn'>('progress');

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
              <span className="material-symbols-rounded text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 0" }}>library_add</span>
              <span className="text-[13px] font-bold text-slate-700">Create</span>
            </button>
            <div className="w-11 h-11 rounded-full overflow-hidden border border-slate-100 shadow-sm">
              <img alt="User" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCt71Z-R952rZoA5Dyxy1LTH2p1HWPZR02z3jKmrMAXMrghRSZGERWb-ClPhuYMDF-r-Zyr7Yod05-ut9OEF0prOA3_1WTbYusVxBtqn_5-Z_BZdkblCi0zAsqs7wAl-_eFZUWVf1OWUkHxiR_myf2LvObP77Rvsn5ht2k7QVasiJvwCrY5KGSrMw4itZvqEPQV5qQcZ1lY8AneuvV-XXSRMCCij31eKLWT8WxeEmSDvINmqAZb737upyCZTPBC9ao0r36RWikhSm8y" />
            </div>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div className="bg-[#F1F3F9] p-1 rounded-2xl flex gap-1 mb-4 shadow-inner">
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
                  if (i === 0 || i === 4 || i === 11 || i === 13 || i === 22 || i === 23 || i === 31 || i === 32) bgColor = 'bg-[#1F2937]';
                  else if (i === 5 || i === 8 || i === 19 || i === 24 || i === 35) bgColor = 'bg-[#9CA3AF]';
                  return <div key={i} className={`aspect-square rounded-[4px] ${bgColor}`}></div>;
                })}
              </div>
            </div>
          </section>

          {/* Status Tabs */}
          <section>
            <div className="bg-[#F1F3F9] p-1 rounded-2xl flex gap-1 shadow-inner">
              <button 
                onClick={() => setStatusFilter('progress')}
                className={`flex-1 py-3 text-[13px] font-black rounded-xl transition-all ${statusFilter === 'progress' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
              >
                In Progress
              </button>
              <button 
                onClick={() => setStatusFilter('completed')}
                className={`flex-1 py-3 text-[13px] font-black rounded-xl transition-all ${statusFilter === 'completed' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
              >
                Completed
              </button>
              <button 
                onClick={() => setStatusFilter('tolearn')}
                className={`flex-1 py-3 text-[13px] font-black rounded-xl transition-all ${statusFilter === 'tolearn' ? 'bg-white shadow-sm text-primary' : 'text-slate-400'}`}
              >
                To Learn
              </button>
            </div>
          </section>

          {/* Course Card */}
          <section>
            <div 
              onClick={() => navigate('/course-detail')}
              className="relative flex items-center gap-4 p-5 bg-white rounded-[2.5rem] border border-slate-50 shadow-soft group active:scale-[0.98] transition-all cursor-pointer overflow-hidden"
            >
              <div className="w-14 h-14 bg-[#F0EFFF] rounded-2xl flex-shrink-0 flex items-center justify-center shadow-inner">
                <span className="material-symbols-rounded text-secondary text-2xl" style={{ fontVariationSettings: "'FILL' 0" }}>psychology</span>
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="font-extrabold text-[15px] text-primary truncate">Neural Networks</h4>
                <div className="w-full h-[6px] bg-[#F3F4F6] rounded-full mt-3 overflow-hidden">
                  <div className="bg-[#1A1A1A] h-full w-[65%] rounded-full"></div>
                </div>
              </div>
              <button 
                className="h-10 px-6 bg-black text-white rounded-full flex-shrink-0 flex items-center justify-center shadow-lg active:scale-95 transition-all"
              >
                <span className="text-[10px] font-black uppercase tracking-widest">Study</span>
              </button>
            </div>
          </section>
        </div>
      </main>

      <BottomNav activeTab="courses" />
    </div>
  );
};

export default CoursesDashboard;
