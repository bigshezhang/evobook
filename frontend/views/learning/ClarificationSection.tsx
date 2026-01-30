
import React from 'react';

const ClarificationSection: React.FC = () => {
  const qaData = [
    {
      id: 1,
      question: "What is an activation function?",
      answer: "It's a mathematical gate that decides if a neuron should \"fire\" or not. By adding non-linearity, it allows the network to learn complex relationships beyond simple straight lines."
    },
    {
      id: 2,
      question: "How many layers are optimal?",
      answer: "There's no fixed rule, but typically more layers allow for more abstraction. The \"optimal\" count is found through hyperparameter tuning and cross-validation."
    }
  ];

  return (
    <div className="mt-12 pt-10 border-t border-black/[0.05] dark:border-white/[0.05]">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-lavender-pale flex items-center justify-center shadow-inner">
          <span className="material-symbols-rounded text-[24px] text-secondary">forum</span>
        </div>
        <h2 className="text-lg font-black text-primary dark:text-white tracking-tight">Clarifications</h2>
      </div>
      
      <div className="space-y-5">
        {qaData.map((item) => (
          <div key={item.id} className="qa-card-3d">
            {/* Top Actions */}
            <div className="absolute top-4 right-4 flex items-center gap-2">
              <button className="px-4 h-8 flex items-center justify-center rounded-full bg-primary text-white dark:bg-white dark:text-primary active:scale-95 transition-all shadow-md">
                <span className="text-[10px] font-black uppercase tracking-widest">Details</span>
              </button>
              <button aria-label="Remove" className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/10 active:scale-90 transition-all border border-slate-100">
                <span className="material-symbols-rounded text-slate-400 text-lg">close</span>
              </button>
            </div>

            {/* Question */}
            <div className="pr-24">
              <p className="text-[15px] font-black text-primary dark:text-white leading-tight">
                {item.question}
              </p>
            </div>

            {/* Answer with Icon */}
            <div className="flex items-start gap-3 pt-2">
              <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
                <span className="material-symbols-rounded text-[20px] text-secondary">auto_awesome</span>
              </div>
              <p className="text-[14px] leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                {item.answer}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClarificationSection;
