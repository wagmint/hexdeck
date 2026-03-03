"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="topbar"]',
    title: "Control Surface",
    description:
      "System-wide overview: active agents, warnings, and connection status at a glance.",
    position: "bottom",
  },
  {
    target: '[data-tour="agents"]',
    title: "Workstreams & Agents",
    description:
      "Each card represents a project with its active Claude Code or Codex agents. Click to filter the entire dashboard.",
    position: "right",
  },
  {
    target: '[data-tour="intent-map"]',
    title: "Intent Map",
    description:
      "See what each agent is working on — current task, file targets, and progress.",
    position: "bottom",
  },
  {
    target: '[data-tour="live-feed"]',
    title: "Live Feed",
    description:
      "Real-time stream of events: tool calls, commits, approvals, and errors as they happen.",
    position: "left",
  },
  {
    target: '[data-tour="risk"]',
    title: "Risk Analytics",
    description:
      "Flags agents with high token burn, long run times, or repeated errors. Keep costs in check.",
    position: "left",
  },
  {
    target: '[data-tour="plans"]',
    title: "Plan Detail",
    description:
      "Inspect agent plans and track what each agent intends to do. Resize this panel by dragging the top edge.",
    position: "top",
  },
];

const STORAGE_KEY = "hexdeck_tour_completed";

export function useGuidedTour() {
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Delay slightly so layout settles
      const t = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  // Track target element rect
  useEffect(() => {
    if (!active) return;

    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const updateRect = () => {
      const el = document.querySelector(step.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();

    // Watch for layout changes
    const el = document.querySelector(step.target);
    if (el) {
      observerRef.current = new ResizeObserver(updateRect);
      observerRef.current.observe(el);
    }

    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);

    return () => {
      observerRef.current?.disconnect();
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [active, currentStep]);

  const finish = useCallback(() => {
    setActive(false);
    localStorage.setItem(STORAGE_KEY, "true");
    observerRef.current?.disconnect();
  }, []);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      finish();
    }
  }, [currentStep, finish]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step < TOUR_STEPS.length) {
      setCurrentStep(step);
    }
  }, []);

  return {
    active,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    step: TOUR_STEPS[currentStep] ?? null,
    targetRect,
    nextStep,
    prevStep,
    goToStep,
    skip: finish,
  };
}
