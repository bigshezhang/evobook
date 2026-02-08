import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { onboardingNext, isChatResponse, isFinishResponse, type OnboardingResponse } from '../../utils/api';
import { getSelectedCharacter, type MascotCharacter } from '../../utils/mascotUtils';
import { useAppStore } from '../../utils/stores';
import { ROUTES } from '../../utils/routes';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';
import { useLanguage } from '../../utils/LanguageContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AssessmentChat: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 设置页面主题色（状态栏颜色）- 浅蓝灰色
  useThemeColor('#F8F9FD');

  // Get language from context
  const language = useLanguage();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Track how many messages have been rendered to only animate new ones
  const renderedMsgCountRef = useRef(0);
  // Debounce timer for smooth scrolling
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Discovery preset from URL
  const discoveryPresetId = searchParams.get('preset');

  // Selected topic from InterestSelection page
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Check if this is onboarding or returning user
  const [isOnboarding, setIsOnboarding] = useState(true);

  // Get selected mascot character
  const [mascotCharacter, setMascotCharacter] = useState<MascotCharacter>(getSelectedCharacter());

  // Get mascot name and avatar based on character
  const getMascotInfo = (character: MascotCharacter) => {
    const mascotMap = {
      oliver: { name: 'Oliver', avatar: '/compressed_output/processed_image_profile/owl_profile.jpg' },
      luna: { name: 'Luna', avatar: '/compressed_output/processed_image_profile/bee_profile.jpg' },
      bolt: { name: 'Bolt', avatar: '/compressed_output/processed_image_profile/sheep_profile.jpg' },
    };
    return mascotMap[character];
  };

  const mascotInfo = getMascotInfo(mascotCharacter);

  // Get localized UI text based on language (for non-LLM generated text)
  const getText = () => {
    if (language === 'zh') {
      return {
        connectionError: '无法连接到服务器，请稍后重试',
        sendError: '发送失败，请重试',
        thinking: '思考中...',
        customizingPath: '定制你的路径',
        craftingModule: '创建新模块',
        selectOption: '选择一个选项',
        enterAnswer: '输入你的答案...',
      };
    }
    return {
      connectionError: 'Unable to connect to server, please try again later',
      sendError: 'Failed to send, please try again',
      thinking: 'Thinking...',
      customizingPath: 'Customizing your path',
      craftingModule: 'Crafting new module',
      selectOption: 'Select an option',
      enterAnswer: 'Enter your answer...',
    };
  };

  const text = getText();

  // Function to clear all session-related data
  const clearSessionData = useCallback(() => {
    useAppStore.getState().setAssessmentSessionId(null);
    useAppStore.getState().setSelectedTopic(null);
  }, []);

  // Function to reset component state
  const resetState = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    setOptions([]);
    setInput('');
    setLoading(false);
    setError(null);
    setSelectedTopic(null);
  }, []);

  // Handle back button click - clear data before navigating
  const handleBackClick = useCallback(() => {
    // Clear all session data
    clearSessionData();
    // Reset state to prevent flash on re-entry
    resetState();
    // Navigate back
    navigate(-1);
  }, [clearSessionData, resetState, navigate]);

  useEffect(() => {
    const completed = useAppStore.getState().onboardingCompleted;
    setIsOnboarding(!completed);

    // Read selected topic from store
    const topic = useAppStore.getState().selectedTopic;
    if (topic) {
      setSelectedTopic(topic);
    }

    // Listen for mascot character changes
    const handleMascotChange = () => {
      setMascotCharacter(getSelectedCharacter());
    };
    window.addEventListener('mascot-character-changed', handleMascotChange);

    return () => {
      window.removeEventListener('mascot-character-changed', handleMascotChange);
    };
  }, []);

  // Debounced scroll-to-bottom: avoids jitter from concurrent layout changes
  const scrollToBottom = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
    }
    scrollTimerRef.current = setTimeout(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }, 80);
  }, []);

  // Scroll when any content changes (messages, loading, options)
  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, options, scrollToBottom]);

  // Update rendered message count AFTER paint so new messages get animation
  useEffect(() => {
    renderedMsgCountRef.current = messages.length;
  }, [messages.length]);

  // Initialize session on mount - reset state first to prevent flash
  useEffect(() => {
    // CRITICAL: Reset all state immediately on mount to prevent flash of old content
    setSessionId(null);
    setMessages([]);
    setOptions([]);
    setInput('');
    setError(null);

    // Flag to track if component is still mounted (using ref to survive StrictMode remounts)
    const abortController = new AbortController();

    const initSession = async () => {
      setLoading(true);
      setError(null);
      try {
        // Read selected topic for initial context
        const topic = useAppStore.getState().selectedTopic;

        // Pass initial_topic to skip Phase 1 if topic is pre-selected
        // Backend will start at calibration phase directly
        // If discovery_preset_id is provided, it will inject seed context
        const response = await onboardingNext({
          initial_topic: topic || undefined,
          discovery_preset_id: discoveryPresetId || undefined,
        });

        // Check if component was unmounted during the request
        if (abortController.signal.aborted) return;

        handleResponse(response, true);
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error('Failed to init session:', err);
          setError(text.connectionError);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };
    initSession();

    // Cleanup on unmount
    return () => {
      abortController.abort();
    };
  }, []);

  const handleFinishResponse = (response: OnboardingResponse) => {
    if (isFinishResponse(response)) {
      // Add LLM-generated final message before navigation
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.message
      }]);

      // Save data and navigate after a brief delay
      setTimeout(() => {
        useAppStore.getState().setOnboardingData(response.data);
        // Clear the selected topic as it's no longer needed
        useAppStore.getState().setSelectedTopic(null);

        // Check if user has completed onboarding before
        // If yes, skip companion setup and go straight to generating
        const hasCompletedOnboarding = useAppStore.getState().onboardingCompleted;

        if (hasCompletedOnboarding) {
          // Returning user: skip personal setup, go straight to course generation
          navigate(ROUTES.GENERATING);
        } else {
          // First-time user: go directly to companion selection (skip nickname)
          navigate(ROUTES.COMPANION);
        }
      }, 1500);
    }
  };

  const handleResponse = (response: OnboardingResponse, isInit = false) => {
    if (isChatResponse(response)) {
      setSessionId(response.session_id);
      if (isInit) {
        setMessages([{ role: 'assistant', content: response.message }]);
      }
      setOptions(response.options);
    } else if (isFinishResponse(response)) {
      handleFinishResponse(response);
    }
  };

  const handleSend = async (userChoice?: string) => {
    const messageContent = userChoice || input.trim();
    if (!messageContent || loading) return;

    setLoading(true);
    setError(null);
    setOptions([]); // Clear options while loading

    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: messageContent }]);
    setInput('');

    try {
      const response = await onboardingNext({
        session_id: sessionId,
        user_message: userChoice ? null : messageContent,
        user_choice: userChoice || null,
      });

      if (isChatResponse(response)) {
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        setOptions(response.options);
      } else if (isFinishResponse(response)) {
        handleFinishResponse(response);
      }
    } catch (err) {
      console.error('API error:', err);
      setError(text.sendError);
      // Restore options if there were any
    } finally {
      setLoading(false);
    }
  };

  const handleOptionClick = (option: string) => {
    if (!loading) {
      handleSend(option);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FD] font-display">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background-light/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={handleBackClick} className="w-8 h-8 flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-400">arrow_back_ios</span>
          </button>
          <div className="relative w-10 h-10 rounded-full bg-white shadow-soft flex items-center justify-center border-2 border-white overflow-hidden">
            <img alt={mascotInfo.name} src={mascotInfo.avatar} className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-[#1a1b23]">{mascotInfo.name}</h2>
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-yellow-400' : 'bg-green-400'} animate-pulse`}></span>
              <span className="text-[10px] font-bold text-black/40 uppercase tracking-tight">
                {loading ? text.thinking : (isOnboarding ? text.customizingPath : text.craftingModule)}
              </span>
            </div>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-[#1a1b23]/40">
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </header>

      {/* Messages Area */}
      <main ref={messagesContainerRef} className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-4 no-scrollbar">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-medium">
            {error}
          </div>
        )}

        {/* Messages */}
        {messages.map((message, index) => {
          // Only animate messages that weren't rendered in the previous paint
          const isNew = index >= renderedMsgCountRef.current;
          return (
            <div
              key={index}
              className={`flex flex-col gap-2 max-w-[85%] ${
                message.role === 'user' ? 'self-end' : 'self-start'
              } ${isNew ? 'animate-bubble-in' : ''}`}
            >
              <div
                className={`relative p-4 rounded-bubble shadow-soft border border-white/50 ${
                  message.role === 'user'
                    ? 'bg-charcoal text-white rounded-tr-none'
                    : 'bg-white text-[#1a1b23] rounded-tl-none'
                }`}
              >
                <p className="text-[15px] font-semibold whitespace-pre-wrap">{message.content}</p>
                {message.role === 'assistant' && index === 0 && (
                  <div className="absolute -right-2 -top-2 w-6 h-6 rounded-full three-d-element opacity-80"></div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator */}
        {loading && (
          <div className="flex flex-col gap-2 max-w-[85%] self-start animate-bubble-in">
            <div className="relative bg-white p-4 rounded-bubble rounded-tl-none shadow-soft border border-white/50">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </div>
          </div>
        )}

        {/* Options */}
        {options.length > 0 && !loading && (
          <div className="relative bg-white p-5 rounded-bubble shadow-soft flex flex-col gap-3 border border-white/50 mt-2 animate-bubble-in">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">{text.selectOption}</span>
            <div className="flex flex-wrap gap-2">
              {options.map((option, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOptionClick(option)}
                  disabled={loading}
                  className={`px-4 py-2.5 rounded-full text-sm font-bold transition-all ${
                    loading
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-charcoal text-white hover:bg-charcoal/90 active:scale-95'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <div className="p-6 bg-background-light/95 backdrop-blur-xl border-t border-gray-100">
        <div className="relative flex items-center">
          <input
            className="w-full bg-white h-[60px] pl-6 pr-16 rounded-input border-none shadow-soft text-[15px] placeholder:text-black/20 font-medium disabled:opacity-50"
            placeholder={text.enterAnswer}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <button
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className={`absolute right-2 w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all ${
              loading || !input.trim()
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-charcoal text-white active:scale-90'
            }`}
          >
            {loading ? (
              <span className="material-symbols-outlined font-bold text-xl animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined font-bold text-xl">arrow_upward</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssessmentChat;
