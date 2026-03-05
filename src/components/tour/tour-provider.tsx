"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { TOUR_STEPS, TOUR_STORAGE_KEY } from "./tour-steps";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

interface TourContextValue {
  startTour: () => void;
  isActive: boolean;
}

const TourContext = createContext<TourContextValue>({
  startTour: () => {},
  isActive: false,
});

export function useTour() {
  return useContext(TourContext);
}

// lg breakpoint — below this the sidebar is hidden behind hamburger
const MOBILE_BREAKPOINT = 1024;

/** Check if a DOMRect is actually visible in the viewport */
function isRectVisible(rect: DOMRect): boolean {
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < window.innerWidth &&
    rect.top < window.innerHeight
  );
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [dontShow, setDontShow] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const step = TOUR_STEPS[stepIndex];

  // Track mobile state
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const dismiss = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    setTargetRect(null);
    if (dontShow) {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    }
  }, [dontShow]);

  const next = useCallback(() => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
      setActive(false);
      setStepIndex(0);
      setTargetRect(null);
    }
  }, [stepIndex]);

  const prev = useCallback(() => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  }, [stepIndex]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  // Poll for target element whenever step changes
  useEffect(() => {
    if (!active || !step) return;

    if (pollRef.current) clearInterval(pollRef.current);

    // On mobile, skip anchor positioning entirely — always use centered card
    if (isMobile) {
      setTargetRect(null);
      return;
    }

    let attempts = 0;
    const maxAttempts = 30; // 3 seconds

    const find = () => {
      const el = document.querySelector(step.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (isRectVisible(rect)) {
          setTargetRect(rect);
          if (pollRef.current) clearInterval(pollRef.current);
          return;
        }
      }
      attempts++;
      if (attempts >= maxAttempts) {
        // Element not found or not visible — use centered fallback
        setTargetRect(null);
        if (pollRef.current) clearInterval(pollRef.current);
      }
    };

    find();
    pollRef.current = setInterval(find, 100);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [active, step, stepIndex, isMobile]);

  // Update position on scroll/resize (desktop only)
  useEffect(() => {
    if (!active || isMobile) return;
    const update = () => {
      if (!step) return;
      const el = document.querySelector(step.selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (isRectVisible(rect)) {
          setTargetRect(rect);
        } else {
          setTargetRect(null);
        }
      }
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, step, isMobile]);

  // Escape key to dismiss
  useEffect(() => {
    if (!active) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [active, dismiss]);

  return (
    <TourContext.Provider value={{ startTour, isActive: active }}>
      {children}
      {active && step && <TourOverlay
        step={step}
        stepIndex={stepIndex}
        totalSteps={TOUR_STEPS.length}
        targetRect={targetRect}
        dontShow={dontShow}
        isMobile={isMobile}
        onDontShowChange={setDontShow}
        onNext={next}
        onPrev={prev}
        onDismiss={dismiss}
      />}
    </TourContext.Provider>
  );
}

function TourOverlay({
  step,
  stepIndex,
  totalSteps,
  targetRect,
  dontShow,
  isMobile,
  onDontShowChange,
  onNext,
  onPrev,
  onDismiss,
}: {
  step: (typeof TOUR_STEPS)[number];
  stepIndex: number;
  totalSteps: number;
  targetRect: DOMRect | null;
  dontShow: boolean;
  isMobile: boolean;
  onDontShowChange: (v: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onDismiss: () => void;
}) {
  const isLast = stepIndex === totalSteps - 1;
  const isCentered = isMobile || !targetRect;

  // Calculate tooltip position
  const tooltipStyle = isCentered
    ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } as React.CSSProperties
    : getTooltipPosition(targetRect!, step.placement);

  return (
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop — click to dismiss */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onDismiss}
      />

      {/* Target highlight — desktop only when element is visible */}
      {targetRect && !isMobile && (
        <div
          className="absolute rounded-md ring-2 ring-accent"
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            backgroundColor: "transparent",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
            zIndex: 1,
          }}
        />
      )}

      {/* Tooltip / Card */}
      <div
        className={
          isCentered
            ? "absolute z-10 w-[min(360px,calc(100vw-32px))] rounded-lg border border-border-subtle bg-surface-1 p-5 shadow-xl"
            : "absolute z-10 w-80 rounded-lg border border-border-subtle bg-surface-1 p-4 shadow-xl"
        }
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div>
            <span className="rounded bg-accent/20 px-1.5 py-0.5 text-data-xs font-medium text-accent">
              {stepIndex + 1} of {totalSteps}
            </span>
            <h3 className={isCentered
              ? "mt-2 text-base font-semibold text-text-primary"
              : "mt-1.5 text-sm font-semibold text-text-primary"
            }>
              {step.title}
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text-secondary"
            aria-label="Close tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <p className={isCentered
          ? "text-data-sm leading-relaxed text-text-secondary"
          : "text-data-sm leading-relaxed text-text-secondary"
        }>
          {step.body}
        </p>

        {/* Don't show again */}
        <label className="mt-3 flex items-center gap-2 text-data-xs text-text-muted">
          <input
            type="checkbox"
            checked={dontShow}
            onChange={(e) => onDontShowChange(e.target.checked)}
            className="rounded border-border-subtle"
          />
          Don&apos;t show again
        </label>

        {/* Controls */}
        <div className="mt-3 flex items-center justify-between border-t border-border-subtle pt-3">
          <button
            onClick={onDismiss}
            className="text-data-xs text-text-muted transition-colors hover:text-text-secondary"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && (
              <button
                onClick={onPrev}
                className="flex items-center gap-1 rounded-md border border-border-subtle px-3 py-1.5 text-data-xs font-medium text-text-secondary transition-colors hover:bg-surface-2"
              >
                <ChevronLeft className="h-3 w-3" />
                Back
              </button>
            )}
            <button
              onClick={onNext}
              className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-data-xs font-medium text-white transition-colors hover:bg-accent-hover"
            >
              {isLast ? "Finish" : "Next"}
              {!isLast && <ChevronRight className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTooltipPosition(
  rect: DOMRect,
  placement?: "top" | "bottom" | "left" | "right",
): React.CSSProperties {
  const gap = 12;
  const tooltipWidth = 320;

  switch (placement) {
    case "top":
      return {
        bottom: window.innerHeight - rect.top + gap,
        left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
      };
    case "left":
      return {
        top: Math.max(16, rect.top),
        right: window.innerWidth - rect.left + gap,
      };
    case "right":
      return {
        top: Math.max(16, rect.top),
        left: rect.right + gap,
      };
    case "bottom":
    default:
      return {
        top: rect.bottom + gap,
        left: Math.max(16, rect.left + rect.width / 2 - tooltipWidth / 2),
      };
  }
}
