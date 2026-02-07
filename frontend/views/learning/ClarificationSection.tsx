
import React, { useState, useEffect, useCallback } from 'react';
import QADetailModal from './QADetailModal';
import DeleteConfirmationModal from '../../components/DeleteConfirmationModal';
import { getClarification, getQADetail, Language, STORAGE_KEYS } from '../../utils/api';

// ============================================================================
// localStorage persistence helpers for Q&A history
// ============================================================================

/** Shape persisted to localStorage for each Q&A pair. */
interface PersistedQAItem {
  question: string;
  correctedTitle: string;
  shortAnswer: string;
  qaDetail?: {
    title: string;
    content: string[];
    visualLabel: string;
  } | null;
}

function qaStorageKey(courseMapId: string, nodeId: number): string {
  return `${STORAGE_KEYS.QA_HISTORY_PREFIX}${courseMapId}_${nodeId}`;
}

function loadQAHistory(courseMapId: string | undefined, nodeId: number | undefined): PersistedQAItem[] {
  if (!courseMapId || nodeId == null) return [];
  try {
    const raw = localStorage.getItem(qaStorageKey(courseMapId, nodeId));
    if (!raw) return [];
    return JSON.parse(raw) as PersistedQAItem[];
  } catch {
    return [];
  }
}

function saveQAHistory(courseMapId: string | undefined, nodeId: number | undefined, items: PersistedQAItem[]): void {
  if (!courseMapId || nodeId == null) return;
  try {
    localStorage.setItem(qaStorageKey(courseMapId, nodeId), JSON.stringify(items));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

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

// QA item type definition
export interface QAItem {
  id: number;
  question: string;
  answer: string;
  detail: {
    title: string;
    content: string[];
    visualLabel: string;
  } | null;
}

interface ClarificationSectionProps {
  pendingQuestions?: string[];
  initialQAList?: QAItem[];
  pageMarkdown?: string;
  language?: Language;
  courseMapId?: string;
  nodeId?: number;
  onNewQA?: (qa: QAItem) => void;
}

const ClarificationSection: React.FC<ClarificationSectionProps> = ({ 
  pendingQuestions = [], 
  initialQAList = [],
  pageMarkdown = '',
  language = 'en',
  courseMapId,
  nodeId,
  onNewQA
}) => {
  const [selectedQA, setSelectedQA] = useState<any>(null);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  // -------------------------------------------------------------------
  // Restore Q&A history from localStorage on mount / when node changes
  // -------------------------------------------------------------------
  useEffect(() => {
    const persisted = loadQAHistory(courseMapId, nodeId);
    if (persisted.length > 0) {
      const restored: QAItem[] = persisted.map((p, idx) => ({
        id: idx + 1,
        question: p.correctedTitle || p.question,
        answer: p.shortAnswer,
        detail: p.qaDetail ?? null,
      }));
      setQaList(restored);
    } else if (initialQAList.length > 0) {
      setQaList(initialQAList);
    } else {
      setQaList([]);
    }
  }, [courseMapId, nodeId]);

  // -------------------------------------------------------------------
  // Sync new items appended by the parent (e.g. KnowledgeCard)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (initialQAList.length === 0) return;
    setQaList(prev => {
      // Find items in initialQAList that are not yet in our list (by id)
      const existingIds = new Set(prev.map(q => q.id));
      const newItems = initialQAList.filter(q => !existingIds.has(q.id));
      if (newItems.length === 0) return prev;
      const merged = [...prev, ...newItems];
      persistToStorage(merged);
      return merged;
    });
  }, [initialQAList]);

  // -------------------------------------------------------------------
  // Persist Q&A list to localStorage whenever it changes
  // -------------------------------------------------------------------
  const persistToStorage = useCallback(
    (items: QAItem[]) => {
      const persisted: PersistedQAItem[] = items.map(q => ({
        question: q.question,
        correctedTitle: q.question,
        shortAnswer: q.answer,
        qaDetail: q.detail,
      }));
      saveQAHistory(courseMapId, nodeId, persisted);
    },
    [courseMapId, nodeId],
  );

  // Handle clicking "Details" button - fetch detail from API if not cached
  const handleShowDetail = async (item: QAItem) => {
    if (item.detail) {
      setSelectedQA(item.detail);
      return;
    }
    
    // Fetch detail from API
    setLoadingDetail(item.id);
    try {
      const response = await getQADetail({
        language,
        qa_title: item.question,
        qa_short_answer: item.answer,
        course_map_id: courseMapId,
        node_id: nodeId,
      });
      
      const detail = {
        title: response.title,
        content: response.body_markdown.split('\n\n').filter(p => p.trim()),
        visualLabel: response.image?.placeholder || 'Detailed Explanation'
      };
      
      // Update qaList with fetched detail and persist
      setQaList(prev => {
        const updated = prev.map(q => 
          q.id === item.id ? { ...q, detail } : q
        );
        persistToStorage(updated);
        return updated;
      });
      
      setSelectedQA(detail);
    } catch (error) {
      console.error('Failed to fetch QA detail:', error);
    } finally {
      setLoadingDetail(null);
    }
  };

  const handleDeleteConfirm = () => {
    if (deleteTargetId !== null) {
      setQaList(prev => {
        const updated = prev.filter(item => item.id !== deleteTargetId);
        persistToStorage(updated);
        return updated;
      });
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
                  onClick={() => handleShowDetail(item)}
                  disabled={loadingDetail === item.id}
                  className="px-3 h-7 flex items-center justify-center rounded-full bg-[#1A1B23] text-white active:scale-95 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <span className="text-[9px] font-black uppercase tracking-wider">
                    {loadingDetail === item.id ? 'Loading...' : 'Details'}
                  </span>
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
