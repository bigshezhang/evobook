
import React from 'react';
import { Outlet } from 'react-router-dom';
import GameHeader from '../../components/GameHeader';
import BottomNav from '../../components/BottomNav';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';

/**
 * 游戏页面布局组件
 * 将 GameHeader 提升到这一层，避免在 Travel 和 Outfit 切换时重新挂载
 */
const GameLayout: React.FC = () => {
  // 设置页面主题色（状态栏颜色）
  useThemeColor(PAGE_THEME_COLORS.LIGHT_GRAY);

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] overflow-hidden select-none font-sans">
      <GameHeader />
      <Outlet />
      <BottomNav activeTab="game" />
    </div>
  );
};

export default GameLayout;
