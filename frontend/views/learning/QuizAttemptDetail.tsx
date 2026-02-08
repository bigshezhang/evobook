
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import {
  getQuizAttemptDetail,
  QuizAttemptDetail as QuizAttemptDetailType,
  QuizQuestion,
} from '../../utils/api';

interface UserAnswer {
  questionIdx: number;
  selected: string | string[] | boolean | null;
}

const QuizAttemptDetail: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const attemptId = searchParams.get('aid');

  const [attemptData, setAttemptData] = useState<QuizAttemptDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadAttempt = async () => {
      if (!attemptId) {
        setError('Missing attempt ID');
        setLoading(false);
        return;
      }

      try {
        const data = await getQuizAttemptDetail(attemptId);
        setAttemptData(data);
      } catch (err) {
        console.error('Failed to load quiz attempt:', err);
        setError(err instanceof Error ? err.message : 'Failed to load attempt');
      } finally {
        setLoading(false);
      }
    };

    loadAttempt();
  }, [attemptId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getOptionClasses = (
    question: QuizQuestion,
    userAnswer: UserAnswer,
    option: string
  ) => {
    const isUserSelected = question.qtype === 'multi'
      ? ((userAnswer.selected as string[]) || []).includes(option)
      : userAnswer.selected === option;

    const isCorrect = question.qtype === 'multi'
      ? (question.answers || []).includes(option)
      : question.answer === option;

    let baseStyles = "border-2 transition-all";

    if (isCorrect) {
      return `${baseStyles} border-emerald-500 bg-emerald-50/50`;
    } else if (isUserSelected && !isCorrect) {
      return `${baseStyles} border-rose-500 bg-rose-50/50`;
    } else {
      return `${baseStyles} border-slate-100 opacity-60`;
    }
  };

  const getTFClasses = (
    question: QuizQuestion,
    userAnswer: UserAnswer,
    value: boolean
  ) => {
    const isUserSelected = userAnswer.selected === value;
    const correctBool = question.answer?.toLowerCase() === 'true';
    const isCorrect = value === correctBool;

    if (isCorrect) {
      return "border-emerald-500 bg-emerald-50/50 translate-y-0.5";
    }
    if (isUserSelected && !isCorrect) {
      return "border-rose-500 bg-rose-50/50 translate-y-0.5";
    }
    return "border-slate-100 opacity-60";
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-secondary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading attempt...</p>
      </div>
    );
  }

  if (error || !attemptData) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center px-6">
        <span className="material-symbols-rounded text-rose-500 text-5xl mb-4">error</span>
        <p className="text-rose-600 font-bold text-lg mb-2">Failed to load</p>
        <p className="text-slate-500 text-center mb-6">{error || 'Unknown error'}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-secondary text-white rounded-full font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  const questions = attemptData.quiz_json.questions as QuizQuestion[];
  const userAnswers = attemptData.quiz_json.user_answers as UserAnswer[];

  return (
    <div className="flex flex-col h-screen bg-white font-display overflow-hidden">
      <Header
        title="Quiz Review"
        subtitle={`Score: ${attemptData.score !== null ? `${attemptData.score}%` : 'N/A'}`}
        onBack={() => navigate(-1)}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-8">
        {/* Attempt Info */}
        <div className="bg-slate-50 rounded-3xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-rounded text-slate-400">event</span>
            <span className="text-sm text-slate-600 font-medium">{formatDate(attemptData.created_at)}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-rounded text-slate-400">assessment</span>
            <span className="text-sm text-slate-600 font-medium">
              {questions.length} question{questions.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex gap-2 mb-6 text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-slate-600">Correct</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <span className="text-slate-600">Your Wrong Answer</span>
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-8">
          {questions.map((question, qIdx) => {
            const userAnswer = userAnswers[qIdx];

            return (
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
                              className={`h-14 rounded-xl border-2 flex items-center justify-center gap-2 shadow-sm ${getTFClasses(question, userAnswer, value)}`}
                            >
                              <span className="font-bold text-[10px] tracking-wider text-[#0d7ff2]">
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
                              className={`flex items-center gap-3 rounded-xl px-4 py-3 ${getOptionClasses(question, userAnswer, option)}`}
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
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default QuizAttemptDetail;
