
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Storage key for selected topic
export const STORAGE_KEY_SELECTED_TOPIC = 'evo_selected_topic';
// Storage key for session (imported from AssessmentChat for consistency)
const STORAGE_KEY_SESSION_ID = 'evo_assessment_session_id';

const interests = [
  { id: 'ai', label: 'AI', icon: 'smart_toy', color: 'bg-violet-200' },
  { id: 'design', label: 'Design', icon: 'palette', color: 'bg-blue-200' },
  { id: 'english', label: 'English', icon: 'language', color: 'bg-amber-200' },
  { id: 'movie', label: 'Movie', icon: 'movie', color: 'bg-rose-200' },
  { id: 'tech', label: 'Tech', icon: 'devices', color: 'bg-sky-200' },
  { id: 'music', label: 'Music', icon: 'music_note', color: 'bg-orange-200' },
  { id: 'math', label: 'Math', icon: 'functions', color: 'bg-emerald-200' },
  { id: 'logic', label: 'Logic', icon: 'psychology', color: 'bg-fuchsia-200' },
  { id: 'sport', label: 'Sport', icon: 'fitness_center', color: 'bg-lime-200' },
];

const InterestSelection: React.FC = () => {
  const navigate = useNavigate();
  // Single selection mode: only one interest can be selected at a time
  const [selected, setSelected] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState('');

  // Mutual exclusion logic:
  // - If topic input has text, interest buttons are disabled
  // - If an interest is selected, input is disabled and cleared
  const hasTopicInput = topicInput.trim().length > 0;
  const hasSelectedInterest = selected !== null;

  const handleInterestClick = (id: string) => {
    // If input has text, buttons are disabled - shouldn't reach here
    if (hasTopicInput) return;

    // Toggle selection: click selected interest to deselect
    if (selected === id) {
      setSelected(null);
    } else {
      // Select new interest, clear any input
      setSelected(id);
      setTopicInput('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // If an interest is selected, input is disabled - shouldn't reach here
    if (hasSelectedInterest) return;

    setTopicInput(e.target.value);
  };

  // Determine the topic to save
  const getSelectedTopic = (): string | null => {
    if (hasSelectedInterest) {
      const interest = interests.find(i => i.id === selected);
      return interest?.label || null;
    }
    if (hasTopicInput) {
      return topicInput.trim();
    }
    return null;
  };

  const canProceed = hasSelectedInterest || hasTopicInput;

  const handleNextStep = () => {
    const topic = getSelectedTopic();
    if (!topic) return;

    // CRITICAL: Clear any existing session data before starting a new assessment
    // This ensures a fresh start and prevents flash of old content
    localStorage.removeItem(STORAGE_KEY_SESSION_ID);

    // Save selected topic to localStorage for AssessmentChat to read
    localStorage.setItem(STORAGE_KEY_SELECTED_TOPIC, topic);

    // Navigate to AssessmentChat
    navigate('/assessment');
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9F9F9] relative overflow-hidden">
      <header className="pt-14 px-8 pb-8 z-20">
        <h1 className="text-4xl font-black text-gray-900 leading-[1.1] mb-8 tracking-tighter">
          Which world <br /> do you want to <br /> explore?
        </h1>
        <div className="relative">
          <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 ${hasSelectedInterest ? 'text-gray-300' : 'text-gray-400'}`}>edit</span>
          <input
            type="text"
            value={topicInput}
            onChange={handleInputChange}
            disabled={hasSelectedInterest}
            placeholder={hasSelectedInterest ? `Selected: ${interests.find(i => i.id === selected)?.label}` : "Enter your learning topic (e.g., Python, Machine Learning)..."}
            className={`w-full pl-12 pr-4 py-4 bg-white border-none rounded-2xl shadow-sm text-lg focus:ring-2 focus:ring-black/20 transition-all ${
              hasSelectedInterest ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 no-scrollbar pb-32">
        <div className="grid grid-cols-3 gap-3">
          {interests.map(item => {
            const isSelected = selected === item.id;
            const isDisabled = hasTopicInput;

            return (
              <button
                key={item.id}
                onClick={() => handleInterestClick(item.id)}
                disabled={isDisabled}
                className={`h-24 rounded-2xl flex flex-col items-center justify-center transition-all ${item.color} ${
                  isSelected
                    ? 'ring-2 ring-black scale-105'
                    : isDisabled
                      ? 'opacity-40 cursor-not-allowed grayscale'
                      : 'opacity-90 hover:opacity-100'
                }`}
              >
                <span className="material-symbols-outlined text-3xl mb-1">{item.icon}</span>
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="absolute bottom-0 left-0 right-0 p-8 bg-white/80 backdrop-blur-md flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold text-gray-400">1 / 4</span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-black rounded-full" style={{ width: '25%' }}></div>
          </div>
        </div>
        <button
          onClick={handleNextStep}
          disabled={!canProceed}
          className={`w-full h-16 rounded-full text-white font-black text-xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 ${
            canProceed ? 'bg-black' : 'bg-gray-300 cursor-not-allowed'
          }`}
        >
          Next Step
          <span className="material-symbols-outlined">arrow_forward</span>
        </button>
      </footer>
    </div>
  );
};

export default InterestSelection;
