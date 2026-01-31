
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import RewardModal from '../../components/RewardModal';
import Mascot from '../../components/Mascot';

const QuizView: React.FC = () => {
  const navigate = useNavigate();
  const [showGreeting, setShowGreeting] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [quizStats, setQuizStats] = useState({ correct: 0, total: 3, gold: 0 });

  // 模拟从学习轨迹中提取的知识点
  const assessmentNodes = [
    { label: 'DNA Architecture', icon: 'account_tree' },
    { label: 'Nitrogenous Bases', icon: 'Science' },
    { label: 'Replication Logic', icon: 'content_copy' }
  ];

  const MASCOT_SRC = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";

  // 答案状态管理
  const [q1Selected, setQ1Selected] = useState<number | null>(null);
  const [q2Selected, setQ2Selected] = useState<number[]>([]);
  const [q3Selected, setQ3Selected] = useState<boolean | null>(null);

  // 正确答案定义
  const q1Correct: number = 0;
  const q2Correct: number[] = [0, 2, 3]; 
  const q3Correct: boolean = false;

  const handleQ2Toggle = (idx: number) => {
    if (submitted) return;
    setQ2Selected(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const calculateScore = () => {
    let score = 0;
    if (q1Selected === q1Correct) score++;
    const isQ2Correct = q2Selected.length === q2Correct.length && 
                        q2Selected.every(val => q2Correct.includes(val));
    if (isQ2Correct) score++;
    if (q3Selected === q3Correct) score++;

    const gold = score * 100;
    setQuizStats({ correct: score, total: 3, gold: gold });
  };

  const getOptionClasses = (type: 'q1' | 'q2', idx: number) => {
    const isSelected = type === 'q1' ? q1Selected === idx : q2Selected.includes(idx);
    const isCorrect = type === 'q1' ? idx === q1Correct : q2Correct.includes(idx);
    let baseStyles = "border-2 transition-all duration-200 cursor-pointer";

    if (!submitted) {
      return `${baseStyles} ${isSelected ? "border-[#0d7ff2] bg-[#e7f3ff]/40" : "border-slate-100"}`;
    }

    let stateStyles = "";
    if (isCorrect) stateStyles = "border-emerald-500 bg-emerald-50/50";
    else if (isSelected && !isCorrect) stateStyles = "border-rose-500 bg-rose-50/50";
    else stateStyles = "border-slate-100 opacity-60";

    const userChoiceHighlight = (type === 'q2' && isSelected) ? "ring-2 ring-inset ring-black/80" : "";
    return `${baseStyles} ${stateStyles} ${userChoiceHighlight}`;
  };

  const getIconClasses = (type: 'q1' | 'q2', idx: number) => {
    const isSelected = type === 'q1' ? q1Selected === idx : q2Selected.includes(idx);
    const isCorrect = type === 'q1' ? idx === q1Correct : q2Correct.includes(idx);
    if (!submitted) return isSelected ? "border-[#0d7ff2]" : "border-slate-300";
    if (isCorrect) return "border-emerald-500 bg-emerald-500";
    if (isSelected && !isCorrect) return "border-rose-500 bg-rose-500";
    return "border-slate-300";
  };

  const getTFClasses = (value: boolean) => {
    const isSelected = q3Selected === value;
    const isCorrect = value === q3Correct;
    if (!submitted) return isSelected ? "border-[#0d7ff2] bg-[#e7f3ff]/50 translate-y-0.5" : "border-slate-100 bg-white";
    if (isCorrect) return "border-emerald-500 bg-emerald-50/50 translate-y-0.5";
    if (isSelected && !isCorrect) return "border-rose-500 bg-rose-50/50 translate-y-0.5";
    return "border-slate-100 opacity-60";
  };

  if (showGreeting) {
    return (
      <div className="relative flex flex-col h-screen bg-white font-display overflow-hidden items-center justify-center px-8 text-center">
        {/* Background Glow */}
        <div className="absolute top-[-10%] right-[-20%] w-96 h-96 bg-accent-purple/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-20%] w-96 h-96 bg-accent-blue/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="animate-in fade-in zoom-in slide-in-from-bottom-8 duration-700 flex flex-col items-center max-w-sm">
          <div className="mb-8 relative">
            <div className="absolute inset-0 bg-slate-100 rounded-full blur-2xl scale-125 opacity-50"></div>
            <Mascot src={MASCOT_SRC} width="160" className="drop-shadow-2xl relative z-10" />
          </div>

          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary mb-3">Assessment Ready</p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight mb-4 italic uppercase">
            Time to test <br /> your progress!
          </h1>
          <p className="text-slate-500 text-[14px] font-medium leading-relaxed mb-8">
            Based on your recent study of <span className="text-slate-900 font-bold">Molecular Biology</span>, I've curated a quick check-in to reinforce your memory.
          </p>

          <div className="w-full space-y-3 mb-12">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left pl-2">Topics Included:</h4>
            {assessmentNodes.map((node, i) => (
              <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                  <span className="material-symbols-rounded text-secondary text-xl">{node.icon}</span>
                </div>
                <span className="text-[13px] font-bold text-slate-800 tracking-tight">{node.label}</span>
              </div>
            ))}
          </div>

          <button 
            onClick={() => setShowGreeting(false)}
            className="w-full py-5 bg-black text-white rounded-[28px] font-black text-base shadow-[0_20px_40px_rgba(0,0,0,0.15)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
          >
            Start Assessment
            <span className="material-symbols-rounded text-xl group-hover:translate-x-1 transition-transform">bolt</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-white font-display overflow-hidden">
      <Header 
        onBack={() => navigate('/knowledge-tree')}
        progress={{ current: 12, total: 20 }}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pt-8 pb-32 space-y-8 animate-in fade-in duration-500">
        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#e7f3ff] shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
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
                  <div 
                    key={idx} 
                    onClick={() => !submitted && setQ1Selected(idx)}
                    className={`flex items-center gap-3 rounded-xl px-4 py-3 ${getOptionClasses('q1', idx)}`}
                  >
                    <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${getIconClasses('q1', idx)}`}>
                      <div className={`size-2 rounded-full transition-opacity ${
                        submitted ? 'bg-white' : 'bg-[#0d7ff2]'
                      } ${q1Selected === idx || (submitted && idx === q1Correct) ? 'opacity-100' : 'opacity-0'}`}></div>
                    </div>
                    <span className={`text-sm font-semibold ${submitted && idx === q1Correct ? 'text-emerald-700' : 'text-slate-700'}`}>{option}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100 mx-2"></div>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#e7f3ff] shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-rounded text-[#0d7ff2] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>checklist</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold mb-3 leading-snug text-slate-900">
                Which of the following are nitrogenous bases found in DNA?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {["Adenine", "Uracil", "Guanine", "Cytosine"].map((base, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => handleQ2Toggle(idx)}
                    className={`flex items-center justify-between rounded-xl px-4 py-3 ${getOptionClasses('q2', idx)}`}
                  >
                    <span className={`text-sm font-semibold ${submitted && q2Correct.includes(idx) ? 'text-emerald-700' : 'text-slate-700'}`}>{base}</span>
                    <div className={`size-4 rounded-md border-2 flex items-center justify-center transition-all ${getIconClasses('q2', idx)}`}>
                      <span className="material-symbols-rounded text-white text-[12px] font-bold">
                        { (q2Selected.includes(idx) || (submitted && q2Correct.includes(idx))) ? 'check' : '' }
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-slate-100 mx-2"></div>

        <section className="animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 pb-10">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-xl bg-[#e7f3ff] shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="material-symbols-rounded text-[#0d7ff2] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
            </div>
            <div className="flex-1">
              <p className="text-[14px] font-bold mb-3 leading-snug text-slate-900">
                DNA replication occurs in a conservative manner where the original helix remains intact.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div 
                  onClick={() => !submitted && setQ3Selected(true)}
                  className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 cursor-pointer ${getTFClasses(true)}`}
                >
                  <div className={`size-6 rounded-full flex items-center justify-center ${
                    submitted && q3Correct ? 'bg-emerald-100' : 'bg-[#e7f3ff]'
                  }`}>
                    <span className={`material-symbols-rounded text-sm font-bold ${
                      submitted && q3Correct ? 'text-emerald-600' : 'text-[#0d7ff2]'
                    }`}>{ (q3Selected === true || (submitted && q3Correct)) ? 'done' : '' }</span>
                  </div>
                  <span className={`font-bold text-[10px] tracking-wider ${
                    submitted && q3Correct ? 'text-emerald-700' : 'text-[#0d7ff2]'
                  }`}>TRUE</span>
                </div>
                <div 
                  onClick={() => !submitted && setQ3Selected(false)}
                  className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 cursor-pointer ${getTFClasses(false)}`}
                >
                  <div className={`size-6 rounded-full flex items-center justify-center ${
                    submitted && !q3Correct ? 'bg-emerald-100' : 'bg-[#e7f3ff]'
                  }`}>
                    <span className={`material-symbols-rounded text-sm font-bold ${
                      submitted && !q3Correct ? 'text-emerald-600' : 'text-[#0d7ff2]'
                    }`}>{ (q3Selected === false || (submitted && !q3Correct)) ? 'done' : '' }</span>
                  </div>
                  <span className={`font-bold text-[10px] tracking-wider ${
                    submitted && !q3Correct ? 'text-emerald-700' : 'text-[#0d7ff2]'
                  }`}>FALSE</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <div className="absolute bottom-6 left-0 right-0 px-6 z-40 pointer-events-none">
        <div className="flex items-center justify-between gap-3 pointer-events-auto max-w-[400px] mx-auto">
          <button 
            onClick={() => {
              if (submitted) {
                calculateScore();
                setShowReward(true);
              } else {
                setSubmitted(true);
              }
            }}
            className="flex-1 h-12 bg-black text-white rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <span className="text-[14px] font-extrabold tracking-tight">
              {submitted ? 'Submit' : 'Submit Answers'}
            </span>
            <span className="material-symbols-rounded text-[18px]">
              {submitted ? 'arrow_forward' : 'send'}
            </span>
          </button>
          
          <button 
            className="w-12 h-12 bg-white rounded-full shadow-sm border border-black/5 flex items-center justify-center active:scale-90 transition-all group relative overflow-visible"
          >
            <div className="absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
            <span className="material-symbols-rounded text-slate-900 text-[22px] relative z-10">refresh</span>
            <div className="absolute -top-3 -right-3 px-2 py-0.5 bg-amber-400 text-black text-[9px] font-black rounded-full border-2 border-white shadow-sm whitespace-nowrap z-20">
              -50G
            </div>
          </button>
        </div>
      </div>

      <RewardModal 
        isOpen={showReward} 
        onClose={() => navigate('/knowledge-tree')} 
        correctCount={quizStats.correct}
        totalCount={quizStats.total}
        goldEarned={quizStats.gold}
      />
    </div>
  );
};

export default QuizView;
