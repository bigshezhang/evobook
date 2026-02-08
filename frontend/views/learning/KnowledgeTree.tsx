
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import KnowledgeTreeGuide from '../../components/Guide/KnowledgeTreeGuide';
import {
  getCourseDetail,
  getNodeProgress,
  updateNodeProgress,
  getUserCourses,
  getGenerationProgress,
  DAGNode,
  buildLearningPath,
  MapMeta,
  NodeProgressItem,
  CourseListItem,
  NodeGenerationStatus,
} from '../../utils/api';
import { NODE_STATUS } from '../../utils/constants';
import { ROUTES } from '../../utils/routes';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';

interface NodePosition {
  nodeId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CourseData {
  course_map_id: string;
  map_meta: MapMeta;
  nodes: DAGNode[];
}

const KnowledgeTree: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 设置页面主题色（状态栏颜色）
  useThemeColor(PAGE_THEME_COLORS.LIGHT_BLUE_GRAY);

  const cidFromUrl = searchParams.get('cid');

  // Load course data from backend
  const [courseData, setCourseData] = useState<CourseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeProgress, setNodeProgress] = useState<NodeProgressItem[]>([]);
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const nodeRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generation progress state
  const [nodeGenerationStatus, setNodeGenerationStatus] = useState<NodeGenerationStatus[]>([]);

  // Course navigation state
  const [allCourses, setAllCourses] = useState<CourseListItem[]>([]);
  const [currentCourseIndex, setCurrentCourseIndex] = useState<number>(0);

  // Guide state
  const [showGuide, setShowGuide] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  useEffect(() => {
    const loadCourseData = async () => {
      if (!cidFromUrl) {
        setError('No course ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        // Fire all independent API calls in parallel
        const [coursesData, courseDetailData, progressData, genProgressData] =
          await Promise.all([
            getUserCourses(),
            getCourseDetail(cidFromUrl),
            getNodeProgress(cidFromUrl),
            getGenerationProgress(cidFromUrl).catch((genErr) => {
              console.warn('Failed to load generation progress:', genErr);
              return null; // Don't fail the whole load if generation progress fails
            }),
          ]);

        // Process courses navigation data
        setAllCourses(coursesData.courses);
        const currentIndex = coursesData.courses.findIndex(
          (c) => c.course_map_id === cidFromUrl
        );
        if (currentIndex !== -1) {
          setCurrentCourseIndex(currentIndex);
        }

        // Process course detail
        setCourseData({
          course_map_id: courseDetailData.course_map_id,
          map_meta: courseDetailData.map_meta as MapMeta,
          nodes: courseDetailData.nodes as DAGNode[],
        });

        // Process node progress
        setNodeProgress(progressData.progress);

        // Process generation progress (may be null if fetch failed)
        if (genProgressData) {
          setNodeGenerationStatus(genProgressData.nodes_status);
        }

      } catch (e) {
        console.error('Failed to load course data:', e);
        setError(e instanceof Error ? e.message : 'Failed to load course');
      } finally {
        setIsLoading(false);
      }
    };

    loadCourseData();
  }, [cidFromUrl]);

  // Toast auto-hide
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast({ message: '', visible: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // Show toast helper
  const showToast = (message: string) => {
    setToast({ message, visible: true });
  };

  // Show guide for first-time users after data loads
  useEffect(() => {
    if (isLoading || error || !courseData) return;

    const forceShowGuide = searchParams.get('showGuide') === 'true';

    if (forceShowGuide) {
      // Forced via URL (e.g., from Profile "View Tutorial" button)
      const timer = setTimeout(() => setShowGuide(true), 500);
      return () => clearTimeout(timer);
    }

    // Only auto-show guide when nodeProgress is loaded
    if (nodeProgress.length === 0) return;

    // Let the KnowledgeTreeGuide component check profile internally
    const timer = setTimeout(() => setShowGuide(true), 500);
    return () => clearTimeout(timer);
  }, [isLoading, error, courseData, nodeProgress, searchParams]);

  // Poll generation progress for nodes that are still generating
  useEffect(() => {
    if (!cidFromUrl) return;

    const startPolling = () => {
      // Clear existing interval if any
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      // Check if any nodes are still generating or pending
      const hasGeneratingNodes = nodeGenerationStatus.some(
        (s) => s.status === 'generating' || s.status === 'pending'
      );

      if (!hasGeneratingNodes) {
        console.log('[KnowledgeTree] No generating nodes, polling not needed');
        return;
      }

      console.log('[KnowledgeTree] Starting polling for generation progress');

      // Poll every 2 seconds
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const progressData = await getGenerationProgress(cidFromUrl);

          // Update node generation status
          setNodeGenerationStatus(progressData.nodes_status);

          // If all completed, stop polling
          if (progressData.overall_status === 'completed') {
            console.log('[KnowledgeTree] All nodes completed, stopping polling');
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          }
        } catch (err) {
          console.error('Failed to fetch generation progress:', err);
        }
      }, 2000);
    };

    startPolling();

    return () => {
      console.log('[KnowledgeTree] Cleaning up polling interval');
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [cidFromUrl, nodeGenerationStatus]);

  // Group nodes by layer for DAG rendering
  const nodesByLayer = useMemo(() => {
    if (!courseData) return {};
    const grouped: Record<number, DAGNode[]> = {};
    courseData.nodes.forEach(node => {
      if (!grouped[node.layer]) grouped[node.layer] = [];
      grouped[node.layer].push(node);
    });
    return grouped;
  }, [courseData]);

  const layers = useMemo(() => Object.keys(nodesByLayer).map(Number).sort((a, b) => a - b), [nodesByLayer]);

  // Calculate progress
  const completedCount = nodeProgress.filter(p => p.status === NODE_STATUS.COMPLETED).length;
  const totalCount = courseData?.nodes.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Update node positions when nodes are rendered
  useEffect(() => {
    const updatePositions = () => {
      if (nodeRefs.current.size === 0) {
        console.log('No node refs found');
        return;
      }

      const container = document.querySelector('[data-dag-container]');
      if (!container) {
        console.log('Container not found');
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const positions: NodePosition[] = [];

      nodeRefs.current.forEach((element, nodeId) => {
        const rect = element.getBoundingClientRect();
        positions.push({
          nodeId,
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      });

      console.log(`Updated positions for ${positions.length} nodes:`, positions);
      setNodePositions(positions);
    };

    // Update with multiple delays to ensure all nodes are rendered
    const timer1 = setTimeout(updatePositions, 50);
    const timer2 = setTimeout(updatePositions, 200);
    const timer3 = setTimeout(updatePositions, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [courseData, layers, nodeProgress]);

  // Get course name from map_meta
  const courseName = courseData?.map_meta.course_name || 'Loading...';

  // Color for banner
  const bannerColor = "bg-secondary";

  const getNodeState = (nodeId: number): 'completed' | 'current' | 'locked' | 'generating' => {
    const progress = nodeProgress.find(p => p.node_id === nodeId);

    // Map backend status to frontend state
    if (progress?.status === NODE_STATUS.COMPLETED) return 'completed';
    if (progress?.status === NODE_STATUS.IN_PROGRESS || progress?.status === NODE_STATUS.UNLOCKED) return 'current';

    // Check if node is still being generated
    const genStatus = nodeGenerationStatus.find(s => s.node_id === nodeId);
    if (genStatus && (genStatus.status === 'generating' || genStatus.status === 'pending')) {
      return 'generating';
    }

    // If no progress record, check if locked or available based on prerequisites
    const node = courseData?.nodes.find(n => n.id === nodeId);
    if (!node) return 'locked';

    const prereqsCompleted = node.pre_requisites.every(prereqId =>
      nodeProgress.find(p => p.node_id === prereqId)?.status === NODE_STATUS.COMPLETED
    );

    return prereqsCompleted ? 'current' : 'locked';
  };

  const cid = courseData?.course_map_id || cidFromUrl;

  const handleNodeClick = (node: DAGNode) => {
    const state = getNodeState(node.id);
    if (state === 'locked') return;

    if (node.type === 'quiz') {
      navigate(buildLearningPath(ROUTES.QUIZ, { cid, nid: node.id }));
    } else {
      navigate(buildLearningPath(ROUTES.KNOWLEDGE_CARD, { cid, nid: node.id }));
    }
  };

  // Course navigation handlers
  const handlePreviousCourse = () => {
    if (currentCourseIndex > 0 && allCourses.length > 0) {
      const prevCourse = allCourses[currentCourseIndex - 1];
      navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: prevCourse.course_map_id }));
    }
  };

  const handleNextCourse = () => {
    if (currentCourseIndex < allCourses.length - 1 && allCourses.length > 0) {
      const nextCourse = allCourses[currentCourseIndex + 1];
      navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: nextCourse.course_map_id }));
    }
  };

  // Render loading skeleton (preserves Header + BottomNav so the page feels instant)
  if (isLoading) {
    return (
      <div className="flex flex-col h-screen bg-[#F8F9FD] relative">
        <Header
          title="Learning"
          showBack={false}
          rightAction={
            <div className="flex items-center gap-2 pr-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">EvoBook</span>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
          {/* Banner skeleton */}
          <div className="px-6 mb-4 mt-4">
            <div className="bg-slate-200 animate-pulse rounded-[28px] h-[100px]" />
          </div>
          {/* Node skeleton */}
          <div className="flex flex-col items-center gap-12 px-6 mt-6 py-6">
            <div className="w-48 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
            <div className="flex gap-4 justify-center">
              <div className="w-36 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
              <div className="w-36 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
            </div>
            <div className="w-48 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
            <div className="flex gap-4 justify-center">
              <div className="w-36 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
              <div className="w-36 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
            </div>
            <div className="w-48 h-[72px] bg-slate-200 animate-pulse rounded-xl" />
          </div>
        </div>
        <BottomNav activeTab="learning" />
      </div>
    );
  }

  // Render error state
  if (error || !courseData) {
    return (
      <div className="flex flex-col h-screen bg-[#F8F9FD] items-center justify-center px-6">
        <div className="w-20 h-20 mb-4 bg-rose-100 rounded-full flex items-center justify-center">
          <span className="material-symbols-rounded text-rose-500 text-4xl">error</span>
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Failed to load course</h3>
        <p className="text-slate-500 text-center mb-6">{error || 'Course not found'}</p>
        <button
          onClick={() => navigate(ROUTES.COURSES)}
          className="px-6 py-3 bg-secondary text-white rounded-full font-bold shadow-lg active:scale-95 transition-all"
        >
          Back to Courses
        </button>
      </div>
    );
  }

  const getNodeIcon = (node: DAGNode, state: string) => {
    if (state === 'completed') return 'check_circle';
    if (state === 'locked') return 'lock';
    if (state === 'generating') return 'sync'; // Icon for generating state
    if (node.type === 'quiz') return 'quiz';
    return 'play_circle';
  };

  const getNodeStyle = (state: string): React.CSSProperties => {
    if (state === 'completed') return {
      backgroundColor: '#FFB938',
      boxShadow: '0 6px 0 #D99A20',
      color: '#1A1A1A',
    };
    if (state === 'current') return {
      backgroundColor: '#1A1A1A',
      boxShadow: '0 6px 0 #000000',
      color: '#FFFFFF',
    };
    if (state === 'generating') return {
      backgroundColor: '#E0F2FE',
      border: '2px solid #0EA5E9',
      boxShadow: '0 4px 0 #BAE6FD',
      color: '#0284C7',
    };
    return {
      backgroundColor: '#EAEAEA',
      border: '1px solid #E5E7EB',
      boxShadow: '0 4px 0 #D1D5DB',
      color: '#9CA3AF',
    };
  };

  const getNodeClasses = (state: string) => {
    const base = 'transition-all duration-100 relative';
    if (state === 'completed') return `${base} active:translate-y-1 active:shadow-none`;
    if (state === 'current') return `${base} ring-8 ring-secondary/10 active:translate-y-1 active:shadow-none`;
    if (state === 'generating') return `${base} cursor-not-allowed`;
    return `${base} cursor-not-allowed`;
  };

  // Render connection lines between nodes
  const renderConnections = () => {
    if (!courseData || nodePositions.length === 0) return null;

    const paths: React.ReactElement[] = [];

    courseData.nodes.forEach((node) => {
      const targetPos = nodePositions.find(p => p.nodeId === node.id);
      if (!targetPos) {
        console.log(`Target position not found for node ${node.id}`);
        return;
      }

      node.pre_requisites.forEach((prereqId) => {
        const sourcePos = nodePositions.find(p => p.nodeId === prereqId);
        if (!sourcePos) {
          console.log(`Source position not found for prereq ${prereqId} -> node ${node.id}`);
          return;
        }

        // Check if both nodes are completed
        const sourceCompleted = nodeProgress.find(p => p.node_id === prereqId)?.status === 'completed';
        const targetCompleted = nodeProgress.find(p => p.node_id === node.id)?.status === 'completed';
        const isPathCompleted = sourceCompleted && targetCompleted;

        // Calculate path (from bottom of source to top of target)
        const x1 = sourcePos.x;
        const y1 = sourcePos.y + sourcePos.height / 2 + 10;  // Start slightly below node
        const x2 = targetPos.x;
        const y2 = targetPos.y - targetPos.height / 2 - 10;  // End slightly above node

        // Control point for smooth quadratic bezier curve
        const controlY = (y1 + y2) / 2;
        const path = `M ${x1},${y1} Q ${x1},${controlY} ${x2},${y2}`;

        const key = `${prereqId}-${node.id}`;

        console.log(`Drawing line: ${prereqId} -> ${node.id}, completed: ${isPathCompleted}, path: ${path}`);

        if (isPathCompleted) {
          // Completed path: thick solid gold line
          paths.push(
            <path
              key={key}
              d={path}
              stroke="#FFB938"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
            />
          );
        } else {
          // Incomplete path: simple gray dashed line
          paths.push(
            <path
              key={key}
              d={path}
              stroke="#D1D5DB"
              strokeWidth="4"
              fill="none"
              strokeDasharray="8,6"
              strokeLinecap="round"
            />
          );
        }
      });
    });

    console.log(`Total paths rendered: ${paths.length}`);
    return paths;
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] relative">
      <Header
        title="Learning"
        showBack={false}
        rightAction={
          <div className="flex items-center gap-2 pr-2">
            <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-secondary">EvoBook</span>
          </div>
        }
      />

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-40">
        {/* Course Progress Banner with Navigation */}
        <div className="px-6 mb-4 relative mt-4">
          <div data-course-banner className={`${bannerColor} rounded-[28px] py-9 px-4 sm:py-11 sm:px-6 text-white shadow-xl relative overflow-hidden transition-colors duration-500`}>
            {/* Content Container */}
            <div className="relative z-10 flex items-center gap-2 sm:gap-4">
              {/* Left Arrow - Always Reserve Space */}
              <div className="w-9 sm:w-11 h-9 sm:h-11 flex-shrink-0">
                {allCourses.length > 1 && (
                  <button
                    onClick={handlePreviousCourse}
                    disabled={currentCourseIndex === 0}
                    className={`w-full h-full rounded-full flex items-center justify-center transition-all ${
                      currentCourseIndex === 0
                        ? 'opacity-30 cursor-not-allowed'
                        : 'bg-white/20 hover:bg-white/30 active:scale-95 backdrop-blur-sm'
                    }`}
                  >
                    <span className="material-symbols-rounded text-white text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>arrow_back_ios_new</span>
                  </button>
                )}
              </div>

              {/* Course Info - Centered */}
              <div
                onClick={() => navigate(buildLearningPath(ROUTES.COURSE_DETAIL, { cid }))}
                className="flex-1 cursor-pointer min-w-0"
              >
                <h2 className="text-[17px] sm:text-[20px] font-extrabold tracking-tight text-center mb-3 sm:mb-4 leading-tight px-1">{courseName}</h2>

                {/* Progress Bar - Centered */}
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <div className="w-[140px] sm:w-[180px] bg-white/25 h-2 rounded-full overflow-hidden border border-white/10 shadow-inner flex-shrink-0">
                    <div
                      className="bg-white h-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700 ease-out rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-extrabold opacity-90 uppercase tracking-[0.1em] sm:tracking-[0.15em] min-w-[50px] sm:min-w-[65px] text-center">{progressPercent}% DONE</span>
                </div>
              </div>

              {/* Right Arrow - Always Reserve Space */}
              <div className="w-9 sm:w-11 h-9 sm:h-11 flex-shrink-0">
                {allCourses.length > 1 && (
                  <button
                    onClick={handleNextCourse}
                    disabled={currentCourseIndex === allCourses.length - 1}
                    className={`w-full h-full rounded-full flex items-center justify-center transition-all ${
                      currentCourseIndex === allCourses.length - 1
                        ? 'opacity-30 cursor-not-allowed'
                        : 'bg-white/20 hover:bg-white/30 active:scale-95 backdrop-blur-sm'
                    }`}
                  >
                    <span className="material-symbols-rounded text-white text-xl sm:text-2xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>arrow_forward_ios</span>
                  </button>
                )}
              </div>
            </div>

            {/* Background Decorations */}
            <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-10 pointer-events-none rotate-12">
              <span className="material-symbols-outlined" style={{ fontSize: '100px' }}>psychology</span>
            </div>
            <div className="absolute -left-10 -top-10 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
          </div>
        </div>

        {/* Dynamic DAG Rendering */}
        <div className="relative px-6 mt-6">
          <div className="relative" data-dag-container>
            {/* SVG for connection lines */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-0"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* No gradients or filters needed */}
              </defs>
              {renderConnections()}
            </svg>

            <div className="flex flex-col items-center gap-12 relative py-6 z-10">
            {layers.map((layer) => {
              const nodesInLayer = nodesByLayer[layer];
              const isMultiple = nodesInLayer.length > 1;

              return (
                <div key={layer} className={`flex ${isMultiple ? 'gap-4' : ''} justify-center`}>
                  {nodesInLayer.map((node) => {
                    const state = getNodeState(node.id);
                    const icon = getNodeIcon(node, state);
                    const nodeClasses = getNodeClasses(state);
                    const widthClass = isMultiple ? 'w-36' : 'w-48';

                    return (
                      <button
                        key={node.id}
                        data-node-id={node.id}
                        ref={(el) => {
                          if (el) nodeRefs.current.set(node.id, el);
                          else nodeRefs.current.delete(node.id);
                        }}
                        onClick={() => handleNodeClick(node)}
                        disabled={state === 'locked' || state === 'generating'}
                        className={`${nodeClasses} ${widthClass} px-4 py-4 rounded-xl flex flex-col items-center justify-center gap-2`}
                        style={getNodeStyle(state)}
                      >
                        {state === 'generating' ? (
                          <>
                            <div className="relative">
                              <span
                                className="material-symbols-outlined text-[20px] font-bold animate-spin"
                                style={{ fontVariationSettings: "'FILL' 0" }}
                              >
                                {icon}
                              </span>
                            </div>
                            <span className="text-[11px] font-black uppercase tracking-wide text-center leading-tight line-clamp-2">
                              {node.title}
                            </span>
                            <span className="text-[9px] font-semibold opacity-70">Generating...</span>
                          </>
                        ) : (
                          <>
                            <span
                              className="material-symbols-outlined text-[20px] font-bold"
                              style={{ fontVariationSettings: state === 'current' ? "'FILL' 1" : undefined }}
                            >
                              {icon}
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-wide text-center leading-tight line-clamp-2">
                              {node.title}
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            </div>
          </div>
        </div>
      </div>

      <BottomNav activeTab="learning" />

      {/* Knowledge Tree Guide */}
      {showGuide && (
        <KnowledgeTreeGuide
          onComplete={(shouldShowToast = true) => {
            setShowGuide(false);
            if (shouldShowToast) {
              showToast('You can restart the tutorial anytime from Profile page');
            }
            // Remove showGuide parameter from URL but keep cid
            if (searchParams.has('showGuide')) {
              const cid = searchParams.get('cid');
              navigate(cid ? `?cid=${cid}` : '', { replace: true });
            }
          }}
          onSkip={() => {
            setShowGuide(false);
            showToast('You can restart the tutorial anytime from Profile page');
            // Remove showGuide parameter from URL but keep cid
            if (searchParams.has('showGuide')) {
              const cid = searchParams.get('cid');
              navigate(cid ? `?cid=${cid}` : '', { replace: true });
            }
          }}
          hasMultipleCourses={allCourses.length > 1}
          firstAvailableNodeId={
            courseData?.nodes.find((node) => getNodeState(node.id) === 'current')?.id
          }
          forceShow={searchParams.get('showGuide') === 'true'}
        />
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[10000] animate-in slide-in-from-bottom-4 fade-in duration-300 px-6 w-full max-w-md">
          <div className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700">
            <span
              className="material-symbols-outlined text-xl text-blue-400 flex-shrink-0"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              info
            </span>
            <span className="text-sm font-bold leading-relaxed">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeTree;


