"use client";

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

export function usePageView(page: string) {
  const tracked = useRef(false);
  const track = trpc.analytics.track.useMutation();

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track.mutate({ eventType: "PAGE_VIEW", metadata: { page } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
}
