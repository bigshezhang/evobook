
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ClarificationSection, { QAItem } from './ClarificationSection';
import { 
  STORAGE_KEYS, 
  CourseMapGenerateResponse, 
  FinishData,
  LearnedTopic,
  getClarification,
  getKnowledgeCard,
  KnowledgeCardRequest,
  Language,
  buildLearningPath,
} from '../../utils/api';

// Page break delimiter used in markdown from API
const PAGE_BREAK_DELIMITER = '<EVOBK_PAGE_BREAK />';

// ============================================================================
// DSL Types and Interfaces
// ============================================================================

interface KeyItem {
  title: string;
  content: string;
}

interface KeyElementsData {
  title: string;
  items: KeyItem[];
}

interface ExpertTipData {
  title: string;
  content: string;
}

type ContentSegment = 
  | { type: 'markdown'; content: string }
  | { type: 'key_elements'; data: KeyElementsData }
  | { type: 'expert_tip'; data: ExpertTipData };

// ============================================================================
// DSL Parser Functions
// ============================================================================

/**
 * Parse DSL tags from markdown content and return structured segments
 */
function parseDSLContent(markdown: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  
  // Combined regex to match all DSL tags
  const dslPattern = /(<EVOBK_KEY_ELEMENTS\s+title="([^"]*)">([\s\S]*?)<\/EVOBK_KEY_ELEMENTS>)|(<EVOBK_EXPERT_TIP\s+title="([^"]*)">([\s\S]*?)<\/EVOBK_EXPERT_TIP>)/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = dslPattern.exec(markdown)) !== null) {
    // Add any markdown content before this DSL block
    if (match.index > lastIndex) {
      const mdContent = markdown.slice(lastIndex, match.index).trim();
      if (mdContent) {
        segments.push({ type: 'markdown', content: mdContent });
      }
    }
    
    if (match[1]) {
      // KEY_ELEMENTS block
      const title = match[2];
      const innerContent = match[3];
      const items = parseKeyItems(innerContent);
      segments.push({
        type: 'key_elements',
        data: { title, items }
      });
    } else if (match[4]) {
      // EXPERT_TIP block
      const title = match[5];
      const content = match[6].trim();
      segments.push({
        type: 'expert_tip',
        data: { title, content }
      });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add any remaining markdown content after the last DSL block
  if (lastIndex < markdown.length) {
    const mdContent = markdown.slice(lastIndex).trim();
    if (mdContent) {
      segments.push({ type: 'markdown', content: mdContent });
    }
  }
  
  // If no DSL tags found, return the entire content as markdown
  if (segments.length === 0 && markdown.trim()) {
    segments.push({ type: 'markdown', content: markdown });
  }
  
  return segments;
}

/**
 * Parse EVOBK_KEY items from within a KEY_ELEMENTS block
 */
function parseKeyItems(content: string): KeyItem[] {
  const items: KeyItem[] = [];
  const keyPattern = /<EVOBK_KEY\s+title="([^"]*)">([\s\S]*?)<\/EVOBK_KEY>/g;
  
  let match;
  while ((match = keyPattern.exec(content)) !== null) {
    items.push({
      title: match[1],
      content: match[2].trim()
    });
  }
  
  return items;
}

// ============================================================================
// DSL Components
// ============================================================================

/**
 * Key Elements Block Component
 */
