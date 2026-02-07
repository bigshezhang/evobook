
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import RewardModal from '../../components/RewardModal';
import Mascot from '../../components/Mascot';
import { 
  generateQuiz, 
  getCourseDetail,
  getNodeProgress,
  updateNodeProgress,
  QuizGenerateResponse,
  QuizQuestion,
  buildLearningPath,
  DAGNode,
} from '../../utils/api';
import { heartbeatManager } from '../../utils/learningHeartbeat';

interface UserAnswer {
  questionIdx: number;
  selected: string | string[] | boolean | null;
}

const QuizView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cidFromUrl = searchParams.get('cid');
  const nidFromUrl = searchParams.get('nid');
  const [courseMapId, setCourseMapId] = useState<string | null>(cidFromUrl);
  const [nodeId, setNodeId] = useState<number | null>(nidFromUrl ? parseInt(nidFromUrl) : null);
  const [showGreeting, setShowGreeting] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [quizStats, setQuizStats] = useState({ correct: 0, total: 0, gold: 0 });
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Quiz data from API
  const [quizData, setQuizData] = useState<QuizGenerateResponse | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  
  const MASCOT_SRC = "https://lh3.googleusercontent.com/aida-public/AB6AXuCnRMVMv3VQCalsOm2RCkci09ous1fHuESh9sMZOzls1ru6VuE5HAlxYcKU6AswyAOsq12l9kr0vdwHeD8hswbrsxz4xZRK5oDlUPQMkmsbBJks_RVJ7JpcWNSLbPi4ISfkMH__idCAOv8RTmRLMNFkIzfyPwb3vJzSQ628ux_fwHE7XdjKa0LbGIrGOhhEmLaWRqfg-nPFNVhkih46KYodq5ipAZkQGeaLwK99YG7Az-UcKbMDqfxhd6RQqOg4faz2K3kd90U7PsXV";

  // Start/stop heartbeat when entering/leaving the quiz page
  useEffect(() => {
    if (courseMapId && nodeId) {
      heartbeatManager.start(courseMapId, nodeId);
      console.log('[QuizView] Heartbeat started', { courseMapId, nodeId });
    }

    return () => {
      heartbeatManager.stop();
      console.log('[QuizView] Heartbeat stopped');
    };
  }, [courseMapId, nodeId]);

  // Load quiz from API
  useEffect(() => {
    const loadQuiz = async () => {
      setLoading(true);
      setError(null);
      
      if (!cidFromUrl) {
        setError('No course ID provided');
        return;
      }
      
      try {
        // Get course data and node progress from backend
        const [courseData, progressData] = await Promise.all([
          getCourseDetail(cidFromUrl),
          getNodeProgress(cidFromUrl),
        ]);
        
        setCourseMapId(courseData.course_map_id);
        
        // Find all completed nodes
        const completedNodeIds = progressData.progress
          .filter(p => p.status === 'completed')
          .map(p => p.node_id);
        
        if (completedNodeIds.length === 0) {
          setError('Please complete some learning content first');
          return;
        }
        
        // Get markdown content for completed nodes from course data
        // Note: We don't have the actual markdown content here, only node metadata
        // For quiz generation, we'll use node titles and descriptions
        const learnedTopics = (courseData.nodes as DAGNode[])
          .filter(node => completedNodeIds.includes(node.id))
          .map(node => ({
            topic_name: node.title,
            pages_markdown: node.description, // Use description as fallback
          }));
        
        // Call API
        const response = await generateQuiz({
          language: 'zh',
          mode: courseData.map_meta.mode,
          learned_topics: learnedTopics,
        });
        
        setQuizData(response);
        
        // Initialize user answers
        setUserAnswers(response.questions.map((_, idx) => ({
          questionIdx: idx,
          selected: null,
        })));
        
      } catch (err) {
        console.error('Failed to load quiz:', err);
        setError(err instanceof Error ? err.message : '加载测验失败');
      } finally {
        setLoading(false);
      }
    };
    
    loadQuiz();
  }, []);

  const handleSingleSelect = (questionIdx: number, optionIdx: number) => {
    if (submitted) return;
    setUserAnswers(prev => prev.map(a => 
      a.questionIdx === questionIdx 
        ? { ...a, selected: quizData!.questions[questionIdx].options![optionIdx] }
        : a
    ));
  };

  const handleMultiSelect = (questionIdx: number, optionIdx: number) => {
    if (submitted) return;
    const option = quizData!.questions[questionIdx].options![optionIdx];
    setUserAnswers(prev => prev.map(a => {
      if (a.questionIdx !== questionIdx) return a;
      const current = (a.selected as string[]) || [];
      const newSelected = current.includes(option)
        ? current.filter(o => o !== option)
        : [...current, option];
      return { ...a, selected: newSelected };
    }));
  };

  const handleBooleanSelect = (questionIdx: number, value: boolean) => {
    if (submitted) return;
    setUserAnswers(prev => prev.map(a => 
      a.questionIdx === questionIdx 
        ? { ...a, selected: value }
        : a
    ));
  };

  const calculateScore = () => {
    if (!quizData) return;
    
    let correct = 0;
    quizData.questions.forEach((q, idx) => {
      const userAnswer = userAnswers[idx].selected;
      
      if (q.qtype === 'single') {
        if (userAnswer === q.answer) correct++;
      } else if (q.qtype === 'multi') {
        const correctAnswers = q.answers || [];
        const userAnswersArr = (userAnswer as string[]) || [];
        const isCorrect = correctAnswers.length === userAnswersArr.length &&
          correctAnswers.every(a => userAnswersArr.includes(a));
        if (isCorrect) correct++;
      } else if (q.qtype === 'boolean') {
        const correctBool = q.answer?.toLowerCase() === 'true';
        if (userAnswer === correctBool) correct++;
      }
    });
    
    const gold = correct * 100;
    setQuizStats({ correct, total: quizData.questions.length, gold });
  };

  const getOptionClasses = (question: QuizQuestion, questionIdx: number, optionIdx: number) => {
    const option = question.options![optionIdx];
    const userAnswer = userAnswers[questionIdx]?.selected;
    const isSelected = question.qtype === 'multi'
      ? ((userAnswer as string[]) || []).includes(option)
      : userAnswer === option;
    
    let baseStyles = "border-2 transition-all duration-200 cursor-pointer";

    if (!submitted) {
      return `${baseStyles} ${isSelected ? "border-[#0d7ff2] bg-[#e7f3ff]/40" : "border-slate-100"}`;
    }

    const isCorrect = question.qtype === 'multi'
      ? (question.answers || []).includes(option)
      : question.answer === option;
    
    let stateStyles = "";
    if (isCorrect) stateStyles = "border-emerald-500 bg-emerald-50/50";
    else if (isSelected && !isCorrect) stateStyles = "border-rose-500 bg-rose-50/50";
    else stateStyles = "border-slate-100 opacity-60";

    return `${baseStyles} ${stateStyles}`;
  };

  const getTFClasses = (questionIdx: number, value: boolean) => {
    const userAnswer = userAnswers[questionIdx]?.selected;
    const isSelected = userAnswer === value;
    const question = quizData!.questions[questionIdx];
    const correctBool = question.answer?.toLowerCase() === 'true';
    const isCorrect = value === correctBool;
    
    if (!submitted) return isSelected ? "border-[#0d7ff2] bg-[#e7f3ff]/50 translate-y-0.5" : "border-slate-100 bg-white";
    if (isCorrect) return "border-emerald-500 bg-emerald-50/50 translate-y-0.5";
    if (isSelected && !isCorrect) return "border-rose-500 bg-rose-50/50 translate-y-0.5";
    return "border-slate-100 opacity-60";
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-secondary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">AI 正在生成测验...</p>
      </div>
    );
  }

  // Error state
  if (error || !quizData) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center px-6">
        <span className="material-symbols-rounded text-rose-500 text-5xl mb-4">error</span>
        <p className="text-rose-600 font-bold text-lg mb-2">加载失败</p>
        <p className="text-slate-500 text-center mb-6">{error || '未知错误'}</p>
        <button 
          onClick={() => navigate(buildLearningPath('/knowledge-tree', { cid: courseMapId }))}
          className="px-6 py-3 bg-secondary text-white rounded-full font-bold"
        >
          返回课程
        </button>
      </div>
    );
  }

  if (showGreeting) {
    return (
      <div className="relative flex flex-col h-screen bg-white font-display overflow-y-auto no-scrollbar">
        {/* Background Glow */}
        <div className="absolute top-[-10%] right-[-20%] w-96 h-96 bg-accent-purple/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-20%] w-96 h-96 bg-accent-blue/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="flex-1 flex items-center justify-center px-8 py-12 text-center">
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
              {quizData.greeting.message}
            </p>

            <div className="w-full space-y-3 mb-12">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left pl-2">Topics Included:</h4>
              {quizData.greeting.topics_included.map((topic, i) => (
                <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${i * 150}ms` }}>
                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <span className="material-symbols-rounded text-secondary text-xl">school</span>
                  </div>
                  <span className="text-[13px] font-bold text-slate-800 tracking-tight">{topic}</span>
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
      </div>
    );
  }

  return (
    <div className="relative flex flex-col h-screen bg-white font-display overflow-hidden">
      <Header 
        onBack={() => navigate(buildLearningPath('/knowledge-tree', { cid: courseMapId }))}
        progress={{ current: 1, total: quizData.questions.length }}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pt-8 pb-32 space-y-8 animate-in fade-in duration-500">
        {quizData.questions.map((question, qIdx) => (
          <React.Fragment key={qIdx}>
            {qIdx > 0 && <div className="h-px bg-slate-100 mx-2"></div>}
            
            <section className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${qIdx * 100}ms` }}>
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-xl bg-[#e7f3ff] shadow-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="material-symbols-rounded text-[#0d7ff2] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {question.qtype === 'single' ? 'radio_button_checked' : 
                     question.qtype === 'multi' ? 'checklist' : 'bolt'}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold mb-3 leading-snug text-slate-900">
                    {question.prompt}
                  </p>
                  
                  {question.qtype === 'boolean' ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[true, false].map((value) => (
                        <div 
                          key={String(value)}
                          onClick={() => handleBooleanSelect(qIdx, value)}
                          className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 shadow-sm transition-all duration-300 cursor-pointer ${getTFClasses(qIdx, value)}`}
                        >
                          <span className={`font-bold text-[10px] tracking-wider text-[#0d7ff2]`}>
                            {value ? 'TRUE' : 'FALSE'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={question.qtype === 'multi' ? 'grid grid-cols-2 gap-2' : 'flex flex-col gap-2'}>
                      {question.options?.map((option, optIdx) => (
                        <div 
                          key={optIdx}
                          onClick={() => question.qtype === 'single' 
                            ? handleSingleSelect(qIdx, optIdx) 
                            : handleMultiSelect(qIdx, optIdx)
                          }
                          className={`flex items-center gap-3 rounded-xl px-4 py-3 ${getOptionClasses(question, qIdx, optIdx)}`}
                        >
                          <span className="text-sm font-semibold text-slate-700">{option}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </React.Fragment>
        ))}
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
                calculateScore();
              }
            }}
            className="flex-1 h-12 bg-black text-white rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <span className="text-[14px] font-extrabold tracking-tight">
              {submitted ? '查看结果' : '提交答案'}
            </span>
            <span className="material-symbols-rounded text-[18px]">
              {submitted ? 'arrow_forward' : 'send'}
            </span>
          </button>
        </div>
      </div>

      <RewardModal 
        isOpen={showReward} 
        onClose={async () => {
          // Mark quiz node as completed
          if (courseMapId && nodeId) {
            try {
              await updateNodeProgress(courseMapId, nodeId, 'completed');
            } catch (error) {
              console.error('Failed to update quiz progress:', error);
            }
          }
          navigate(buildLearningPath('/knowledge-tree', { cid: courseMapId }));
        }} 
        correctCount={quizStats.correct}
        totalCount={quizStats.total}
        goldEarned={quizStats.gold}
      />
    </div>
  );
};

export default QuizView;
