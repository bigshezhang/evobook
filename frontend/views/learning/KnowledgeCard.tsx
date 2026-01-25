
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';

interface Option {
  id: string;
  text: string;
}

interface QuizProps {
  question: string;
  options: Option[];
  type: 'single' | 'multiple';
  selectedIds: string[];
  onToggle: (id: string) => void;
}

const QuizComponent: React.FC<QuizProps> = ({ question, options, type, selectedIds, onToggle }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xl font-extrabold text-[#1A1A1A]">Knowledge Check</h3>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
          {type === 'single' ? 'Single Choice' : 'Multiple Choice'}
        </span>
      </div>
      <p className="text-[17px] font-bold text-[#4A5568] leading-snug mb-6">
        {question}
      </p>
      <div className="space-y-3">
        {options.map((option) => {
          const isSelected = selectedIds.includes(option.id);
          return (
            <button
              key={option.id}
              onClick={() => onToggle(option.id)}
              className={`w-full text-left p-5 rounded-[24px] transition-all duration-200 flex justify-between items-center group ${
                isSelected
                  ? 'bg-white border-2 border-[#1A1A1A] shadow-sm'
                  : 'bg-[#F2F4F7] border-2 border-transparent text-[#98A2B3]'
              }`}
            >
              <span className={`font-bold text-[16px] ${isSelected ? 'text-[#1A1A1A]' : 'text-inherit'}`}>
                {option.text}
              </span>
              {isSelected && (
                <div className="bg-[#1A1A1A] rounded-full w-6 h-6 flex items-center justify-center animate-in zoom-in duration-200">
                  <span className="material-symbols-rounded text-white text-[16px] font-bold">check</span>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const KnowledgeCard: React.FC = () => {
  const navigate = useNavigate();
  const [showComplete, setShowComplete] = useState(false);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Simulated Multi-card Quiz Data
  const cards = [
    {
      id: 'q1',
      question: "Which component is responsible for introducing non-linearity in a Neural Network?",
      type: 'single' as const,
      img: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=800",
      options: [
        { id: '1', text: 'Activation Function' },
        { id: '2', text: 'Input Layer' },
        { id: '3', text: 'Weight Matrices' },
      ]
    },
    {
      id: 'q2',
      question: "Which of these is a common optimization algorithm used to minimize loss?",
      type: 'single' as const,
      img: "https://images.unsplash.com/photo-1509228468518-180dd4864904?auto=format&fit=crop&q=80&w=800",
      options: [
        { id: '4', text: 'Gradient Descent' },
        { id: '5', text: 'Backpropagation' },
        { id: '6', text: 'Sigmoid' },
      ]
    },
    {
      id: 'q3',
      question: "Identify the hyperparameters commonly tuned in training (Select all that apply):",
      type: 'multiple' as const,
      img: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&q=80&w=800",
      options: [
        { id: '7', text: 'Learning Rate' },
        { id: '8', text: 'Batch Size' },
        { id: '9', text: 'Number of Neurons' },
      ]
    }
  ];

  const currentCard = cards[currentCardIndex];
  const isLastCard = currentCardIndex === cards.length - 1;

  const handleToggle = (id: string) => {
    if (currentCard.type === 'single') {
      setSelectedIds([id]);
    } else {
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
  };

  const handleNextAction = () => {
    if (isLastCard) {
      setShowComplete(true);
    } else {
      // Transition to next card
      setCurrentCardIndex(prev => prev + 1);
      setSelectedIds([]); // Reset selection for next card
    }
  };

  const handleBack = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setSelectedIds([]); // Usually reset or keep state? Resetting for simplicity here.
    } else {
      navigate('/knowledge-tree');
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-[#F8F9FB] font-sans overflow-hidden">
      <div className={`flex flex-col h-full transition-all duration-300 ${showComplete ? 'brightness-50' : ''}`}>
        
        <Header 
          onBack={handleBack}
          rightAction={
            <div className="bg-white pl-3 pr-4 py-2.5 rounded-full shadow-sm border border-black/5 flex items-center gap-2">
              <div className="flex items-center justify-center w-4 h-4 bg-[#B6A3FF]/20 rounded-full">
                <div className="w-2 h-2 bg-[#B6A3FF] rounded-full"></div>
              </div>
              <span className="text-[12px] font-black text-[#1A1A1A] uppercase tracking-tight">
                {currentCardIndex + 1}/{cards.length} Cards
              </span>
            </div>
          }
        />

        {/* Progress Dots Indicator */}
        <div className="mt-6 px-8 flex gap-2 w-full z-10">
          {cards.map((_, idx) => (
            <div 
              key={idx} 
              className={`h-1 rounded-full flex-1 transition-all duration-300 ${idx <= currentCardIndex ? 'bg-[#1A1A1A]' : 'bg-black/10'}`}
            ></div>
          ))}
        </div>

        <div className="flex-1 mt-6 px-4 mb-4 overflow-hidden relative">
          <div key={currentCard.id} className="w-full h-full bg-white rounded-[40px] shadow-[0_10px_40px_rgba(0,0,0,0.03)] flex flex-col border border-black/5 overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex-1 overflow-y-auto px-8 pt-8 pb-10 no-scrollbar">
              <div className="relative w-full aspect-[4/3] rounded-[32px] overflow-hidden mb-8 border border-black/5 bg-slate-100">
                <img 
                  alt="Quiz Illustration"
                  className="w-full h-full object-cover"
                  src={currentCard.img} 
                />
              </div>

              <QuizComponent 
                question={currentCard.question}
                options={currentCard.options}
                type={currentCard.type}
                selectedIds={selectedIds}
                onToggle={handleToggle}
              />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 pb-12 flex flex-col items-center gap-6">
          <div className="flex gap-2">
            {cards.map((_, idx) => (
              <div 
                key={idx} 
                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentCardIndex ? 'bg-[#1A1A1A]' : 'bg-[#1A1A1A]/10'}`}
              ></div>
            ))}
          </div>
          
          <button 
            disabled={selectedIds.length === 0}
            onClick={handleNextAction}
            className={`w-full max-w-sm py-5 rounded-[24px] font-black text-[17px] flex items-center justify-center gap-3 shadow-xl transition-all ${
              selectedIds.length > 0 
                ? 'bg-[#1A1A1A] text-white active:scale-95' 
                : 'bg-slate-100 text-slate-300'
            }`}
          >
            {isLastCard ? 'Complete Section' : 'Next Page'}
            <span className="material-symbols-rounded text-[22px] font-bold">
              {isLastCard ? 'check_circle' : 'arrow_forward'}
            </span>
          </button>
        </div>
      </div>

      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[380px] bg-white rounded-[40px] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-300 border border-white/20">
            <div className="relative w-48 h-48 mb-6">
              <div className="absolute inset-0 bg-[#FFB865]/20 blur-[40px] rounded-full"></div>
              <img alt="Trophy" className="relative w-full h-full object-contain" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDrcgiX1RzOuQ20foFUyXSErk5C9X0S8bbS29NNzsC5WAQgUxxR0MHE4pgzhU-HEy8WY6S9lCh4CCL3xGatnmmYUfqddUlO84eXSSpuNahqFlavZE-I1brddW4uqZfB22Zy4WQOVOO6IHRe2QmdS50DaT-AHJHamw1G7arlmj_MCxhK5LPnChTufwfJbHo3iIbtbCYW-SFbp9ckcoPDRaHyqZlm2Fn4lYNQZLr5N_c3v3MV2f6cjlnMOl0E7WFDjIvdW-Vm4wsIIxnu" />
            </div>
            <h2 className="text-[32px] font-extrabold text-[#1A1A1A] mb-8 tracking-tight">Section Complete!</h2>
            <div className="flex gap-3 mb-10 w-full">
              <div className="flex-1 bg-slate-50 p-4 rounded-3xl border border-black/5 flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-[#B6A3FF]/20 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-rounded text-[#B6A3FF] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>casino</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#1A1A1A]">+2 Dice Rolls</span>
              </div>
              <div className="flex-1 bg-slate-50 p-4 rounded-3xl border border-black/5 flex flex-col items-center gap-2">
                <div className="w-10 h-10 bg-[#FFB865]/20 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-rounded text-[#FFB865] text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
                </div>
                <span className="text-[13px] font-extrabold text-[#1A1A1A]">+50 EXP</span>
              </div>
            </div>
            <div className="w-full space-y-4">
              <button 
                onClick={() => navigate('/game')}
                className="w-full bg-[#1A1A1A] text-white py-5 px-8 rounded-full font-extrabold text-[17px] flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
              >
                Go Explore World
                <span className="material-symbols-rounded text-[22px]">arrow_forward</span>
              </button>
              <button 
                onClick={() => {
                  setShowComplete(false);
                  setCurrentCardIndex(0);
                  setSelectedIds([]);
                  navigate('/knowledge-tree');
                }}
                className="w-full text-slate-400 font-bold text-[15px] hover:text-[#1A1A1A] transition-colors"
              >
                Continue Learning
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeCard;
