import React, { useEffect, useState, useRef, useCallback } from 'react';

export interface GuideStep {
  id: string;
  title: string;
  content: string | React.ReactNode;
  targetSelector: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  showArrow?: boolean;
  actions?: {
    primary?: {
      label: string;
      onClick: () => void;
    };
    secondary?: {
      label: string;
      onClick: () => void;
    };
  };
}

interface GuideOverlayProps {
  steps: GuideStep[];
  currentStep: number;
  onComplete: () => void;
  onSkip: () => void;
  onNext: () => void;
  onBack: () => void;
}

interface TooltipPosition {
  top: number;
  left: number;
  arrowPosition?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Animation phases:
 * 0 = invisible (measuring)
 * 1 = visible (fade in complete)
 */

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  steps,
  currentStep,
  onComplete,
  onSkip,
  onNext,
  onBack,
}) => {
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  // Controls the global fade-in for the entire overlay
  const [visible, setVisible] = useState(false);
  // Controls individual tooltip fade-in after position is ready
  const [tooltipReady, setTooltipReady] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  // Global mount: fade in the whole overlay once
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // When step changes, hide tooltip → reposition → show tooltip
  useEffect(() => {
    setTooltipReady(false);
  }, [currentStep]);

  const computePosition = useCallback(() => {
    if (!step || !tooltipRef.current) return;

    const targetElement = document.querySelector(step.targetSelector);
    if (!targetElement) return;

    const rect = targetElement.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const padding = 16;

    setTargetRect(rect);

    let top = 0;
    let left = 0;
    let arrowPosition: 'top' | 'bottom' | 'left' | 'right' | undefined;

    const position = step.position || 'bottom';

    switch (position) {
      case 'top':
        top = rect.top - tooltipRect.height - padding;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        arrowPosition = 'bottom';
        break;
      case 'bottom':
        top = rect.bottom + padding;
        left = rect.left + rect.width / 2 - tooltipRect.width / 2;
        arrowPosition = 'top';
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.left - tooltipRect.width - padding;
        arrowPosition = 'right';
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tooltipRect.height / 2;
        left = rect.right + padding;
        arrowPosition = 'left';
        break;
      case 'center':
        top = window.innerHeight / 2 - tooltipRect.height / 2;
        left = window.innerWidth / 2 - tooltipRect.width / 2;
        arrowPosition = undefined;
        break;
    }

    const maxTop = window.innerHeight - tooltipRect.height - padding;
    const maxLeft = window.innerWidth - tooltipRect.width - padding;

    top = Math.max(padding, Math.min(top, maxTop));
    left = Math.max(padding, Math.min(left, maxLeft));

    setTooltipPosition({ top, left, arrowPosition });
  }, [step]);

  // Position calculation + delayed reveal
  useEffect(() => {
    if (!step) return;

    // Compute position, then reveal tooltip
    const timer = setTimeout(() => {
      computePosition();
      requestAnimationFrame(() => setTooltipReady(true));
    }, 60);

    const handleReposition = () => computePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [step, currentStep, computePosition]);

  if (!step) return null;

  const handlePrimaryAction = () => {
    if (step.actions?.primary?.onClick) {
      step.actions.primary.onClick();
    } else if (isLastStep) {
      onComplete();
    } else {
      onNext();
    }
  };

  const handleSecondaryAction = () => {
    if (step.actions?.secondary?.onClick) {
      step.actions.secondary.onClick();
    } else if (!isFirstStep) {
      onBack();
    }
  };

  const hasSpotlight = targetRect && step.position !== 'center';

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      {/* Backdrop */}
      {hasSpotlight ? (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect
                x={targetRect.left - 10}
                y={targetRect.top - 10}
                width={targetRect.width + 20}
                height={targetRect.height + 20}
                rx="12"
                ry="12"
                fill="black"
              />
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.6)"
            mask="url(#spotlight-mask)"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      {/* White border highlight */}
      {hasSpotlight && (
        <div
          className="absolute border-[3px] border-white pointer-events-none"
          style={{
            top: targetRect.top - 10,
            left: targetRect.left - 10,
            width: targetRect.width + 20,
            height: targetRect.height + 20,
            borderRadius: '12px',
            boxShadow: '0 0 24px rgba(255, 255, 255, 0.5)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-2xl shadow-2xl p-6 max-w-sm"
        style={{
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          opacity: tooltipReady ? 1 : 0,
          transform: tooltipReady ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.25s ease-out, transform 0.25s ease-out',
        }}
      >
        {/* Arrow */}
        {step.showArrow !== false && tooltipPosition.arrowPosition && (
          <div
            className="absolute w-0 h-0"
            style={{
              ...(tooltipPosition.arrowPosition === 'top' && {
                top: -8,
                left: '50%',
                marginLeft: -8,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderBottom: '8px solid white',
              }),
              ...(tooltipPosition.arrowPosition === 'bottom' && {
                bottom: -8,
                left: '50%',
                marginLeft: -8,
                borderLeft: '8px solid transparent',
                borderRight: '8px solid transparent',
                borderTop: '8px solid white',
              }),
              ...(tooltipPosition.arrowPosition === 'left' && {
                left: -8,
                top: '50%',
                marginTop: -8,
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '8px solid white',
              }),
              ...(tooltipPosition.arrowPosition === 'right' && {
                right: -8,
                top: '50%',
                marginTop: -8,
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderLeft: '8px solid white',
              }),
            }}
          />
        )}

        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Skip guide"
        >
          <span className="material-symbols-rounded text-xl">close</span>
        </button>

        {/* Content */}
        <div className="pr-6">
          <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
          <div className="text-sm text-slate-600 leading-relaxed mb-4">
            {typeof step.content === 'string' ? (
              <p className="whitespace-pre-line">{step.content}</p>
            ) : (
              step.content
            )}
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-1 mb-4">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentStep
                    ? 'w-6 bg-secondary'
                    : index < currentStep
                    ? 'w-1.5 bg-secondary/40'
                    : 'w-1.5 bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onSkip}
              className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
            >
              Skip
            </button>

            <div className="flex items-center gap-2">
              {!isFirstStep && !step.actions?.secondary && (
                <button
                  onClick={handleSecondaryAction}
                  className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-full transition-all"
                >
                  Back
                </button>
              )}

              {step.actions?.secondary && (
                <button
                  onClick={handleSecondaryAction}
                  className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 rounded-full transition-all"
                >
                  {step.actions.secondary.label}
                </button>
              )}

              <button
                onClick={handlePrimaryAction}
                className="px-6 py-2 text-sm font-bold bg-secondary text-white rounded-full hover:bg-secondary/90 shadow-lg active:scale-95 transition-all"
              >
                {step.actions?.primary?.label || (isLastStep ? 'Got it!' : 'Next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideOverlay;
