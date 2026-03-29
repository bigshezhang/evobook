import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { trpc } from '../../utils/trpc/client';
import { getSelectedCharacter, type MascotCharacter } from '../../utils/mascotUtils';
import { useAppStore } from '../../utils/stores';
import { ROUTES } from '../../utils/routes';
import { useThemeColor, PAGE_THEME_COLORS } from '../../utils/themeColor';
import { useLanguage } from '../../utils/LanguageContext';
import { useLanguageStore } from '../../utils/stores';
import { getFirstQuestionPreset } from '../../utils/onboardingPresets';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// onboarding.next 返回类型
type OnboardingResult = {
  type: 'chat' | 'finish' | 'concept_list_check';
  message: string;
  options?: string[];
  data?: any;
  concepts?: string[];
  sessionId?: string;
};

const AssessmentChat: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 设置页面主题色（状态栏颜色）- 浅蓝灰色
  useThemeColor('#F8F9FD');

  const onboardingNextMutation = trpc.onboarding.next.useMutation();

  // Get language from context
  const language = useLanguage();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conceptCheck, setConceptCheck] = useState<{
    message: string;
    concepts: string[];
    selected: Set<string>;
  } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Track how many messages have been rendered to only animate new ones
  const renderedMsgCountRef = useRef(0);
  // Debounce timer for smooth scrolling
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Discovery preset from URL
  const discoveryPresetId = searchParams.get('preset');

  // Selected topic from InterestSelection page
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // onboarding 完成数据，用于显示「开始学习」按钮
  const [finishData, setFinishData] = useState<OnboardingResult['data'] | null>(null);

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
        selectOption: '从下方选择，或在输入框中输入你的回答',
        enterAnswer: '输入你的答案...',
      };
    }
    return {
      connectionError: 'Unable to connect to server, please try again later',
      sendError: 'Failed to send, please try again',
      thinking: 'Thinking...',
      customizingPath: 'Customizing your path',
      craftingModule: 'Crafting new module',
      selectOption: 'Pick an option, or type your answer below',
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
      const topic = useAppStore.getState().selectedTopic;

      if (!topic && !discoveryPresetId) {
        // Fresh entry: show preset immediately, no API call, no loading.
        // First API call will happen when user clicks an option or sends a message.
        const lang = useLanguageStore.getState().language;
        const preset = getFirstQuestionPreset(lang);
        setMessages([{ role: 'assistant', content: preset.message }]);
        setOptions(preset.options);
        return;
      }

      // 有预选主题或 discovery preset：调 API（跳过 Phase 1）
      setLoading(true);
      setError(null);
      try {
        const response = await onboardingNextMutation.mutateAsync({
          initialTopic: topic || undefined,
          discoveryPresetId: discoveryPresetId || undefined,
        });

        if (abortController.signal.aborted) return;

        handleResponse(response as OnboardingResult, true);
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

  const handleFinishResponse = (response: OnboardingResult) => {
    if (response.type === 'finish') {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.message
      }]);

      // 保存数据到 store，但不自动跳转；由用户点击按钮触发导航
      useAppStore.getState().setOnboardingData(response.data);
      useAppStore.getState().setSelectedTopic(null);
      setFinishData(response.data);
    }
  };

  const handleResponse = (response: OnboardingResult, isInit = false) => {
    if (response.type === 'chat') {
      setSessionId(response.sessionId ?? null);
      if (isInit) {
        setMessages([{ role: 'assistant', content: response.message }]);
      }
      setOptions(response.options ?? []);
    } else if (response.type === 'finish') {
      handleFinishResponse(response);
    } else if (response.type === 'concept_list_check') {
      setSessionId(response.sessionId ?? null);
      setConceptCheck({
        message: response.message,
        concepts: response.concepts ?? [],
        selected: new Set(),
      });
      setOptions([]);
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
      // sessionId 为 null 时是首次交互（来自 preset），
      // 将用户选择作为 initialTopic 发送，后端跳过 Phase 1 直接进入 Phase 2
      const response = (sessionId
        ? await onboardingNextMutation.mutateAsync({
            sessionId,
            userMessage: userChoice ? undefined : messageContent,
            userChoice: userChoice || undefined,
          })
        : await onboardingNextMutation.mutateAsync({
            initialTopic: messageContent,
          })) as OnboardingResult;

      if (response.type === 'chat') {
        setSessionId(response.sessionId ?? null);
        setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
        setOptions(response.options ?? []);
      } else if (response.type === 'finish') {
        handleFinishResponse(response);
      } else if (response.type === 'concept_list_check') {
        setSessionId(response.sessionId ?? null);
        setConceptCheck({
          message: response.message,
          concepts: response.concepts ?? [],
          selected: new Set(),
        });
        setOptions([]);
      }
    } catch (err) {
      console.error('API error:', err);
      setError(text.sendError);
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

        {/* Loading indicator - hide when preset first message and options are already shown */}
        {loading && !(messages.length === 1 && options.length > 0) && (
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

        {/* Concept List Check */}
        {conceptCheck && !loading && (
          <div className="relative bg-white p-6 rounded-[32px] shadow-soft flex flex-col gap-5 border border-white/50 mt-2 animate-bubble-in">
            {/* Title */}
            <h3 className="text-[15px] font-semibold text-[#1a1b23]">{conceptCheck.message}</h3>
            
            {/* Concept Tags */}
            <div className="flex flex-wrap gap-2.5">
              {conceptCheck.concepts.map((concept) => {
                const isSelected = conceptCheck.selected.has(concept);
                return (
                  <button
                    key={concept}
                    onClick={() => {
                      const newSelected = new Set(conceptCheck.selected);
                      if (isSelected) {
                        newSelected.delete(concept);
                      } else {
                        newSelected.add(concept);
                      }
                      setConceptCheck({ ...conceptCheck, selected: newSelected });
                    }}
                    className={`
                      px-4 py-2.5 rounded-full text-[15px] font-semibold transition-colors
                      flex items-center gap-1.5 border-2
                      ${isSelected 
                        ? 'bg-black text-white border-black' 
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    {isSelected ? (
                      <span className="material-symbols-rounded text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                    ) : (
                      <span className="material-symbols-rounded text-[18px] text-gray-400">
                        radio_button_unchecked
                      </span>
                    )}
                    {concept}
                  </button>
                );
              })}
            </div>

            {/* Submit Button */}
            <button
              onClick={async () => {
                const selectedConcepts = Array.from(conceptCheck.selected);
                
                // Add user message showing selection
                const selectionText = selectedConcepts.length > 0 
                  ? `I want to learn: ${selectedConcepts.join(', ')}` 
                  : 'I want to explore all areas';
                setMessages(prev => [...prev, { role: 'user', content: selectionText }]);
                
                setConceptCheck(null);
                setLoading(true);
                
                try {
                  const response = await onboardingNextMutation.mutateAsync({
                    sessionId: sessionId ?? undefined,
                    userMessage: JSON.stringify({ interested_concepts: selectedConcepts }),
                  }) as OnboardingResult;
                  
                  if (response.type === 'chat') {
                    setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
                    setOptions(response.options ?? []);
                  } else if (response.type === 'finish') {
                    handleFinishResponse(response);
                  } else if (response.type === 'concept_list_check') {
                    setConceptCheck({
                      message: response.message,
                      concepts: response.concepts ?? [],
                      selected: new Set(),
                    });
                    setOptions([]);
                  }
                } catch (err) {
                  console.error('[AssessmentChat] Failed to submit concepts:', err);
                  setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: 'Sorry, something went wrong. Please try again.' 
                  }]);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className={`
                w-full py-4 px-6 rounded-full font-bold text-[15px] 
                transition-all flex items-center justify-center gap-2
                ${loading
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-black text-white hover:bg-black/90 active:scale-95'
                }
              `}
            >
              {loading ? (
                <>
                  <span className="material-symbols-rounded animate-spin">progress_activity</span>
                  Processing...
                </>
              ) : (
                <>
                  Continue
                  {conceptCheck.selected.size > 0 && ` (${conceptCheck.selected.size} selected)`}
                </>
              )}
            </button>
          </div>
        )}

        {/* Options */}
        {options.length > 0 && (
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

        {/* onboarding 完成后的显式跳转按钮 */}
        {finishData && (
          <div className="p-4">
            <button
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-lg"
              onClick={() => {
                const hasCompletedOnboarding = useAppStore.getState().onboardingCompleted;
                if (hasCompletedOnboarding) {
                  navigate(ROUTES.GENERATING);
                } else {
                  navigate(ROUTES.COMPANION);
                }
              }}
            >
              开始学习之旅 →
            </button>
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
