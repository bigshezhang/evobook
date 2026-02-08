
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../utils/routes';

const WelcomeView: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-screen bg-white relative overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-10 pt-10">
        <div className="relative w-64 h-64 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-50 rounded-full scale-110 blur-2xl opacity-50"></div>
          <div className="relative z-10 text-indigo-500">
            <span className="material-symbols-outlined" style={{ fontSize: '160px', fontVariationSettings: "'FILL' 1" }}>face_6</span>
            <div className="absolute -left-4 top-1/2 -translate-y-1/2 -rotate-12 text-indigo-400">
              <span className="material-symbols-outlined" style={{ fontSize: '60px', fontVariationSettings: "'FILL' 1" }}>flutter_dash</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-10 pb-20 text-center">
        <h1 className="text-5xl font-black text-black leading-tight tracking-tighter mb-4">
          Welcome to <br /> EvoBook!
        </h1>
        <p className="text-xl text-gray-400 font-medium leading-relaxed mb-12">
          Your journey into the world of knowledge starts here.
        </p>
        <button 
          onClick={() => navigate(ROUTES.INTERESTS)}
          className="w-full h-18 py-5 rounded-full bg-black text-white font-extrabold text-xl active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2"
        >
          Get Started
          <span className="material-symbols-outlined text-2xl">arrow_forward</span>
        </button>
      </div>

      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-indigo-50 rounded-full blur-[80px] pointer-events-none opacity-60"></div>
    </div>
  );
};

export default WelcomeView;
