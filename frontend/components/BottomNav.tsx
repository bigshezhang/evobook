
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface BottomNavProps {
  activeTab?: 'courses' | 'learning' | 'game';
}

const BottomNav: React.FC<BottomNavProps> = ({ activeTab }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/profile') return 'courses';
    if (path === '/knowledge-tree' || path === '/knowledge-card' || path === '/course-detail') return 'learning';
    if (path.startsWith('/game')) return 'game';
    return activeTab || 'courses';
  };

  const current = getActiveTab();

  return (
    <nav className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center justify-between w-[240px] h-[64px] bg-black rounded-full px-2 shadow-2xl z-50">
      {/* Course Management */}
      <button 
        onClick={() => navigate('/dashboard')}
        className={`w-14 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${current === 'courses' ? 'bg-white text-black' : 'text-white opacity-40'}`}
      >
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${current === 'courses' ? 1 : 0}` }}>library_books</span>
      </button>
      
      {/* Learning Management */}
      <button 
        onClick={() => navigate('/knowledge-tree')}
        className={`w-14 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${current === 'learning' ? 'bg-white text-black' : 'text-white opacity-40'}`}
      >
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${current === 'learning' ? 1 : 0}` }}>school</span>
      </button>
      
      {/* Game */}
      <button 
        onClick={() => navigate('/game')}
        className={`w-14 h-12 flex items-center justify-center rounded-full transition-all duration-300 ${current === 'game' ? 'bg-white text-black' : 'text-white opacity-40'}`}
      >
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: `'FILL' ${current === 'game' ? 1 : 0}` }}>sports_esports</span>
      </button>
    </nav>
  );
};

export default BottomNav;