const KeyElementsBlock: React.FC<{ data: KeyElementsData }> = ({ data }) => {
  return (
    <div className="bg-black/[0.02] dark:bg-white/[0.02] rounded-2xl p-5 border border-black/[0.03] dark:border-white/[0.03] my-6">
      <h3 className="text-[14px] font-bold text-primary dark:text-white mb-3 flex items-center gap-2">
        <span className="w-1 h-4 bg-accent-purple rounded-full"></span>
        {data.title}
      </h3>
      <ul className="space-y-3 m-0 p-0 list-none">
        {data.items.map((item, index) => (
          <li key={index} className="flex gap-3 text-[14px] leading-snug m-0">
            <span className="text-accent-purple font-bold shrink-0">•</span>
            <span>
              <strong className="text-primary dark:text-white">{item.title}:</strong>{' '}
              <span className="text-primary/80 dark:text-white/80">{item.content}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

/**
 * Expert Tip Block Component
 */
const ExpertTipBlock: React.FC<{ data: ExpertTipData }> = ({ data }) => {
  return (
    <div className="relative bg-accent-blue/5 border border-accent-blue/20 rounded-2xl p-5 overflow-hidden my-6">
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-accent-blue/10 blur-xl"></div>
      <div className="flex items-center gap-2 mb-2 text-accent-blue">
        <span className="material-symbols-rounded text-[18px]">info</span>
        <span className="text-[12px] font-bold uppercase tracking-wider">{data.title}</span>
      </div>
      <p className="text-[14px] font-medium leading-normal italic m-0 text-primary/80 dark:text-white/80">
        {data.content}
      </p>
    </div>
  );
};

/**
 * Markdown components configuration for ReactMarkdown
 */
const markdownComponents = {
  // Headings
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-[22px] font-extrabold text-primary dark:text-white leading-tight mb-4 mt-6">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-[18px] font-bold text-primary dark:text-white leading-tight mb-3 mt-5">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-[16px] font-bold text-primary dark:text-white leading-tight mb-2 mt-4 flex items-center gap-2">
      <span className="w-1 h-4 bg-accent-purple rounded-full"></span>
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-[14px] font-bold text-primary dark:text-white leading-tight mb-2 mt-3">
      {children}
    </h4>
  ),
  // Paragraphs
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-[15px] leading-relaxed mb-4">{children}</p>
  ),
  // Lists
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="space-y-2 my-4 pl-0 list-none">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="space-y-2 my-4 pl-4 list-decimal">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="flex gap-3 text-[14px] leading-snug">
      <span className="text-accent-purple font-bold shrink-0">•</span>
      <span>{children}</span>
    </li>
  ),
  // Strong/Bold
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="text-primary dark:text-white font-semibold">{children}</strong>
  ),
  // Emphasis/Italic
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  // Code
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono text-accent-purple">
          {children}
        </code>
      );
    }
    return (
      <code className="block bg-black/[0.03] dark:bg-white/[0.05] p-4 rounded-xl text-[13px] font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-black/[0.03] dark:bg-white/[0.05] p-4 rounded-xl text-[13px] font-mono overflow-x-auto my-4">
      {children}
    </pre>
  ),
  // Tables
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-hidden rounded-2xl border border-black/[0.05] dark:border-white/[0.05] my-6">
      <table className="w-full text-[13px] text-left border-collapse m-0">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="bg-black/[0.03] dark:bg-white/[0.05]">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => (
    <tbody className="divide-y divide-black/[0.03] dark:divide-white/[0.05]">{children}</tbody>
  ),
  tr: ({ children }: { children?: React.ReactNode }) => <tr>{children}</tr>,
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-4 py-2.5 font-bold text-primary/60 dark:text-white/60">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="px-4 py-2.5 text-primary/80 dark:text-white/80">{children}</td>
  ),
  // Blockquotes - styled as tip boxes
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <div className="relative bg-accent-blue/5 border border-accent-blue/20 rounded-2xl p-5 overflow-hidden my-4">
      <div className="absolute -right-4 -top-4 w-16 h-16 bg-accent-blue/10 blur-xl"></div>
      <div className="flex items-center gap-2 mb-2 text-accent-blue">
        <span className="material-symbols-rounded text-[18px]">info</span>
        <span className="text-[12px] font-bold uppercase tracking-wider">Tip</span>
      </div>
      <div className="text-[14px] font-medium leading-normal [&>p]:m-0 [&>p]:italic">
        {children}
      </div>
    </div>
  ),
  // Horizontal rule
  hr: () => (
    <hr className="border-0 h-px bg-black/10 dark:bg-white/10 my-6" />
  ),
  // Links
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a 
      href={href} 
      className="text-accent-blue hover:underline"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

/**
 * Renders a single content segment (markdown or DSL block)
 */
const ContentSegmentRenderer: React.FC<{ segment: ContentSegment; index: number }> = ({ segment, index }) => {
  switch (segment.type) {
    case 'markdown':
      return (
        <ReactMarkdown
          key={`md-${index}`}
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {segment.content}
        </ReactMarkdown>
      );
    case 'key_elements':
      return <KeyElementsBlock key={`ke-${index}`} data={segment.data} />;
    case 'expert_tip':
      return <ExpertTipBlock key={`et-${index}`} data={segment.data} />;
    default:
      return null;
  }
};

