import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';

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

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// SSR-safe layoutEffect
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const DURATION = 380;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

const GuideOverlay: React.FC<GuideOverlayProps> = ({
  steps,
  currentStep,
  onComplete,
  onSkip,
  onNext,
  onBack,
}) => {
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 });
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  // Overlay fade-in on first mount
  const [mounted, setMounted] = useState(false);
  // Controls tooltip text fade during step transitions
  const [contentVisible, setContentVisible] = useState(false);
  // Whether first position has been calculated (prevents showing tooltip at 0,0)
  const [ready, setReady] = useState(false);
  // Enable CSS transitions only after the first position is painted
  const [animate, setAnimate] = useState(false);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const prevStepRef = useRef<number>(-1);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const isCenter = step?.position === 'center';

  // Fade-in the whole overlay on mount
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Before paint: immediately hide content text when step changes
  // This prevents the new content flashing for 1 frame before the fade starts
  useIsoLayoutEffect(() => {
    if (prevStepRef.current !== -1 && prevStepRef.current !== currentStep && ready) {
      setContentVisible(false);
    }
  }, [currentStep, ready]);

  const measure = useCallback(() => {
    if (!step || !tooltipRef.current) return;

    const targetEl = document.querySelector(step.targetSelector);
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();
    const tipRect = tooltipRef.current.getBoundingClientRect();
    const pad = 16;

    // Always compute spotlight rect (even for center) so the div always exists
    // and CSS transitions have something to interpolate from/to
    setSpotlight({
      top: rect.top - 10,
      left: rect.left - 10,
      width: rect.width + 20,
      height: rect.height + 20,
    });

    // Compute tooltip position
    let top = 0;
    let left = 0;
    let arrowPosition: TooltipPosition['arrowPosition'];
    const position = step.position || 'bottom';

    switch (position) {
      case 'top':
        top = rect.top - tipRect.height - pad;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        arrowPosition = 'bottom';
        break;
      case 'bottom':
        top = rect.bottom + pad;
        left = rect.left + rect.width / 2 - tipRect.width / 2;
        arrowPosition = 'top';
        break;
      case 'left':
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.left - tipRect.width - pad;
        arrowPosition = 'right';
        break;
      case 'right':
        top = rect.top + rect.height / 2 - tipRect.height / 2;
        left = rect.right + pad;
        arrowPosition = 'left';
        break;
      case 'center':
        top = window.innerHeight / 2 - tipRect.height / 2;
        left = window.innerWidth / 2 - tipRect.width / 2;
        arrowPosition = undefined;
        break;
    }

    const maxTop = window.innerHeight - tipRect.height - pad;
    const maxLeft = window.innerWidth - tipRect.width - pad;
    top = Math.max(pad, Math.min(top, maxTop));
    left = Math.max(pad, Math.min(left, maxLeft));

    setTooltipPos({ top, left, arrowPosition });
  }, [step]);

  // Position calculation + content reveal
  useEffect(() => {
    if (!step) return;

    const isStepChange = prevStepRef.current !== currentStep;
    prevStepRef.current = currentStep;

    if (isStepChange && ready) {
      // Step transition: recompute position, then fade content back in
      const t1 = setTimeout(() => {
        measure();
        // Small delay so the position transition starts before content appears
        const t2 = setTimeout(() => setContentVisible(true), 80);
        return () => clearTimeout(t2);
      }, 40);
      return () => clearTimeout(t1);
    } else if (!ready) {
      // Initial mount: compute position then reveal
      const t = setTimeout(() => {
        measure();
        setReady(true);
        requestAnimationFrame(() => {
          setContentVisible(true);
          // Enable transitions only after the first position is painted
          requestAnimationFrame(() => setAnimate(true));
        });
      }, 80);
      return () => clearTimeout(t);
    }
  }, [step, currentStep, measure, ready]);

  // Reposition on resize / scroll
  useEffect(() => {
    const handler = () => measure();
    window.addEventListener('resize', handler);
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [measure]);

  if (!step) return null;

  const handlePrimaryAction = () => {
    if (step.actions?.primary?.onClick) {
      step.actions.primary.onClick();
    } else if (isLast) {
      onComplete();
    } else {
      onNext();
    }
  };

  const handleSecondaryAction = () => {
    if (step.actions?.secondary?.onClick) {
      step.actions.secondary.onClick();
    } else if (!isFirst) {
      onBack();
    }
  };

  // Shared position transition string
  const posTrans = animate
    ? `top ${DURATION}ms ${EASE}, left ${DURATION}ms ${EASE}, width ${DURATION}ms ${EASE}, height ${DURATION}ms ${EASE}`
    : 'none';

  return (
    <div
      className="fixed inset-0 z-[9999]"
      style={{
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.4s ease-out',
      }}
    >
      {/* Full dark overlay — visible in center mode, crossfades with spotlight */}
      <div
        className="absolute inset-0 bg-black/60 pointer-events-none"
        style={{
          opacity: isCenter ? 1 : 0,
          transition: animate ? `opacity ${DURATION}ms ${EASE}` : 'none',
        }}
      />

      {/* Spotlight hole via box-shadow — smoothly animatable */}
      {spotlight && (
        <>
          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: isCenter
                ? '0 0 0 9999px rgba(0, 0, 0, 0)'
                : '0 0 0 9999px rgba(0, 0, 0, 0.6)',
              transition: animate
                ? `${posTrans}, box-shadow ${DURATION}ms ${EASE}`
                : 'none',
            }}
          />
          {/* White border highlight */}
          <div
            className="absolute border-[3px] border-white pointer-events-none rounded-xl"
            style={{
              top: spotlight.top,
              left: spotlight.left,
              width: spotlight.width,
              height: spotlight.height,
              boxShadow: '0 0 24px rgba(255, 255, 255, 0.5)',
              opacity: isCenter ? 0 : 1,
              transition: animate
                ? `${posTrans}, opacity ${DURATION}ms ${EASE}`
                : 'none',
            }}
          />
        </>
      )}

      {/* Click blocker over entire viewport */}
      <div className="absolute inset-0" />

      {/* Tooltip — position animates, never hides entirely after first paint */}
      <div
        ref={tooltipRef}
        className="absolute bg-white rounded-2xl shadow-2xl p-6 max-w-sm"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          opacity: ready ? 1 : 0,
          transition: animate
            ? `top ${DURATION}ms ${EASE}, left ${DURATION}ms ${EASE}, opacity 0.2s ease-out`
            : 'opacity 0.25s ease-out',
        }}
      >
        {/* Arrow */}
        {step.showArrow !== false && tooltipPos.arrowPosition && (
          <div
            className="absolute w-0 h-0"
            style={getArrowStyle(tooltipPos.arrowPosition)}
          />
        )}

        {/* Content — only the text fades, tooltip shell stays visible */}
        <div
          style={{
            opacity: contentVisible ? 1 : 0,
            transition: 'opacity 0.18s ease-out',
          }}
        >
          <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
          <div className="text-sm text-slate-600 leading-relaxed mb-4">
            {typeof step.content === 'string' ? (
              <p className="whitespace-pre-line">{step.content}</p>
            ) : (
              step.content
            )}
          </div>

          {/* Progress dots */}
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
          <div className={`flex items-center gap-3 ${isLast ? 'justify-end' : 'justify-between'}`}>
            {/* Hide Skip button on the last step */}
            {!isLast && (
              <button
                onClick={onSkip}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium transition-colors"
              >
                Skip
              </button>
            )}

            <div className="flex items-center gap-2">
              {!isFirst && !step.actions?.secondary && (
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
                {step.actions?.primary?.label || (isLast ? 'Got it!' : 'Next')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Helper: returns inline styles for the tooltip arrow based on its direction */
function getArrowStyle(position: 'top' | 'bottom' | 'left' | 'right'): React.CSSProperties {
  switch (position) {
    case 'top':
      return {
        top: -8, left: '50%', marginLeft: -8,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderBottom: '8px solid white',
      };
    case 'bottom':
      return {
        bottom: -8, left: '50%', marginLeft: -8,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: '8px solid white',
      };
    case 'left':
      return {
        left: -8, top: '50%', marginTop: -8,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: '8px solid white',
      };
    case 'right':
      return {
        right: -8, top: '50%', marginTop: -8,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderLeft: '8px solid white',
      };
  }
}

export default GuideOverlay;
