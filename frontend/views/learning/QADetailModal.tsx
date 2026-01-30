
import React from 'react';
import { createPortal } from 'react-dom';

interface QADetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: {
    title: string;
    content: string[];
    visualLabel: string;
  } | null;
}

const QADetailModal: React.FC<QADetailModalProps> = ({ isOpen, onClose, data }) => {
  if (!isOpen || !data) return null;

  // 使用 Portal 将弹窗渲染到 body 根节点，彻底解决 transform 导致的定位失效问题
  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-in fade-in duration-300">
      {/* 磨砂背景遮罩 - 点击关闭 */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] cursor-pointer" 
        onClick={onClose}
      />
      
      {/* 弹窗主体 - 深度还原 HTML 视觉效果 */}
      <div className="relative z-10 w-full max-w-[380px] bg-white dark:bg-card-dark rounded-[40px] shadow-[0_30px_60px_-12px_rgba(0,0,0,0.25),0_18px_36px_-18px_rgba(0,0,0,0.3)] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in duration-300">
        
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 pb-24">
          <header className="mb-6 pt-2">
            <h2 className="text-[24px] font-extrabold text-primary dark:text-white leading-tight">
              {data.title}
            </h2>
          </header>

          <div className="space-y-5 text-primary/80 dark:text-white/80">
            {data.content.map((paragraph, idx) => (
              <p key={idx} className="text-[15px] leading-relaxed">
                {paragraph}
              </p>
            ))}

            {/* Clay-3D 视觉方块 */}
            <div className="my-8 aspect-video bg-gradient-to-br from-[#f0f0f0] to-[#e6e6e6] dark:from-white/5 dark:to-white/[0.02] rounded-3xl flex flex-col items-center justify-center p-6 border border-white/40 shadow-[inset_2px_2px_5px_rgba(255,255,255,0.8),inset_-2px_-2px_5px_rgba(0,0,0,0.05),8px_8px_15px_rgba(0,0,0,0.05)]">
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 flex items-center justify-center text-accent-purple">
                  <svg className="w-full h-full drop-shadow-sm" viewBox="0 0 100 100">
                    <path d="M10,80 Q50,80 50,50 T90,20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="6"></path>
                  </svg>
                </div>
                <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-accent-blue/40 blur-[2px]"></div>
                <div className="absolute bottom-2 left-4 w-3 h-3 rounded-full bg-accent-orange/40 blur-[1px]"></div>
              </div>
              <span className="mt-4 text-[11px] font-bold text-black/30 dark:text-white/30 uppercase tracking-[0.2em]">
                {data.visualLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 底部关闭按钮 */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-white dark:from-card-dark via-white dark:via-card-dark to-transparent">
          <button 
            onClick={onClose}
            className="w-full h-14 bg-black dark:bg-white rounded-full flex items-center justify-center active:scale-[0.98] transition-all shadow-lg"
          >
            <span className="text-[14px] font-bold text-white dark:text-black uppercase tracking-widest">Close</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default QADetailModal;
