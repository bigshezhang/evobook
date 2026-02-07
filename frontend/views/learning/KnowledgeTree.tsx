
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '../../components/Header';
import BottomNav from '../../components/BottomNav';
import { STORAGE_KEYS, DAGNode, CourseMapGenerateResponse, buildLearningPath } from '../../utils/api';

interface NodeProgress {
  nodeId: number;
  completed: boolean;
  current: boolean;
}

interface NodePosition {
  nodeId: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const KnowledgeTree: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cidFromUrl = searchParams.get('cid');

  // Load course data from localStorage
  const [courseData, setCourseData] = useState<CourseMapGenerateResponse | null>(null);
  const [nodeProgress, setNodeProgress] = useState<NodeProgress[]>([]);
  const [nodePositions, setNodePositions] = useState<NodePosition[]>([]);
  const nodeRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  useEffect(() => {
    const storedCourseMap = localStorage.getItem(STORAGE_KEYS.COURSE_MAP);
    if (storedCourseMap) {
      try {
        const parsed = JSON.parse(storedCourseMap) as CourseMapGenerateResponse;
        setCourseData(parsed);

        // Initialize node progress (first node is current, none completed)
        const storedProgress = localStorage.getItem('evo_node_progress');
        if (storedProgress) {
          setNodeProgress(JSON.parse(storedProgress));
        } else if (parsed.nodes.length > 0) {
          // Set first node as current
          const initialProgress = parsed.nodes.map((node, idx) => ({
            nodeId: node.id,
            completed: false,
            current: idx === 0,
          }));
          setNodeProgress(initialProgress);
          localStorage.setItem('evo_node_progress', JSON.stringify(initialProgress));
        }
      } catch (e) {
        console.error('Failed to parse course map:', e);
      }
    }
  }, []);

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
  const completedCount = nodeProgress.filter(p => p.completed).length;
  const totalCount = courseData?.nodes.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  // Update node positions when nodes are rendered
  useEffect(() => {
    const updatePositions = () => {
      if (nodeRefs.current.size === 0) {
        console.log('No node refs found');
        return;
      }

      const container = document.querySelector('.relative.px-6.flex-1.mt-6');
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

  const getNodeState = (nodeId: number): 'completed' | 'current' | 'locked' => {
    const progress = nodeProgress.find(p => p.nodeId === nodeId);
    if (progress?.completed) return 'completed';
    if (progress?.current) return 'current';

    // Check if prerequisites are completed
    const node = courseData?.nodes.find(n => n.id === nodeId);
    if (!node) return 'locked';

    const prereqsCompleted = node.pre_requisites.every(prereqId =>
      nodeProgress.find(p => p.nodeId === prereqId)?.completed
    );

    return prereqsCompleted ? 'current' : 'locked';
  };

  const cid = courseData?.course_map_id || cidFromUrl;

  const handleNodeClick = (node: DAGNode) => {
    const state = getNodeState(node.id);
    if (state === 'locked') return;

    // Store current node info for KnowledgeCard/Quiz to use (backward compat)
    localStorage.setItem(STORAGE_KEYS.CURRENT_NODE, JSON.stringify(node));

    if (node.type === 'quiz') {
      navigate(buildLearningPath('/quiz', { cid }));
    } else {
      navigate(buildLearningPath('/knowledge-card', { cid, nid: node.id }));
    }
  };

  // Render loading state if no course data
  if (!courseData) {
    return (
      <div className="flex flex-col h-screen bg-[#F8F9FD] items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-secondary border-t-transparent rounded-full"></div>
        <p className="mt-4 text-slate-500 font-medium">加载课程数据...</p>
        <button
          onClick={() => navigate('/assessment')}
          className="mt-6 px-6 py-3 bg-secondary text-white rounded-full font-bold"
        >
          创建新课程
        </button>
      </div>
    );
  }

  const getNodeIcon = (node: DAGNode, state: string) => {
    if (state === 'completed') return 'check_circle';
    if (state === 'locked') return 'lock';
    if (node.type === 'quiz') return 'quiz';
    if (node.type === 'boss') return 'workspace_premium';
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
    return {
      backgroundColor: '#EAEAEA',
      border: '1px solid #E5E7EB',
      boxShadow: '0 4px 0 #D1D5DB',
      color: '#9CA3AF',
    };
  };

  const getNodeClasses = (state: string) => {
    const base = 'transition-all duration-100 relative active:translate-y-1 active:shadow-none';
    if (state === 'completed') return base;
    if (state === 'current') return `${base} ring-8 ring-secondary/10`;
    return `${base} cursor-not-allowed`;
  };

  // Render connection lines between nodes
  const renderConnections = () => {
    if (!courseData || nodePositions.length === 0) return null;

    const paths: JSX.Element[] = [];

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
        const sourceCompleted = nodeProgress.find(p => p.nodeId === prereqId)?.completed;
        const targetCompleted = nodeProgress.find(p => p.nodeId === node.id)?.completed;
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
    <div className="flex flex-col h-screen bg-[#F8F9FD] relative pb-40 overflow-x-hidden">
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

      {/* Course Progress Banner */}
      <div className="px-6 mb-4 relative mt-4">
        <div className={`${bannerColor} rounded-[28px] p-5 text-white shadow-xl flex items-center justify-between relative overflow-hidden transition-colors duration-500`}>
          {/* Banner content area */}
          <div
            onClick={() => navigate(buildLearningPath('/course-detail', { cid }))}
            className="flex-1 text-center px-8 z-10 animate-in fade-in slide-in-from-right-4 duration-300 cursor-pointer"
          >
            <h2 className="text-xl font-extrabold tracking-tight">{courseName}</h2>
            <div className="flex items-center justify-center gap-3 mt-2">
              <div className="flex-1 max-w-[140px] bg-white/25 h-1.5 rounded-full overflow-hidden border border-white/10 shadow-inner">
                <div
                  className="bg-white h-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-700 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>
              <span className="text-[10px] font-black opacity-90 uppercase tracking-wider">{progressPercent}% DONE</span>
            </div>
          </div>

          <div className="absolute -right-6 -bottom-6 w-32 h-32 opacity-15 pointer-events-none rotate-12">
            <span className="material-symbols-outlined" style={{ fontSize: '100px' }}>psychology</span>
          </div>
          <div className="absolute -left-10 -top-10 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      </div>

      {/* Dynamic DAG Rendering */}
      <div className="relative px-6 flex-1 mt-6 overflow-y-auto no-scrollbar">
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
                      ref={(el) => {
                        if (el) nodeRefs.current.set(node.id, el);
                        else nodeRefs.current.delete(node.id);
                      }}
                      onClick={() => handleNodeClick(node)}
                      className={`${nodeClasses} ${widthClass} py-4 rounded-xl flex items-center justify-center gap-2`}
                      style={getNodeStyle(state)}
                    >
                      <span
                        className="material-symbols-outlined text-[18px] font-bold"
                        style={{ fontVariationSettings: state === 'current' ? "'FILL' 1" : undefined }}
                      >
                        {icon}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider truncate px-1">
                        {node.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav activeTab="learning" />
    </div>
  );
};

export default KnowledgeTree;


