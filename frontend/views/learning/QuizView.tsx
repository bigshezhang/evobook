
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';

const QuizView: React.FC = () => {
  const navigate = useNavigate();
  const [showComplete, setShowComplete] = useState(false);

  return (
    <div className="relative flex flex-col h-screen bg-white font-display overflow-hidden">
      {/* Shared Header from Knowledge Card */}
      <Header 
        onBack={() => navigate('/knowledge-tree')}
        progress={{ current: 12, total: 20 }}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pt-8 pb-32 space-y-8">
        {/* Question 1: Radio/Single Choice */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#e7f3ff] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-rounded text-[#0d7ff2] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>radio_button_checked</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold mb-3 leading-snug text-slate-900">
                What is the primary function of DNA in living organisms?
              </p>
              <div className="flex flex-col gap-2">
                {[
                  "Long-term storage of genetic information",
                  "Catalyzing chemical reactions",
                  "Providing structural support to cells"
                ].map((option, idx) => (
                  <label key={idx} className="relative group cursor-pointer">
                    <input name="q1" className="peer hidden" type="radio" defaultChecked={idx === 0} />
                    <div className="flex items-center gap-3 rounded-xl border-2 border-slate-100 px-4 py-3 transition-all duration-200 peer-checked:border-[#0d7ff2] peer-checked:bg-[#e7f3ff]/40">
                      <div className="size-4 rounded-full border-2 border-slate-300 flex items-center justify-center peer-checked:border-[#0d7ff2]">
                        <div className="size-2 rounded-full bg-[#0d7ff2] opacity-0 peer-checked:opacity-100 transition-opacity"></div>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{option}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100 mx-2"></div>

        {/* Question 2: Checkbox/Multiple Choice */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#fef5e7] shadow-[0_4px_12px_-2px_rgba(0,0,0,0.05)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-rounded text-[#f39c12] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold mb-3 leading-snug text-slate-900">
                Which of the following are nitrogenous bases found in DNA?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {["Adenine", "Uracil", "Guanine", "Cytosine"].map((base, idx) => (
                  <label key={idx} className="relative cursor-pointer">
                    <input className="peer hidden" type="checkbox" defaultChecked={base !== "Uracil"} />
                    <div className="flex items-center justify-between rounded-xl border-2 border-slate-100 px-4 py-3 transition-all duration-200 peer-checked:border-[#0d7ff2] peer-checked:bg-[#e7f3ff]/40">
                      <span className="text-sm font-semibold text-slate-700">{base}</span>
                      <div className="size-4 rounded-md border-2 border-slate-300 flex items-center justify-center peer-checked:border-[#0d7ff2] peer-checked:bg-[#0d7ff2]">
                        <span className="material-symbols-rounded text-white text-[12px] font-bold opacity-0 peer-checked:opacity-100">check</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100 mx-2"></div>

        {/* Question 3: True/False */}
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 pb-10">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#e7f9ef] shadow-[0_4px_12px_-2_rgba(0,0,0,0.05)] flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-rounded text-emerald-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold mb-3 leading-snug text-slate-900">
                DNA replication occurs in a conservative manner where the original helix remains intact.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="cursor-pointer">
                  <input className="peer hidden" name="tf_q" type="radio" />
                  <div className="h-14 rounded-xl border-2 border-slate-100 flex items-center justify-center gap-2 bg-white shadow-sm transition-all duration-300 peer-checked:border-emerald-500 peer-checked:bg-emerald-50/50 peer-checked:translate-y-0.5">
                    <div className="size-6 rounded-full bg-[#e7f9ef] flex items-center justify-center">
                      <span className="material-symbols-rounded text-emerald-600 text-sm font-bold">done</span>
                    </div>
                    <span className="font-bold text-[10px] text-emerald-700 tracking-wider">TRUE</span>
                  </div>
                </label>
                <label className="cursor-pointer">
                  <input className="peer hidden" name="tf_q" type="radio" />
                  <div className="h-14 rounded-xl border-2 border-slate-100 flex items-center justify-center gap-2 bg-white shadow-sm transition-all duration-300 peer-checked:border-rose-500 peer-checked:bg-[#fef1f1]/50 peer-checked:translate-y-0.5">
                    <div className="size-6 rounded-full bg-[#fef1f1] flex items-center justify-center">
                      <span className="material-symbols-rounded text-rose-600 text-sm font-bold">close</span>
                    </div>
                    <span className="font-bold text-[10px] text-rose-700 tracking-wider">FALSE</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Shared Floating Actions from Knowledge Card */}
      <div className="absolute bottom-6 left-0 right-0 px-6 z-40 pointer-events-none">
        <div className="flex items-center justify-between gap-3 pointer-events-auto max-w-[400px] mx-auto">
          <button 
            onClick={() => setShowComplete(true)}
            className="flex-1 h-12 bg-black text-white rounded-full flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(0,0,0,0.15)] active:scale-95 transition-all"
          >
            <span className="text-[14px] font-extrabold tracking-tight">Submit Answers</span>
            <span className="material-symbols-rounded text-[18px]">send</span>
          </button>
          
          <button 
            className="w-12 h-12 bg-white rounded-full shadow-[0_8px_24px_rgba(0,0,0,0.1)] border border-black/5 flex items-center justify-center active:scale-90 transition-all group relative"
          >
            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
            <span className="material-symbols-rounded text-slate-900 text-[22px] relative z-10">chat_bubble</span>
            <div className="absolute top-3 right-3 w-2 h-2 bg-accent-purple rounded-full border-2 border-white z-20"></div>
          </button>
        </div>
      </div>

      {/* Background Decor */}
      <div className="absolute top-40 -left-20 w-64 h-64 bg-blue-100/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

      {/* Completion Modal */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[380px] bg-white rounded-[40px] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mb-6">
              <span className="material-symbols-rounded text-emerald-500 text-5xl">check_circle</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Quiz Complete!</h2>
            <p className="text-slate-500 text-sm mb-8 font-medium">You nailed the assessment with 100% accuracy. Well done!</p>
            <button 
              onClick={() => navigate('/knowledge-tree')}
              className="w-full py-4 bg-black text-white rounded-full font-bold shadow-lg active:scale-95 transition-all"
            >
              Continue Journey
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizView;
