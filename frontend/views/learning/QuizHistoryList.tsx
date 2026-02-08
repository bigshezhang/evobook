
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import {
  getQuizHistory,
  QuizAttemptSummary,
  buildLearningPath,
} from '../../utils/api';

const QuizHistoryList: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseMapId = searchParams.get('cid');
  const nodeIdStr = searchParams.get('nid');
  const nodeId = nodeIdStr ? parseInt(nodeIdStr) : null;

  const [attempts, setAttempts] = useState<QuizAttemptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHistory = async () => {
      if (!courseMapId || !nodeId) {
        setError('Missing course or node ID');
        setLoading(false);
        return;
      }

      try {
        const response = await getQuizHistory(courseMapId, nodeId);
        setAttempts(response.attempts);
      } catch (err) {
        console.error('Failed to load quiz history:', err);
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [courseMapId, nodeId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-slate-100 text-slate-600';
    if (score >= 80) return 'bg-emerald-100 text-emerald-700';
    if (score >= 60) return 'bg-blue-100 text-blue-700';
    if (score >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-rose-100 text-rose-700';
  };

  const getScoreIcon = (score: number | null) => {
    if (score === null) return 'help';
    if (score >= 80) return 'emoji_events';
    if (score >= 60) return 'thumb_up';
    if (score >= 40) return 'sentiment_neutral';
    return 'sentiment_dissatisfied';
  };

  if (loading) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-secondary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">Loading history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-screen bg-white items-center justify-center px-6">
        <span className="material-symbols-rounded text-rose-500 text-5xl mb-4">error</span>
        <p className="text-rose-600 font-bold text-lg mb-2">Failed to load</p>
        <p className="text-slate-500 text-center mb-6">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-secondary text-white rounded-full font-bold"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white font-display overflow-hidden">
      <Header
        title="Quiz History"
        subtitle={`${attempts.length} Attempt${attempts.length !== 1 ? 's' : ''}`}
        onBack={() => navigate(-1)}
      />

      <main className="flex-1 overflow-y-auto no-scrollbar px-5 pt-6 pb-8">
        {attempts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <span className="material-symbols-rounded text-slate-300 text-6xl mb-4">quiz</span>
            <p className="text-slate-600 font-bold text-lg mb-2">No attempts yet</p>
            <p className="text-slate-400 text-sm">Complete a quiz to see your history here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {attempts.map((attempt, idx) => (
              <div
                key={attempt.id}
                onClick={() => navigate(buildLearningPath('/quiz-attempt', {
                  cid: courseMapId,
                  nid: nodeId,
                  aid: attempt.id
                }))}
                className="bg-white border-2 border-slate-100 rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${getScoreColor(attempt.score)} flex items-center justify-center`}>
                      <span className="material-symbols-rounded text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {getScoreIcon(attempt.score)}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-black text-slate-900">
                        {attempt.score !== null ? `${attempt.score}%` : 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500 font-medium">
                        {attempt.total_questions} question{attempt.total_questions !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="material-symbols-rounded text-slate-300 text-xl">arrow_forward</span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                  <span className="material-symbols-rounded text-sm">schedule</span>
                  <span>{formatDate(attempt.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default QuizHistoryList;
