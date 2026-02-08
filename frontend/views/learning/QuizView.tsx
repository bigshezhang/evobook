
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
  submitQuizAttempt,
  earnExp,
  QuizGenerateResponse,
  QuizQuestion,
  buildLearningPath,
  DAGNode,
} from '../../utils/api';
import { heartbeatManager } from '../../utils/learningHeartbeat';
import { useLanguage } from '../../utils/LanguageContext';

import { ROUTES } from '../../utils/routes';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';

interface UserAnswer {
  questionIdx: number;
  selected: string | string[] | boolean | null;
}

const QuizView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const language = useLanguage();
  // 设置页面主题色（状态栏颜色）
  useThemeColor(PAGE_THEME_COLORS.WHITE);

  const cidFromUrl = searchParams.get('cid');
  const nidFromUrl = searchParams.get('nid');
  const [courseMapId, setCourseMapId] = useState<string | null>(cidFromUrl);
  const [nodeId, setNodeId] = useState<number | null>(nidFromUrl ? parseInt(nidFromUrl) : null);
  const [showGreeting, setShowGreeting] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [quizStats, setQuizStats] = useState({ correct: 0, total: 0, gold: 0 });
  const [rewardData, setRewardData] = useState<{
    diceRolls: number;
    expEarned: number;
    goldEarned: number;
  }>({ diceRolls: 2, expEarned: 50, goldEarned: 0 });

  // Loading states
  const [initialLoading, setInitialLoading] = useState(true); // Loading course data
  const [generatingQuiz, setGeneratingQuiz] = useState(false); // Generating quiz
  const [error, setError] = useState<string | null>(null);

  // Course and topics data (loaded initially)
  const [courseData, setCourseData] = useState<any>(null);
  const [completedTopics, setCompletedTopics] = useState<Array<{ topic_name: string; pages_markdown: string }>>([]);

  // Quiz data from API (loaded after clicking start)
  const [quizData, setQuizData] = useState<QuizGenerateResponse | null>(null);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);

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

  // Load course data and completed topics (initial load, no quiz generation yet)
  useEffect(() => {
    const loadCourseData = async () => {
      setInitialLoading(true);
      setError(null);

      if (!cidFromUrl) {
        setError('No course ID provided');
        setInitialLoading(false);
        return;
      }

      try {
        // Get course data and node progress from backend
        const [fetchedCourseData, progressData] = await Promise.all([
          getCourseDetail(cidFromUrl),
          getNodeProgress(cidFromUrl),
        ]);

        setCourseMapId(fetchedCourseData.course_map_id);
        setCourseData(fetchedCourseData);

        // Find all completed nodes
        const completedNodeIds = progressData.progress
          .filter(p => p.status === 'completed')
          .map(p => p.node_id);

        if (completedNodeIds.length === 0) {
          setError('Please complete some learning content first');
          setInitialLoading(false);
          return;
        }

        // Prepare learned topics for quiz generation (will be used when user clicks start)
        const topics = (fetchedCourseData.nodes as DAGNode[])
          .filter(node => completedNodeIds.includes(node.id))
          .map(node => ({
            topic_name: node.title,
            pages_markdown: node.description, // Use description as fallback
          }));

        setCompletedTopics(topics);

      } catch (err) {
        console.error('Failed to load course data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load course data');
      } finally {
        setInitialLoading(false);
      }
    };

    loadCourseData();
  }, [cidFromUrl]);

  // Generate quiz when user clicks start button
  const handleStartQuiz = async () => {
    if (!courseData || completedTopics.length === 0) return;

    setGeneratingQuiz(true);
    setError(null);

    try {
      // Call LLM to generate quiz
      const response = await generateQuiz({
        language: language,
        mode: courseData.map_meta.mode,
        learned_topics: completedTopics,
      });

      setQuizData(response);

      // Initialize user answers
      setUserAnswers(response.questions.map((_, idx) => ({
        questionIdx: idx,
        selected: null,
      })));

      // Hide greeting and show quiz
      setShowGreeting(false);

    } catch (err) {
      console.error('Failed to generate quiz:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate quiz');
    } finally {
      setGeneratingQuiz(false);
    }
  };

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
    if (!quizData) return { correct: 0, total: 0, gold: 0 };

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
    const stats = { correct, total: quizData.questions.length, gold };
    setQuizStats(stats);
    return stats;
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

  // Initial loading state (loading course data)
  if (initialLoading) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-secondary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading course data...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center px-6">
        <span className="material-symbols-rounded text-rose-500 text-5xl mb-4">error</span>
        <p className="text-rose-600 font-bold text-lg mb-2">Loading Failed</p>
        <p className="text-slate-500 text-center mb-6">{error}</p>
        <button
          onClick={() => navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: courseMapId }))}
          className="px-6 py-3 bg-secondary text-white rounded-full font-bold"
        >
          Back to Course
        </button>
      </div>
    );
  }

  // Generating quiz loading state
  if (generatingQuiz) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-secondary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">AI is generating quiz...</p>
      </div>
    );
  }

  if (showGreeting) {
    return (
      <div className="relative flex flex-col h-screen bg-white font-display overflow-hidden">
        {/* Header with History Button */}
        <Header
          onBack={() => navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: courseMapId }))}
          rightAction={
            <button
              onClick={() => navigate(buildLearningPath(ROUTES.QUIZ_HISTORY, { cid: courseMapId, nid: nodeId }))}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/5 active:scale-90 transition-transform"
            >
              <span className="material-symbols-rounded text-slate-900 text-[20px]">history</span>
            </button>
          }
        />

        {/* Background Glow */}
        <div className="absolute top-[-10%] right-[-20%] w-96 h-96 bg-accent-purple/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-[-10%] left-[-20%] w-96 h-96 bg-accent-blue/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* 可滚动内容区 */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-28 text-center">
          <div className="animate-in fade-in zoom-in slide-in-from-bottom-8 duration-700 flex flex-col items-center max-w-sm mx-auto pt-8">
            <div className="-mt-2 mb-4 relative w-[160px] h-[160px] mx-auto">
              <Mascot scene="onboarding" width="100%" className="drop-shadow-2xl relative z-10" />
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-secondary mb-3">Assessment Ready</p>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-tight mb-4 italic uppercase">
              Time to test <br /> your progress!
            </h1>
            <p className="text-slate-500 text-[14px] font-medium leading-relaxed mb-8">
              Test your knowledge on the topics you've completed
            </p>

            <div className="w-full space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-left pl-2">Topics Included:</h4>
              {completedTopics.map((topic, i) => (
                <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100 shadow-sm animate-in fade-in slide-in-from-left-4" style={{ animationDelay: `${i * 150}ms` }}>
                  <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm">
                    <span className="material-symbols-rounded text-secondary text-xl">school</span>
                  </div>
                  <span className="text-[13px] font-bold text-slate-800 tracking-tight">{topic.topic_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 固定浮动按钮 - 不随滚动移动 */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white via-white/95 to-transparent pt-12 z-50 pointer-events-none">
          <button
            onClick={handleStartQuiz}
            className="w-full py-5 bg-black text-white rounded-[28px] font-black text-base shadow-[0_20px_40px_rgba(0,0,0,0.15)] active:scale-95 transition-all flex items-center justify-center gap-3 group pointer-events-auto"
          >
            Start Assessment
            <span className="material-symbols-rounded text-xl group-hover:translate-x-1 transition-transform">bolt</span>
          </button>
        </div>
      </div>
    );
  }

  // If quiz data is not loaded yet (should not reach here normally)
  if (!quizData) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center px-6">
        <span className="material-symbols-rounded text-rose-500 text-5xl mb-4">error</span>
        <p className="text-rose-600 font-bold text-lg mb-2">Quiz not loaded</p>
        <p className="text-slate-500 text-center mb-6">Please try again</p>
        <button
          onClick={() => navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: courseMapId }))}
          className="px-6 py-3 bg-secondary text-white rounded-full font-bold"
        >
          Back to Course
        </button>
      </div>
    );
  }

  // Calculate answered count
  const answeredCount = userAnswers.filter(a => {
    if (a.selected === null) return false;
    if (Array.isArray(a.selected)) return a.selected.length > 0;
    return true;
  }).length;

  return (
    <div className="relative flex flex-col h-screen bg-white font-display overflow-hidden">
      <Header
        onBack={() => navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: courseMapId }))}
        subtitle={`Answered ${answeredCount}/${quizData.questions.length}`}
        rightAction={
          <button
            onClick={() => navigate(buildLearningPath(ROUTES.QUIZ_HISTORY, { cid: courseMapId, nid: nodeId }))}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 active:scale-90 transition-transform"
          >
            <span className="material-symbols-rounded text-slate-900 text-[20px]">history</span>
          </button>
        }
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
            onClick={async () => {
              if (submitted) {
                const stats = calculateScore();
                // Call earnExp to actually award gold/dice/EXP
                if (courseMapId && nodeId) {
                  try {
                    const expResponse = await earnExp({
                      exp_amount: 50,
                      gold_reward: stats.gold,
                      dice_reward: 2,
                      source: 'quiz_completion',
                      source_details: {
                        course_map_id: courseMapId,
                        node_id: nodeId,
                        activity_type: 'quiz_complete',
                        score: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
                      },
                    });

                    setRewardData({
                      diceRolls: expResponse.rewards.dice_rolls,
                      expEarned: expResponse.exp_earned,
                      goldEarned: expResponse.rewards.gold,
                    });

                    // Dispatch events for GameHeader
                    window.dispatchEvent(new CustomEvent('exp-changed', {
                      detail: {
                        newExp: expResponse.current_exp,
                        levelUp: expResponse.level_up,
                        newLevel: expResponse.current_level,
                        expToNextLevel: 100 + 50 * (expResponse.current_level - 1),
                      }
                    }));

                    if (expResponse.rewards.gold > 0) {
                      window.dispatchEvent(new CustomEvent('gold-changed', {
                        detail: { amount: expResponse.rewards.gold }
                      }));
                    }

                    console.log('[QuizView] Rewards earned:', expResponse);
                  } catch (error) {
                    console.error('[QuizView] Failed to earn rewards:', error);
                  }
                }
                setShowReward(true);
              } else {
                setSubmitted(true);
                calculateScore();
              }
            }}
            className="flex-1 h-12 bg-black text-white rounded-full flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <span className="text-[14px] font-extrabold tracking-tight">
              {submitted ? 'View Results' : 'Submit Answers'}
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
          // Submit quiz attempt to backend
          if (courseMapId && nodeId && quizData) {
            try {
              await submitQuizAttempt({
                course_map_id: courseMapId,
                node_id: nodeId,
                quiz_json: {
                  questions: quizData.questions,
                  user_answers: userAnswers,
                },
                score: Math.round((quizStats.correct / quizStats.total) * 100),
              });
              console.log('[QuizView] Quiz attempt submitted successfully');

              // Check if this is the first completion - update node progress
              const progressData = await getNodeProgress(courseMapId);
              const currentNodeProgress = progressData.progress.find(p => p.node_id === nodeId);

              if (currentNodeProgress?.status !== 'completed') {
                await updateNodeProgress(courseMapId, nodeId, 'completed');
                console.log('[QuizView] Node marked as completed');
              } else {
                console.log('[QuizView] Node already completed, not updating status');
              }
            } catch (error) {
              console.error('Failed to submit quiz or update progress:', error);
            }
          }
          navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: courseMapId }));
        }}
        diceRolls={rewardData.diceRolls}
        expEarned={rewardData.expEarned}
        goldEarned={rewardData.goldEarned}
      />
    </div>
  );
};

export default QuizView;
