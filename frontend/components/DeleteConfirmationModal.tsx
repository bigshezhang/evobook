
import React from 'react';
import { createPortal } from 'react-dom';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-[4px] flex items-center justify-center px-6 animate-in fade-in duration-300">
      {/* Background Overlay to close on click outside */}
      <div className="absolute inset-0" onClick={onClose}></div>
      
      {/* Modal Card */}
      <div className="relative w-full max-w-[380px] bg-white dark:bg-card-dark rounded-[40px] p-8 neo-shadow flex flex-col gap-6 animate-in zoom-in duration-300">
        <div className="space-y-2">
          <h2 className="text-[20px] font-extrabold text-primary dark:text-white">Delete Clarification?</h2>
          <p className="text-[14px] text-primary/60 dark:text-white/60 leading-relaxed">
            This action cannot be recovered.
          </p>
        </div>

        {/* Toggle Option */}
        <div className="flex items-center justify-between py-3 border-y border-black/[0.05] dark:border-white/[0.05]">
          <span className="text-[14px] font-semibold text-primary/80 dark:text-white/80">Don't ask me again</span>
          <div className="relative inline-block w-10 h-6 align-middle select-none">
            <input 
              className="peer absolute block w-6 h-6 rounded-full bg-white border-4 border-gray-300 appearance-none cursor-pointer transition-all duration-300 ease-in-out z-10 checked:right-0 checked:border-primary dark:checked:border-white checked:bg-primary dark:checked:bg-white" 
              id="toggle" 
              name="toggle" 
              type="checkbox"
              style={{ right: 'auto' }}
            />
            <label 
              className="block overflow-hidden h-6 rounded-full bg-gray-200 cursor-pointer transition-colors duration-300 peer-checked:bg-accent-purple/20 peer-checked:border-accent-purple/30" 
              htmlFor="toggle"
            ></label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="flex-1 h-14 rounded-full bg-black/[0.05] dark:bg-white/[0.05] flex items-center justify-center active:scale-95 transition-transform"
          >
            <span className="text-[15px] font-bold text-primary/40 dark:text-white/40">Cancel</span>
          </button>
          <button 
            onClick={onConfirm}
            className="flex-1 h-14 rounded-full bg-black dark:bg-white flex items-center justify-center neo-shadow active:scale-95 transition-transform"
          >
            <span className="text-[15px] font-bold text-white dark:text-black">Delete</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DeleteConfirmationModal;
