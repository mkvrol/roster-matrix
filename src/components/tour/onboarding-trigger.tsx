"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { TOUR_STORAGE_KEY } from "./tour-steps";
import { useTour } from "./tour-provider";

export function OnboardingTrigger() {
  const { data: session } = useSession();
  const { startTour, isActive } = useTour();
  const triggered = useRef(false);

  useEffect(() => {
    if (triggered.current || isActive || !session) return;

    const dismissed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (dismissed) return;

    triggered.current = true;
    // Short delay so DOM elements are rendered
    const timer = setTimeout(startTour, 800);
    return () => clearTimeout(timer);
  }, [session, startTour, isActive]);

  return null;
}
