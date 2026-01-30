
import React, { useState } from 'react';
import QADetailModal from './QADetailModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';

// 骨架屏动画组件：更精致的 Shimmer 效果
const SkeletonLoader: React.FC = () => (
  <div className="flex flex-col gap-2.5 w-full mt-2">
    <div className="h-3.5 bg-slate-100 dark:bg-white/5 rounded-full w-[90%] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
    </div>
    <div className="h-3.5 bg-slate-100 dark:bg-white/5 rounded-full w-[75%] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite_0.3s]"></div>
    </div>
    <div className="h-3.5 bg-slate-100 dark:bg-white/5 rounded-full w-[85%] relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 dark:via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite_0.6s]"></div>
    </div>
    <style dangerouslySetInnerHTML={{ __html: `
      @keyframes shimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}} />
  </div>
);

interface ClarificationSectionProps {
  pendingQuestions?: string[];
}

const ClarificationSection: React.FC<ClarificationSectionProps> = ({ pendingQuestions = [] }) => {
  const [selectedQA, setSelectedQA] = useState<any>(null);
  const [qaList, setQaList] = useState([
    {
      id: 1,
      question: "What is an activation function?",
      answer: "It's a mathematical gate that decides if a neuron should \"fire\" or not. By adding non-linearity, it allows the network to learn complex relationships beyond simple straight lines.",
      detail: {
        title: "Deep Dive: Activation Functions",
        content: [
          "Activation functions are the mathematical \"gatekeepers\" of a neural network.",
          "Popular functions include ReLU (Rectified Linear Unit), which outputs the input directly if it's positive, and Sigmoid, which squashes values between 0 and 1."
        ],
        visualLabel: "Non-Linear Transformation"
      }
    },
    {
      id: 2,
      question: "How many layers are optimal?",
      answer: "There's no fixed rule, but typically more layers allow for more abstraction. The \"optimal\" count is found through hyperparameter tuning and cross-validation.",
      detail: {
        title: "Deep Dive: Network Depth",
        content: [
          "Network depth refers to the number of hidden layers between input and output.",
          "Too many layers can lead to 'vanishing gradients', where the signal becomes too weak."
        ],
        visualLabel: "Hierarchical Abstraction"
      }
    }
  ]);

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const handleDeleteConfirm = () => {
    if (deleteTargetId !== null) {
      setQaList(prev => prev.filter(item => item.id !== deleteTargetId));
      setDeleteTargetId(null);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-black/[0.03] dark:border-white/[0.05]">
      <div className="space-y-2">
        {/* 现有问答列表 */}
        {qaList.map((item) => (
          <div key={item.id} className="bg-white dark:bg-card-dark rounded-[24px] py-2.5 px-5 border border-black/[0.03] dark:border-white/5 shadow-sm hover:shadow-md transition-all animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between gap-4 mb-1 min-h-[32px]">
              <h4 className="flex-1 text-[15px] font-extrabold text-primary dark:text-white leading-tight">
                {item.question}
              </h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                  onClick={() => setSelectedQA(item.detail)}
                  className="px-3 h-7 flex items-center justify-center rounded-full bg-[#1A1B23] text-white active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider">Details</span>
                </button>
                <button 
                  onClick={() => setDeleteTargetId(item.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 active:scale-90 transition-all border border-slate-100 dark:border-white/5 cursor-pointer"
                >
                  <span className="material-symbols-rounded text-slate-400 text-[16px]">close</span>
                </button>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="pt-0.5 flex-shrink-0">
                <span className="material-symbols-rounded text-[18px] text-secondary" style={{ fontVariationSettings: "'FILL' 0" }}>auto_awesome</span>
              </div>
              <p className="text-[13.5px] leading-relaxed font-medium text-slate-500 dark:text-slate-400">
                {item.answer}
              </p>
            </div>
          </div>
        ))}

        {/* 动态加载中的新问题 */}
        {pendingQuestions.map((q, idx) => (
          <div key={`pending-${idx}`} className="bg-white dark:bg-card-dark rounded-[24px] py-3 px-5 border-2 border-dashed border-slate-100 dark:border-white/10 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between gap-4 mb-1 min-h-[32px]">
              <h4 className="flex-1 text-[15px] font-extrabold text-primary dark:text-white leading-tight">
                {q}
              </h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="px-3 h-7 flex items-center justify-center rounded-full bg-slate-100 dark:bg-white/5 text-slate-400">
                  <span className="text-[9px] font-black uppercase tracking-wider">Processing</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="pt-1 flex-shrink-0">
                <div className="animate-spin text-secondary">
                   <span className="material-symbols-rounded text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>progress_activity</span>
                </div>
              </div>
              <SkeletonLoader />
            </div>
          </div>
        ))}
      </div>

      <QADetailModal isOpen={!!selectedQA} onClose={() => setSelectedQA(null)} data={selectedQA} />
      
      <DeleteConfirmationModal 
        isOpen={deleteTargetId !== null} 
        onClose={() => setDeleteTargetId(null)} 
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default ClarificationSection;
