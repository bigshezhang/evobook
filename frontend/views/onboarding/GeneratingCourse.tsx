import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateCourseMap, STORAGE_KEYS, BUSINESS_CONFIG, FinishData, Mode, buildLearningPath } from '../../utils/api';
import { ROUTES } from '../../utils/routes';

interface GenerationState {
  status: 'loading' | 'success' | 'error';
  progress: number;
  errorMessage?: string;
}

const GeneratingCourse: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<GenerationState>({
    status: 'loading',
    progress: 0,
  });
  const [topicName, setTopicName] = useState('your course');
  const hasStarted = useRef(false);

  useEffect(() => {
    // Use AbortController to handle cleanup properly in StrictMode
    const abortController = new AbortController();

    // Prevent double execution in StrictMode
    if (hasStarted.current) return;
    hasStarted.current = true;

    const generateCourse = async () => {
      // Check if aborted before proceeding
      if (abortController.signal.aborted) return;

      try {
        // Read onboarding data from localStorage
        const onboardingDataStr = localStorage.getItem(STORAGE_KEYS.ONBOARDING_DATA);
        if (!onboardingDataStr) {
          console.error('No onboarding data found in localStorage');
          setState({ status: 'error', progress: 0, errorMessage: 'Please complete onboarding first' });
          setTimeout(() => navigate(ROUTES.ASSESSMENT), 2000);
          return;
        }

        const onboardingData: FinishData = JSON.parse(onboardingDataStr);
        setTopicName(onboardingData.topic);

        // Animate progress
        setState({ status: 'loading', progress: BUSINESS_CONFIG.INITIAL_PROGRESS_PERCENT });

        // Use mode from onboarding data (user selected during onboarding)
        const mode: Mode = onboardingData.mode;
        const totalCommitmentMinutes = BUSINESS_CONFIG.DEFAULT_COMMITMENT_MINUTES;

        // Check if aborted before API call
        if (abortController.signal.aborted) return;

        // Call the API
        const response = await generateCourseMap({
          topic: onboardingData.topic,
          level: onboardingData.level,
          focus: onboardingData.focus,
          verified_concept: onboardingData.verified_concept,
          mode,
          total_commitment_minutes: totalCommitmentMinutes,
        });

        // Check if aborted before updating state
        if (abortController.signal.aborted) return;

        // Animate progress to 80%
        setState({ status: 'loading', progress: 80 });

        // Note: Course is now saved in backend, no need for localStorage
        // Only keep onboarding data in localStorage for reference

        // Animate progress to 100%
        setState({ status: 'success', progress: 100 });

        // Mark onboarding as completed
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETED, 'true');

        // Navigate to knowledge tree after brief delay
        setTimeout(() => navigate(buildLearningPath(ROUTES.KNOWLEDGE_TREE, { cid: response.course_map_id })), 800);
      } catch (error) {
        if (abortController.signal.aborted) return;
        console.error('Failed to generate course map:', error);
        setState({
          status: 'error',
          progress: 0,
          errorMessage: error instanceof Error ? error.message : 'Failed to generate course',
        });
      }
    };

    // Start generation with a small delay for smooth animation
    const timer = setTimeout(generateCourse, 500);
    return () => {
      clearTimeout(timer);
      abortController.abort();
      hasStarted.current = false;  // Reset for StrictMode re-mount
    };
  }, [navigate]);

  // Calculate stroke-dashoffset based on progress (578 is circumference)
  const strokeDashoffset = 578 - (578 * state.progress) / 100;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-[#F8F9FD] p-8 overflow-hidden font-display">
      <div className="relative w-80 h-80 mb-12 flex items-center justify-center">
        <svg className="absolute inset-0 w-full h-full -rotate-90 transform" viewBox="0 0 200 200">
          <circle cx="100" cy="100" fill="none" r="92" stroke="#E2E8F0" strokeWidth="10" className="opacity-30" />
          <circle
            cx="100"
            cy="100"
            fill="none"
            r="92"
            stroke="url(#purpleGradient)"
            strokeWidth="12"
            strokeDasharray="578"
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000"
          />
          <defs>
            <linearGradient id="purpleGradient" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#8B5CF6" />
              <stop offset="100%" stopColor="#D946EF" />
            </linearGradient>
          </defs>
        </svg>
        <div className="relative z-10 w-60 h-60 bg-white/40 rounded-full clay-shadow flex items-center justify-center backdrop-blur-md border border-white/60">
          <div className="relative flex flex-col items-center">
            <div className="w-28 h-36 bg-[#E0E7FF] rounded-[4rem] relative shadow-inner overflow-hidden flex flex-col items-center justify-center border-4 border-white">
              <div className="flex gap-2 mt-4">
                <div className="w-8 h-8 bg-white rounded-full border-2 border-slate-800 flex items-center justify-center">
                  <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
                </div>
                <div className="w-8 h-8 bg-white rounded-full border-2 border-slate-800 flex items-center justify-center">
                  <div className="w-3 h-3 bg-slate-800 rounded-full"></div>
                </div>
              </div>
            </div>
            <div className="absolute -top-10 -right-6 w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-white">
              <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
            </div>
            <div className="absolute -bottom-2 px-4 py-1.5 bg-white/90 rounded-full shadow-lg border border-primary/20">
              <span className="text-xl font-extrabold text-primary tracking-tight">{state.progress}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center space-y-4 px-6">
        {state.status === 'error' ? (
          <>
            <h2 className="text-2xl font-extrabold text-rose-600 tracking-tight">Generation Failed</h2>
            <p className="text-sm font-medium text-slate-400">{state.errorMessage}</p>
          </>
        ) : state.status === 'success' ? (
          <>
            <h2 className="text-2xl font-extrabold text-emerald-600 tracking-tight">Ready!</h2>
            <p className="text-sm font-medium text-slate-400">
              Your <span className="text-slate-900 font-bold">{topicName}</span> journey is ready...
            </p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Crafting Your Path...</h2>
            <p className="text-sm font-medium text-slate-400">
              AI is tailoring your <span className="text-slate-900 font-bold">{topicName}</span> journey...
            </p>
            <div className="flex gap-1.5 justify-center">
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GeneratingCourse;
