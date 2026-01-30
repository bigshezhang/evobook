
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
    <div className="mt-4 pt-3 border-t border-black/[0.03] dark:border-white/[0.05]">
      <div className="space-y-2">
        {qaData.map((item) => (
          <div key={item.id} className="bg-white dark:bg-card-dark rounded-[24px] py-3 px-5 border border-black/[0.03] dark:border-white/5 shadow-sm hover:shadow-md transition-all">
            {/* Top Row: Question + Actions - Compacted margin and height */}
            <div className="flex items-center justify-between gap-4 mb-1.5 min-h-[32px]">
              <h4 className="flex-1 text-[15px] font-extrabold text-primary dark:text-white leading-none">
                {item.question}
              </h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button className="px-3 h-7 flex items-center justify-center rounded-full bg-[#1A1B23] text-white active:scale-95 transition-all shadow-sm">
                  <span className="text-[9px] font-black uppercase tracking-wider">Details</span>
                </button>
                <button aria-label="Remove" className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 active:scale-90 transition-all border border-slate-100 dark:border-white/5">
                  <span className="material-symbols-rounded text-slate-400 text-[16px]">close</span>
                </button>
              </div>
            </div>

            {/* Answer Row - Tightened spacing */}
            <div className="flex items-start gap-2">
              <div className="pt-0.5 flex-shrink-0">
                <span className="material-symbols-rounded text-[16px] text-secondary" style={{ fontVariationSettings: "'FILL' 0" }}>auto_awesome</span>
              </div>
              <p className="text-[13px] leading-snug font-medium text-slate-500 dark:text-slate-400">
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
