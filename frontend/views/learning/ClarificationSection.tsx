
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import QADetailModal from './QADetailModal';

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Diffusion Blur Overlay */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[8px]" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-[340px] bg-white dark:bg-card-dark rounded-[40px] p-8 flex flex-col items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.1),0_10px_20px_rgba(0,0,0,0.05)] z-10 animate-in zoom-in duration-300">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-rounded text-red-500 text-[32px]">delete_sweep</span>
        </div>
        
        <h2 className="text-[22px] font-extrabold text-primary dark:text-white leading-tight mb-2">
          Delete Clarification?
        </h2>
        
        <p className="text-[14px] font-medium text-black/40 dark:text-white/40 leading-relaxed mb-8">
          This action cannot be recovered.
        </p>

        <div className="w-full flex items-center justify-between px-2 mb-10">
          <span className="text-[13px] font-bold text-primary/70 dark:text-white/70">Don't ask me again</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input className="sr-only peer" type="checkbox" />
            <div className="w-11 h-6 bg-black/5 dark:bg-white/10 rounded-full peer peer-checked:bg-primary transition-all shadow-[inset_0_2px_4px_rgba(0,0,0,0.1),0_1px_2px_rgba(255,255,255,0.8)]"></div>
            <div className="absolute left-1 top-1 w-4 h-4 rounded-full transition-all peer-checked:translate-x-5 shadow-[0_4px_6px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.08)] bg-gradient-to-br from-white to-[#f0f0f0]"></div>
          </label>
        </div>

        <div className="w-full space-y-3">
          <button 
            onClick={onConfirm}
            className="w-full h-14 bg-primary text-white font-bold rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.08)] active:scale-[0.97] transition-all text-[15px]"
          >
            Delete
          </button>
          <button 
            onClick={onClose}
            className="w-full h-14 bg-gray-100 dark:bg-white/5 text-primary/60 dark:text-white/60 font-bold rounded-full active:scale-[0.97] transition-all text-[15px]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ClarificationSection: React.FC = () => {
  const [selectedQA, setSelectedQA] = useState<any>(null);
  const [qaList, setQaList] = useState([
    {
      id: 1,
      question: "What is an activation function?",
      answer: "It's a mathematical gate that decides if a neuron should \"fire\" or not. By adding non-linearity, it allows the network to learn complex relationships beyond simple straight lines.",
      detail: {
        title: "Deep Dive: Activation Functions",
        content: [
          "Activation functions are the mathematical \"gatekeepers\" of a neural network. Without them, a network would just be a giant linear regression model, incapable of learning the complex, non-linear patterns found in real-world data like images or human speech.",
          "Popular functions include ReLU (Rectified Linear Unit), which outputs the input directly if it's positive, and Sigmoid, which squashes values between 0 and 1.",
          "Choosing the right function depends on the layer type. For example, Softmax is almost always used in the final layer for classification to produce probability distributions."
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
          "Network depth refers to the number of hidden layers between input and output. Deep networks (where the term 'Deep Learning' comes from) are capable of learning hierarchical representations.",
          "Lower layers typically detect simple features (like edges in images), while deeper layers combine these into complex objects (like faces).",
          "However, too many layers can lead to 'vanishing gradients', where the signal becomes too weak for the model to learn effectively."
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
    <div className="mt-4 pt-3 border-t border-black/[0.03] dark:border-white/[0.05]">
      <div className="space-y-2">
        {qaList.map((item) => (
          <div key={item.id} className="bg-white dark:bg-card-dark rounded-[24px] py-3 px-5 border border-black/[0.03] dark:border-white/5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between gap-4 mb-1.5 min-h-[32px]">
              <h4 className="flex-1 text-[15px] font-extrabold text-primary dark:text-white leading-none">
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
                  aria-label="Remove" 
                  className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 dark:bg-white/5 active:scale-90 transition-all border border-slate-100 dark:border-white/5 cursor-pointer"
                >
                  <span className="material-symbols-rounded text-slate-400 text-[16px]">close</span>
                </button>
              </div>
            </div>

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

      {/* Details Modal */}
      <QADetailModal 
        isOpen={!!selectedQA} 
        onClose={() => setSelectedQA(null)} 
        data={selectedQA} 
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal 
        isOpen={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default ClarificationSection;
