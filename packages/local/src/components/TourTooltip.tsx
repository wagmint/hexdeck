"use client";

import type { TourStep } from "@/hooks/useGuidedTour";

interface TourTooltipProps {
  step: TourStep;
  targetRect: DOMRect;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onGoTo: (step: number) => void;
}

const GAP = 12;
const TOOLTIP_W = 280;

export function TourTooltip({
  step,
  targetRect,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onGoTo,
}: TourTooltipProps) {
  const style = computePosition(step.position, targetRect);

  return (
    <div
      className="fixed z-50 tour-tooltip-in"
      style={{ ...style, width: TOOLTIP_W }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-lg p-4 shadow-lg">
        <h3 className="text-sm font-semibold text-[var(--dash-text)] mb-1">
          {step.title}
        </h3>
        <p className="text-xs text-[var(--dash-text-dim)] leading-relaxed mb-4">
          {step.description}
        </p>

        {/* Step dots */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {Array.from({ length: totalSteps }, (_, i) => (
              <button
                key={i}
                onClick={() => onGoTo(i)}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === currentStep
                    ? "bg-[var(--dash-blue)] w-3"
                    : "bg-[var(--dash-text-muted)] hover:bg-[var(--dash-text-dim)]"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={onPrev}
                className="text-[11px] text-[var(--dash-text-dim)] hover:text-[var(--dash-text)] transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={onSkip}
              className="text-[11px] text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
            >
              Skip
            </button>
            <button
              onClick={onNext}
              className="text-[11px] font-medium text-[var(--dash-blue)] hover:text-[var(--dash-text)] transition-colors"
            >
              {currentStep === totalSteps - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function computePosition(
  position: TourStep["position"],
  rect: DOMRect
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  let left: number;

  switch (position) {
    case "bottom":
      top = rect.bottom + GAP;
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case "top":
      top = rect.top - GAP; // will use transform to shift up
      left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
      break;
    case "right":
      top = rect.top + rect.height / 2;
      left = rect.right + GAP;
      break;
    case "left":
      top = rect.top + rect.height / 2;
      left = rect.left - GAP - TOOLTIP_W;
      break;
  }

  // Clamp to viewport
  const pad = 12;
  if (left + TOOLTIP_W > vw - pad) left = vw - TOOLTIP_W - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;
  if (top > vh - 120) top = vh - 120;

  const style: React.CSSProperties = { top, left };
  if (position === "top") {
    style.transform = "translateY(-100%)";
  }
  if (position === "left" || position === "right") {
    style.transform = "translateY(-50%)";
  }

  return style;
}
