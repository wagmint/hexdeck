"use client";

import { useEffect } from "react";
import { useGuidedTour } from "@/hooks/useGuidedTour";
import { TourOverlay } from "./TourOverlay";
import { TourTooltip } from "./TourTooltip";

export function GuidedTour() {
  const tour = useGuidedTour();

  // Keyboard navigation
  useEffect(() => {
    if (!tour.active) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        tour.nextStep();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        tour.prevStep();
      } else if (e.key === "Escape") {
        e.preventDefault();
        tour.skip();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tour.active, tour.nextStep, tour.prevStep, tour.skip]);

  if (!tour.active || !tour.step) return null;

  return (
    <>
      <TourOverlay targetRect={tour.targetRect} onClick={tour.nextStep} />
      {tour.targetRect && (
        <TourTooltip
          step={tour.step}
          targetRect={tour.targetRect}
          currentStep={tour.currentStep}
          totalSteps={tour.totalSteps}
          onNext={tour.nextStep}
          onPrev={tour.prevStep}
          onSkip={tour.skip}
          onGoTo={tour.goToStep}
        />
      )}
    </>
  );
}
