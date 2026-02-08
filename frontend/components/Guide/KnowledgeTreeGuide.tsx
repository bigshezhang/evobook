import React, { useState, useEffect } from 'react';
import GuideOverlay, { GuideStep } from './GuideOverlay';
import { getProfile, updateProfile } from '../../utils/api';

interface KnowledgeTreeGuideProps {
  onComplete: (showToast?: boolean) => void;
  onSkip: () => void;
  hasMultipleCourses: boolean;
  firstAvailableNodeId?: number;
  forceShow?: boolean;
}

const GUIDE_ID = 'knowledge_tree';

const KnowledgeTreeGuide: React.FC<KnowledgeTreeGuideProps> = ({
  onComplete,
  onSkip,
  hasMultipleCourses,
  firstAvailableNodeId,
  forceShow = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // If forced to show, skip the check
    if (forceShow) {
      setIsVisible(true);
      return;
    }

    // Check if user has already seen this guide
    const checkGuideStatus = async () => {
      try {
        const profile = await getProfile();
        const guidesCompleted = profile.guides_completed || [];
        if (guidesCompleted.includes(GUIDE_ID)) {
          // Already completed, silently don't show guide
          setIsVisible(false);
          return;
        }
        setIsVisible(true);
      } catch (error) {
        console.error('Failed to check guide status:', error);
        // On error, don't show guide
        setIsVisible(false);
      }
    };

    checkGuideStatus();
  }, [forceShow]);

  const markGuideCompleted = async () => {
    try {
      const profile = await getProfile();
      const guidesCompleted = profile.guides_completed || [];
      if (!guidesCompleted.includes(GUIDE_ID)) {
        await updateProfile({
          guides_completed: [...guidesCompleted, GUIDE_ID],
        });
      }
    } catch (error) {
      console.error('Failed to mark guide as completed:', error);
    }
  };

  const handleComplete = async (showToast = true) => {
    await markGuideCompleted();
    setIsVisible(false);
    onComplete(showToast);
  };

  const handleSkip = async () => {
    await markGuideCompleted();
    setIsVisible(false);
    onSkip();
  };

  const handleNext = () => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  // Define guide steps
  const steps: GuideStep[] = [
    {
      id: 'welcome',
      title: '🎉 Welcome to Your Learning Path!',
      content:
        'This is your knowledge map. Each node represents a learning unit. Complete nodes to unlock new ones and progress through your course.',
      targetSelector: '[data-dag-container]',
      position: 'center',
      showArrow: false,
    },
    {
      id: 'node-states',
      title: 'Understanding Node States',
      content: (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#1A1A1A]"></div>
            <span>Black nodes are ready to learn</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#FFB938]"></div>
            <span>Gold nodes are completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#EAEAEA]"></div>
            <span>Gray nodes are locked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#0EA5E9] animate-pulse"></div>
            <span>Blue spinning nodes are generating</span>
          </div>
        </div>
      ),
      targetSelector: firstAvailableNodeId
        ? `[data-node-id="${firstAvailableNodeId}"]`
        : '[data-dag-container] button:not([disabled])',
      position: 'bottom',
    },
    {
      id: 'progress-banner',
      title: 'Track Your Progress',
      content:
        'Your overall progress is shown here. Click the banner to view course details and time planning.',
      targetSelector: '[data-course-banner]',
      position: 'bottom',
    },
  ];

  // Add course navigation step
  steps.push({
    id: 'multiple-courses',
    title: 'Switch Between Courses',
    content: hasMultipleCourses
      ? 'You have multiple courses! Use the arrows to switch between them.'
      : 'When you have multiple courses, you can use the arrows to switch between them.',
    targetSelector: '[data-course-banner]',
    position: 'bottom',
  });

  // Add start learning step as the last step
  steps.push({
    id: 'start-learning',
    title: 'Start Your Journey',
    content: 'Click on any black node to start learning. Complete it to unlock the next nodes!',
    targetSelector: firstAvailableNodeId
      ? `[data-node-id="${firstAvailableNodeId}"]`
      : '[data-dag-container] button:not([disabled])',
    position: 'bottom',
    actions: {
      primary: {
        label: 'Start Learning',
        onClick: () => {
          // Find and click the first available node
          const nodeElement = document.querySelector<HTMLButtonElement>(
            firstAvailableNodeId
              ? `[data-node-id="${firstAvailableNodeId}"]`
              : '[data-dag-container] button:not([disabled])'
          );
          if (nodeElement) {
            handleComplete(false); // Don't show toast when starting learning
            setTimeout(() => nodeElement.click(), 300);
          } else {
            handleNext();
          }
        },
      },
    },
  });

  if (!isVisible) return null;

  return (
    <GuideOverlay
      steps={steps}
      currentStep={currentStep}
      onComplete={handleComplete}
      onSkip={handleSkip}
      onNext={handleNext}
      onBack={handleBack}
    />
  );
};

export default KnowledgeTreeGuide;
