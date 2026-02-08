
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { buildLearningPath, getActiveCourse } from '../utils/api';
import { ROUTES, ROUTE_GROUPS } from '../utils/routes';

interface BottomNavProps {
  activeTab?: 'courses' | 'learning' | 'game';
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if ((ROUTE_GROUPS.COURSES_TAB as readonly string[]).includes(path)) return 'courses';
    if ((ROUTE_GROUPS.LEARNING_TAB as readonly string[]).includes(path)) return 'learning';
    if (path.startsWith(ROUTES.GAME)) return 'game';
    return activeTab || 'courses';
  };

  const handleLearningClick = async () => {
    try {
      const { course_map_id } = await getActiveCourse();

      if (course_map_id) {
        // 有活跃课程，跳转到知识树
        navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: course_map_id }));
      } else {
        // 没有课程，跳转到课程列表
        navigate(ROUTES.COURSES);
      }
    } catch (error) {
      console.error('Failed to get active course:', error);
      // 出错时跳转到课程列表
      navigate(ROUTES.COURSES);
    }
  };

  const current = getActiveTab();

  return (
    <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center justify-between w-[260px] h-[68px] bg-[#1A1A1A] rounded-full px-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)] z-50 border border-white/10">
      {/* Course Management */}
      <button
        onClick={() => navigate(ROUTES.COURSES)}
        className={`flex-1 h-14 flex items-center justify-center rounded-full transition-all duration-300 mx-1 ${current === 'courses' ? 'bg-white text-primary' : 'text-white/40 hover:text-white'}`}
      >
        <span className="material-symbols-rounded text-[26px]" style={{ fontVariationSettings: `'FILL' ${current === 'courses' ? 1 : 0}` }}>library_books</span>
      </button>

      {/* Learning Management */}
      <button
        onClick={handleLearningClick}
        className={`flex-1 h-14 flex items-center justify-center rounded-full transition-all duration-300 mx-1 ${current === 'learning' ? 'bg-white text-primary' : 'text-white/40 hover:text-white'}`}
      >
        <span className="material-symbols-rounded text-[26px]" style={{ fontVariationSettings: `'FILL' ${current === 'learning' ? 1 : 0}` }}>school</span>
      </button>

      {/* Game */}
      <button
        onClick={() => navigate(ROUTES.GAME)}
        className={`flex-1 h-14 flex items-center justify-center rounded-full transition-all duration-300 mx-1 ${current === 'game' ? 'bg-white text-primary' : 'text-white/40 hover:text-white'}`}
      >
        <span className="material-symbols-rounded text-[26px]" style={{ fontVariationSettings: `'FILL' ${current === 'game' ? 1 : 0}` }}>sports_esports</span>
      </button>
    </nav>
  );
};

export default BottomNav;
