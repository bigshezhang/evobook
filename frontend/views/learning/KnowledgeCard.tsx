
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header';
import ClarificationSection, { QAItem } from './ClarificationSection';
import { 
  STORAGE_KEYS, 
  CourseMapGenerateResponse, 
  DAGNode, 
  FinishData,
  getClarification,
  Language
} from '../../utils/api';

const KnowledgeCard: React.FC = () => {
  const navigate = useNavigate();
  const [showComplete, setShowComplete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  
  // Course metadata loaded from localStorage
  const [courseName, setCourseName] = useState('Loading...');
  const [moduleInfo, setModuleInfo] = useState('Module');
  const [nodeTitle, setNodeTitle] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<number>(0);
  const [totalNodes, setTotalNodes] = useState<number>(20);
  const [completedNodes, setCompletedNodes] = useState<number>(12);
  
  // Internal card paging state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPagesInCard, setTotalPagesInCard] = useState(5);
  
  // Language for API calls
  const language: Language = 'en';

  // Load course data from localStorage
  useEffect(() => {
    const courseMapStr = localStorage.getItem(STORAGE_KEYS.COURSE_MAP);
    const currentNodeStr = localStorage.getItem(STORAGE_KEYS.CURRENT_NODE);
    const onboardingDataStr = localStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA);
    
    if (courseMapStr) {
      const courseMap: CourseMapGenerateResponse = JSON.parse(courseMapStr);
      setCourseName(courseMap.map_meta.course_name);
      setTotalNodes(courseMap.nodes.length);
      
      // Find current node
      if (currentNodeStr) {
        const nodeId = parseInt(currentNodeStr, 10);
        setCurrentNodeId(nodeId);
        const node = courseMap.nodes.find(n => n.id === nodeId);
        if (node) {
          setNodeTitle(node.title);
          setModuleInfo(`Module ${String(node.layer).padStart(2, '0')}`);
        }
        // Calculate completed nodes (nodes before current in the layer order)
        const completedCount = courseMap.nodes.filter(n => n.layer < (node?.layer || 1)).length;
        setCompletedNodes(completedCount);
      }
    }
    
    if (onboardingDataStr) {
      const onboardingData: FinishData = JSON.parse(onboardingDataStr);
      // Can use topic if needed
    }
  }, []);

  // Animation trigger for content changes
  const [animate, setAnimate] = useState(true);
  useEffect(() => {
    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  const handleNext = () => {
    if (currentPage < totalPagesInCard) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setShowComplete(true);
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/knowledge-tree');
    }
  };

  const handleSendQuestion = async () => {
    if (!inputValue.trim()) return;
    
    const question = inputValue.trim();
    // Add to pending questions for loading UI
    setDynamicQuestions(prev => [...prev, question]);
    setInputValue('');
    
    // Auto-scroll to bottom
    setTimeout(() => {
      const mainContainer = document.querySelector('main');
      if (mainContainer) {
        mainContainer.scrollTo({
          top: mainContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    
    // Call API to get clarification
    try {
      // Use current page content as context (simplified - you may want to pass actual markdown)
      const pageMarkdown = `${nodeTitle}: Current learning content about ${courseName}`;
      
      const response = await getClarification({
        language,
        user_question_raw: question,
        page_markdown: pageMarkdown
      });
      
      // Create new QA item
      const newQA: QAItem = {
        id: Date.now(),
        question: response.corrected_title || question,
        answer: response.short_answer,
        detail: null  // Will be fetched when user clicks "Details"
      };
      
      // Remove from pending and add to answered list
      setDynamicQuestions(prev => prev.filter(q => q !== question));
      setQaList(prev => [...prev, newQA]);
    } catch (error) {
      console.error('Failed to get clarification:', error);
      // Remove from pending on error
      setDynamicQuestions(prev => prev.filter(q => q !== question));
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-white dark:bg-background-dark font-sans overflow-hidden">
      {/* Top Header - Back Button + Progress Status from HTML template */}
      <header className="pt-12 px-5 pb-3 flex items-center justify-between w-full z-30 border-b border-black/[0.03] dark:border-white/[0.05] bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/knowledge-tree')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 active:scale-90 transition-transform"
          >
            <span className="material-symbols-rounded text-primary dark:text-white text-[20px]">arrow_back</span>
          </button>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10"></div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-primary/40 dark:text-white/40 uppercase tracking-widest">Progress</span>
            <div className="flex gap-1">
              <div className="w-4 h-1.5 rounded-full bg-primary dark:bg-white"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/10 dark:bg-white/10"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/10 dark:bg-white/10"></div>
            </div>
          </div>
        </div>
        <div className="bg-accent-blue/10 px-2.5 py-1 rounded-full border border-accent-blue/20">
          <span className="text-[10px] font-extrabold text-accent-blue uppercase tracking-tight">{completedNodes} / {totalNodes}</span>
        </div>
      </header>

      {/* Main Content Area - Layout & Rich Text blocks from HTML template */}
      <main className={`flex-1 overflow-y-auto no-scrollbar px-6 pt-6 pb-48 transition-all duration-300 ${animate ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
        <div className="mb-6">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-accent-purple mb-1.5 block">
            {moduleInfo} • {courseName}
          </span>
          <h1 className="text-[26px] font-extrabold text-primary dark:text-white leading-tight">
            {nodeTitle || 'Neural Networks Architecture'}
          </h1>
        </div>

        <div className="prose prose-sm max-w-none text-primary/80 dark:text-white/80 space-y-4">
          <p className="text-[15px] leading-relaxed">
            Neural networks are the backbone of modern AI. They are composed of computational nodes that mimic the way biological neurons transmit signals.
          </p>

          {/* Key Structural Elements Box */}
          <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-5 border border-black/[0.03] dark:border-white/[0.03]">
            <h3 className="text-[14px] font-bold text-primary dark:text-white mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-accent-purple rounded-full"></span>
              Key Structural Elements
            </h3>
            <ul className="space-y-3 m-0 p-0 list-none">
              <li className="flex gap-3 text-[14px] leading-snug m-0">
                <span className="text-accent-purple font-bold">•</span>
                <span><strong className="text-primary dark:text-white">Input Layer:</strong> Receives raw data like pixels or text embeddings.</span>
              </li>
              <li className="flex gap-3 text-[14px] leading-snug m-0">
                <span className="text-accent-purple font-bold">•</span>
                <span><strong className="text-primary dark:text-white">Hidden Layers:</strong> Perform non-linear transformations using activation functions.</span>
              </li>
              <li className="flex gap-3 text-[14px] leading-snug m-0">
                <span className="text-accent-purple font-bold">•</span>
                <span><strong className="text-primary dark:text-white">Output Layer:</strong> Produces the final prediction or classification.</span>
              </li>
            </ul>
          </div>

          <p className="text-[15px] leading-relaxed">
            The efficiency of a network is often measured by its depth (number of layers) and its width (number of neurons per layer). Increasing these values allows for higher abstraction.
          </p>

          {/* Stylized Table from HTML */}
          <div className="overflow-hidden rounded-2xl border border-black/[0.05] dark:border-white/[0.05] my-6">
            <table className="w-full text-[13px] text-left border-collapse m-0">
              <thead className="bg-black/[0.03] dark:bg-white/[0.05]">
                <tr>
                  <th className="px-4 py-2.5 font-bold text-primary/60 dark:text-white/60">Type</th>
                  <th className="px-4 py-2.5 font-bold text-primary/60 dark:text-white/60">Best For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.05]">
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-primary dark:text-white">CNN</td>
                  <td className="px-4 py-2.5 text-primary/60 dark:text-white/60">Image Recognition</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-primary dark:text-white">RNN</td>
                  <td className="px-4 py-2.5 text-primary/60 dark:text-white/60">Sequence Data</td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 font-semibold text-primary dark:text-white">Transformer</td>
                  <td className="px-4 py-2.5 text-primary/60 dark:text-white/60">NLP & Vision</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Expert Tip Box */}
          <div className="relative bg-accent-blue/5 border border-accent-blue/20 rounded-2xl p-5 overflow-hidden">
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-accent-blue/10 blur-xl"></div>
            <div className="flex items-center gap-2 mb-2 text-accent-blue">
              <span className="material-symbols-rounded text-[18px]">info</span>
              <span className="text-[12px] font-bold uppercase tracking-wider">Expert Tip</span>
            </div>
            <p className="text-[14px] font-medium leading-normal italic m-0">
              "Weight initialization is critical. Poor starting values can lead to vanishing gradients in deep architectures."
            </p>
          </div>

          <p className="text-[15px] leading-relaxed">
            Finally, the optimization process involves backpropagation, where the error at the output is sent back through the network to adjust weights using gradient descent.
          </p>

          {/* Preserving ClarificationSection (User's Rich Text Block) */}
          <div id="clarification-section">
            <ClarificationSection 
              pendingQuestions={dynamicQuestions}
              initialQAList={qaList}
              pageMarkdown={`${nodeTitle}: Learning content about ${courseName}`}
              language={language}
            />
          </div>
        </div>
      </main>

      {/* High-fidelity Footer - Unified Colors for Back/Forward actions */}
      <footer className="absolute bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-background-dark/90 backdrop-blur-xl border-t border-black/[0.05] dark:border-white/[0.05] pb-8 pt-4 px-6">
        {/* Segmented Progress Bars logic preserved */}
        <div className="flex gap-1.5 mb-6 w-full">
          {[...Array(totalPagesInCard)].map((_, i) => (
            <div 
              key={i} 
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < currentPage ? 'bg-primary dark:bg-white' : 'bg-black/10 dark:bg-white/10'}`}
            ></div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          {/* Back Action - Unified text color */}
          <button 
            onClick={handleBack}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-white/5 neo-shadow active:scale-95 transition-all border border-black/[0.03] dark:border-white/10"
          >
            <span className="material-symbols-rounded text-[24px] text-primary dark:text-white">arrow_back</span>
          </button>

          {/* Ask Input */}
          <div className="flex-1 relative flex items-center">
            <input 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendQuestion()}
              className="w-full h-12 pl-12 pr-4 bg-white dark:bg-white/5 border border-black/[0.06] dark:border-white/10 rounded-full text-[14px] font-medium text-primary dark:text-white placeholder:text-black/20 dark:placeholder:text-white/20 focus:outline-none input-shadow" 
              placeholder="ask me" 
              type="text"
            />
            <button 
              onClick={handleSendQuestion}
              className="absolute left-4 flex items-center justify-center text-accent-purple hover:scale-110 active:scale-95 transition-transform"
            >
              <span className="material-symbols-rounded text-[20px] fill-current">auto_awesome</span>
            </button>
          </div>

          {/* Forward Action - Unified text color */}
          <button 
            onClick={handleNext}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-white/5 neo-shadow active:scale-95 transition-all border border-black/[0.03] dark:border-white/10"
          >
            <span className="material-symbols-rounded text-[24px] text-primary dark:text-white">arrow_forward</span>
          </button>
        </div>
      </footer>

      {/* Decorative Glows */}
      <div className="absolute top-20 -right-20 w-64 h-64 bg-accent-blue/10 blur-[80px] rounded-full pointer-events-none -z-10"></div>
      <div className="absolute bottom-40 -left-20 w-64 h-64 bg-accent-purple/10 blur-[80px] rounded-full pointer-events-none -z-10"></div>

      {/* Completion Modal */}
      {showComplete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-[380px] bg-white dark:bg-card-dark rounded-[40px] p-10 flex flex-col items-center text-center shadow-2xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-amber-100 dark:bg-amber-100/10 rounded-3xl flex items-center justify-center mb-6">
              <span className="material-symbols-rounded text-amber-500 text-5xl">stars</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight uppercase italic">Goal Reached!</h2>
            <p className="text-slate-500 text-sm mb-6 font-medium px-4">You've finished this section. Great job staying focused!</p>
            <button 
              onClick={() => navigate('/game')}
              className="w-full py-4 bg-black dark:bg-white dark:text-black text-white rounded-full font-black text-[15px] shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Go to Travel
              <span className="material-symbols-rounded text-[18px]">sports_esports</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeCard;