/**
 * Renders parsed content with DSL blocks
 */
const ParsedContentRenderer: React.FC<{ content: string }> = ({ content }) => {
  const segments = useMemo(() => parseDSLContent(content), [content]);
  
  return (
    <>
      {segments.map((segment, index) => (
        <ContentSegmentRenderer key={index} segment={segment} index={index} />
      ))}
    </>
  );
};

const KnowledgeCard: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cidFromUrl = searchParams.get('cid');
  const nidFromUrl = searchParams.get('nid');

  const [showComplete, setShowComplete] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [dynamicQuestions, setDynamicQuestions] = useState<string[]>([]);
  const [qaList, setQaList] = useState<QAItem[]>([]);
  
  // Course map ID for server-side caching
  const [courseMapId, setCourseMapId] = useState<string | undefined>(cidFromUrl || undefined);

  // Course metadata loaded from localStorage
  const [courseName, setCourseName] = useState('Loading...');
  const [courseContext, setCourseContext] = useState('');
  const [moduleInfo, setModuleInfo] = useState('Module');
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeDescription, setNodeDescription] = useState('');
  const [currentNodeId, setCurrentNodeId] = useState<number>(0);
  const [totalNodes, setTotalNodes] = useState<number>(20);
  const [completedNodes, setCompletedNodes] = useState<number>(12);
  
  // Internal card paging state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPagesInCard, setTotalPagesInCard] = useState(1);
  
  // Knowledge card content from API
  const [markdownContent, setMarkdownContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Language for API calls
  const language: Language = 'en';
  
  // Split markdown content into pages
  const pages = useMemo(() => {
    if (!markdownContent) return [];
    return markdownContent.split(PAGE_BREAK_DELIMITER).map(page => page.trim()).filter(Boolean);
  }, [markdownContent]);
  
  // Get current page content
  const currentPageContent = useMemo(() => {
    return pages[currentPage - 1] || '';
  }, [pages, currentPage]);
  
  // Update total pages when pages array changes
  useEffect(() => {
    if (pages.length > 0) {
      setTotalPagesInCard(pages.length);
    }
  }, [pages]);

  // Load course data from localStorage and fetch knowledge card from API
  useEffect(() => {
    // CRITICAL: Reset content state immediately to prevent flash of old content
    setMarkdownContent('');
    setCurrentPage(1);
    setError(null);
    setIsLoading(true);
    setQaList([]);
    setDynamicQuestions([]);
    
    const courseMapStr = localStorage.getItem(STORAGE_KEYS.COURSE_MAP);
    const currentNodeStr = localStorage.getItem(STORAGE_KEYS.CURRENT_NODE);
    const onboardingDataStr = localStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA);
    
    let courseMapData: CourseMapGenerateResponse | null = null;
    let onboardingData: FinishData | null = null;
    let currentNode: CourseMapGenerateResponse['nodes'][0] | null = null;
    
    if (courseMapStr) {
      courseMapData = JSON.parse(courseMapStr);
      setCourseName(courseMapData!.map_meta.course_name);
      setCourseContext(courseMapData!.map_meta.strategy_rationale);
      setTotalNodes(courseMapData!.nodes.length);
      setCourseMapId(courseMapData!.course_map_id);
    }
    
    // Resolve current node: prefer URL nid param, fall back to localStorage
    const targetNodeId = nidFromUrl ? Number(nidFromUrl) : null;
    if (targetNodeId != null && courseMapData) {
      // Deep-link: find node by ID from the course map
      currentNode = courseMapData.nodes.find(n => n.id === targetNodeId) || null;
    }
    // Fall back to localStorage CURRENT_NODE (backward compat / normal navigation)
    if (!currentNode && currentNodeStr) {
      try {
        currentNode = JSON.parse(currentNodeStr);
      } catch (e) {
        console.error('Failed to parse current node:', e);
      }
    }
    if (currentNode) {
      setCurrentNodeId(currentNode.id);
      setNodeTitle(currentNode.title);
      setNodeDescription(currentNode.description);
      setModuleInfo(`Module ${String(currentNode.layer).padStart(2, '0')}`);
      if (courseMapData) {
        const completedCount = courseMapData.nodes.filter(n => n.layer < (currentNode?.layer || 1)).length;
        setCompletedNodes(completedCount);
      }
      // Sync to localStorage so other components can use it
      localStorage.setItem(STORAGE_KEYS.CURRENT_NODE, JSON.stringify(currentNode));
    }
    
    if (onboardingDataStr) {
      onboardingData = JSON.parse(onboardingDataStr);
    }
    
    // Fetch knowledge card from API (with sessionStorage caching)
    const fetchKnowledgeCard = async () => {
      if (!courseMapData || !currentNode || !onboardingData) {
        setError('Missing course or node data. Please start from the course selection.');
        setIsLoading(false);
        return;
      }

      // Check sessionStorage cache first to avoid redundant LLM calls
      const cacheKey = `evo_kc_${courseMapData.course_map_id}_${currentNode.id}`;
      try {
        const cachedStr = sessionStorage.getItem(cacheKey);
        if (cachedStr) {
          const cached = JSON.parse(cachedStr) as { markdown: string; totalPagesInCard: number };
          setMarkdownContent(cached.markdown);
          setTotalPagesInCard(cached.totalPagesInCard || 1);
          setCurrentPage(1);
          setIsLoading(false);
          return;
        }
      } catch {
        // Corrupted cache — ignore and re-fetch
        sessionStorage.removeItem(cacheKey);
      }
      
      try {
        setIsLoading(true);
        setError(null);
        
        const request: KnowledgeCardRequest = {
          course_map_id: courseMapData.course_map_id,
          course: {
            course_name: courseMapData.map_meta.course_name,
            course_context: courseMapData.map_meta.strategy_rationale,
            topic: onboardingData.topic,
            level: onboardingData.level,
            mode: courseMapData.map_meta.mode,
          },
          node: {
            id: currentNode.id,
            title: currentNode.title,
            description: currentNode.description,
            type: currentNode.type as 'learn' | 'boss',
            estimated_minutes: currentNode.estimated_minutes,
          },
        };
        
        const response = await getKnowledgeCard(request);
        
        setMarkdownContent(response.markdown);
        setTotalPagesInCard(response.totalPagesInCard || 1);
        setCurrentPage(1);

        // Save to sessionStorage for subsequent visits
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            markdown: response.markdown,
            totalPagesInCard: response.totalPagesInCard || 1,
          }));
        } catch {
          // sessionStorage quota exceeded — non-critical, just skip
        }
      } catch (err) {
        console.error('Failed to fetch knowledge card:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchKnowledgeCard();
  }, []);

  // Animation trigger for page changes only (not initial mount)
  const [animate, setAnimate] = useState(false);
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    // Skip animation on first render to prevent 300ms blank screen
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 300);
    return () => clearTimeout(timer);
  }, [currentPage]);

  /**
   * Mark the current node as completed, unlock successor nodes whose
   * prerequisites are all done, and persist the learned topic so that
   * QuizView can pick it up later.
   */
  const handleNodeCompletion = () => {
    // --- 1. Update node progress ---
    const progressStr = localStorage.getItem('evo_node_progress');
    const courseMapStr = localStorage.getItem(STORAGE_KEYS.COURSE_MAP);
    if (!progressStr || !courseMapStr) return;

    const progress: { nodeId: number; completed: boolean; current: boolean }[] =
      JSON.parse(progressStr);
    const courseMap: CourseMapGenerateResponse = JSON.parse(courseMapStr);

    // Mark the current node as completed and no longer current
    const updated = progress.map((p) =>
      p.nodeId === currentNodeId
        ? { ...p, completed: true, current: false }
        : p,
    );

    // Determine which successor nodes should be unlocked
    courseMap.nodes.forEach((node) => {
      if (!node.pre_requisites.includes(currentNodeId)) return;

      // Check whether *all* prerequisites of this successor are now completed
      const allPrereqsDone = node.pre_requisites.every((prereqId) => {
        const entry = updated.find((p) => p.nodeId === prereqId);
        return entry?.completed === true;
      });

      if (allPrereqsDone) {
        const idx = updated.findIndex((p) => p.nodeId === node.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], current: true };
        }
      }
    });

    localStorage.setItem('evo_node_progress', JSON.stringify(updated));

    // --- 2. Persist learned topic for Quiz ---
    const topicsStr = localStorage.getItem(STORAGE_KEYS.LEARNED_TOPICS);
    const learnedTopics: LearnedTopic[] = topicsStr ? JSON.parse(topicsStr) : [];

    learnedTopics.push({
      topic_name: nodeTitle,
      pages_markdown: markdownContent,
    });

    localStorage.setItem(STORAGE_KEYS.LEARNED_TOPICS, JSON.stringify(learnedTopics));
  };

  const handleNext = () => {
    if (currentPage < totalPagesInCard) {
      setCurrentPage(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      handleNodeCompletion();
      setShowComplete(true);
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate(buildLearningPath('/knowledge-tree', { cid: courseMapId }));
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
      // Use current page content as context
      const pageMarkdown = currentPageContent || `${nodeTitle}: Learning content about ${courseName}`;
      
      const response = await getClarification({
        language,
        user_question_raw: question,
        page_markdown: pageMarkdown,
        course_map_id: courseMapId,
        node_id: currentNodeId || undefined,
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
            onClick={() => navigate(buildLearningPath('/knowledge-tree', { cid: courseMapId }))}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 active:scale-90 transition-transform"
          >
            <span className="material-symbols-rounded text-primary dark:text-white text-[20px]">arrow_back</span>
          </button>
          <div className="h-4 w-px bg-black/10 dark:bg-white/10"></div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-primary/40 dark:text-white/40 uppercase tracking-widest">Progress</span>
            <div className="flex gap-1">
              {/* Dynamic progress dots based on current page */}
              {totalPagesInCard <= 5 ? (
                // Show individual dots for 5 or fewer pages
                [...Array(totalPagesInCard)].map((_, i) => (
                  <div 
                    key={i}
                    className={`${i < currentPage ? 'w-4' : 'w-1.5'} h-1.5 rounded-full transition-all duration-300 ${i < currentPage ? 'bg-primary dark:bg-white' : 'bg-primary/10 dark:bg-white/10'}`}
                  ></div>
                ))
              ) : (
                // Show progress bar for more than 5 pages
                <>
                  <div className="w-16 h-1.5 rounded-full bg-primary/10 dark:bg-white/10 overflow-hidden">
                    <div 
                      className="h-full bg-primary dark:bg-white rounded-full transition-all duration-300"
                      style={{ width: `${(currentPage / totalPagesInCard) * 100}%` }}
                    ></div>
                  </div>
                </>
              )}
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

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded-lg w-full"></div>
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded-lg w-5/6"></div>
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded-lg w-4/6"></div>
            <div className="h-32 bg-black/5 dark:bg-white/5 rounded-2xl w-full mt-6"></div>
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded-lg w-full mt-6"></div>
            <div className="h-4 bg-black/5 dark:bg-white/5 rounded-lg w-3/4"></div>
            <div className="h-24 bg-black/5 dark:bg-white/5 rounded-2xl w-full mt-6"></div>
          </div>
        )}
        
        {/* Error State */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center mb-4">
              <span className="material-symbols-rounded text-red-500 text-3xl">error</span>
            </div>
            <h3 className="text-lg font-bold text-primary dark:text-white mb-2">Failed to Load Content</h3>
            <p className="text-sm text-primary/60 dark:text-white/60 mb-4 max-w-[280px]">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 bg-primary dark:bg-white text-white dark:text-black rounded-full font-semibold text-sm active:scale-95 transition-transform"
            >
              Try Again
            </button>
          </div>
        )}
        
        {/* Markdown Content with DSL Parsing */}
        {!isLoading && !error && (
          <div className="prose prose-sm max-w-none text-primary/80 dark:text-white/80">
            <ParsedContentRenderer content={currentPageContent} />
            
            {/* Clarification Section */}
            <div id="clarification-section" className="mt-8">
              <ClarificationSection 
                pendingQuestions={dynamicQuestions}
                initialQAList={qaList}
                pageMarkdown={currentPageContent || `${nodeTitle}: Learning content about ${courseName}`}
                language={language}
                courseMapId={courseMapId}
                nodeId={currentNodeId || undefined}
              />
            </div>
          </div>
        )}
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
            <button 
              onClick={() => navigate(buildLearningPath('/knowledge-tree', { cid: courseMapId }))}
              className="w-full py-3 mt-3 bg-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 rounded-full font-semibold text-[14px] active:scale-95 transition-all"
            >
              Back to learn
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeCard;
