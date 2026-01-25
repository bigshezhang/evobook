
import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotificationPermission: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#EFE9FF] to-[#F8F7FC] font-display items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col h-full">
        <div className="flex-1 relative flex flex-col items-center justify-center pt-10">
          <div className="relative w-80 h-80 animate-bounce transition-all" style={{ animationDuration: '4s' }}>
            <img 
              alt="Mascot"
              className="w-full h-full object-cover rounded-[3rem] shadow-2xl rotate-3 mask-image-gradient"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCTD3rBdQlm6FSTVEfyje_Kj5mI5Yp0T_q0jbvpA34fMQENpCuuh0A-QAUI0F8HAw0eU1aRQyKtK9867ZRK8LZFPWxuJYDXDUOhPmvfGJbW0P8GbAK7yfj7Dy_CQewXsAuvP36b6Wn7jBYwC2AZdARATP8IMjgo_mvHJJO7MglVWjq-mIxFeqgR48207_eNw9sdi5ajYE0cw_uYwisc-VHcJEJMOfWrunpMG2Pcj2KTR0mGJuyQ_7eycRCwJOdFEibjiFPHXV69bplO" 
            />
            <div className="absolute -right-4 top-10 bg-gradient-to-br from-secondary to-purple-600 text-white p-4 rounded-2xl shadow-lg border-4 border-white">
              <span className="material-symbols-outlined text-4xl">notifications_active</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-t-[3rem] px-8 pt-10 pb-10 shadow-[0_-10px_60px_-15px_rgba(0,0,0,0.1)]">
          <div className="text-center space-y-4 mb-10">
            <h1 className="text-3xl font-extrabold text-charcoal leading-tight">
              Never miss a <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-secondary to-pink-500">growth spurt!</span>
            </h1>
            <p className="text-lg text-gray-500 font-medium leading-relaxed px-2">
              Let your little assistant remind you to learn on time and stay consistent.
            </p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => navigate('/generating')}
              className="w-full h-16 bg-secondary text-white rounded-3xl font-bold text-xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <span className="material-symbols-outlined text-3xl">notifications</span>
              Enable Notifications
            </button>
            <button 
              onClick={() => navigate('/generating')}
              className="w-full h-12 text-gray-400 font-bold text-lg hover:text-secondary transition-colors"
            >
              Start Journey
            </button>
          </div>

          <div className="mt-8 flex justify-center items-center gap-2">
            <span className="text-xs font-bold text-gray-300 uppercase tracking-widest mr-2">Step 3/3</span>
            <div className="flex gap-1.5">
              <div className="h-1.5 w-6 rounded-full bg-gray-100"></div>
              <div className="h-1.5 w-6 rounded-full bg-gray-100"></div>
              <div className="h-1.5 w-10 rounded-full bg-secondary"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPermission;
