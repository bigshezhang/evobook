
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface SuccessFeedbackPillProps {
  isOpen: boolean;
  onClose: () => void;
  message?: string;
}

const SuccessFeedbackPill: React.FC<SuccessFeedbackPillProps> = ({ isOpen, onClose, message = "Added to My Courses" }) => {
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(onClose, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[10000] animate-in fade-in zoom-in duration-300 pointer-events-none">
      <div className="flex items-center gap-3 bg-[#000000] px-4 py-2 rounded-full shadow-[0_15px_40px_-10px_rgba(0,0,0,0.4),0_5px_15px_-5px_rgba(0,0,0,0.1)]">
        <div className="bg-[#22C55E] w-5 h-5 min-w-[20px] min-h-[20px] rounded-full flex items-center justify-center shadow-[inset_0_-1.5px_2px_rgba(0,0,0,0.25),inset_0_1.5px_2px_rgba(255,255,255,0.4),0_2px_4px_rgba(34,197,94,0.3)]">
          <span className="material-symbols-rounded text-white text-[12px] font-bold" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
        </div>
        <span className="text-white text-[13.5px] font-bold whitespace-nowrap tracking-tight">
          {message}
        </span>
      </div>
    </div>,
    document.body
  );
};

export default SuccessFeedbackPill;
