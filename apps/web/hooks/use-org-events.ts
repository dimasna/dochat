"use client";

import { useEffect, useRef } from "react";
import type { OrgEvent } from "@/lib/event-bus";

export type { OrgEvent };

/**
 * Subscribe to real-time org events via SSE.
 * Calls `onEvent` whenever the server pushes a status change.
 */
export function useOrgEvents(onEvent: (event: OrgEvent) => void) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.onmessage = (e) => {
      try {
        const event: OrgEvent = JSON.parse(e.data);
        callbackRef.current(event);
      } catch {
        // Ignore malformed events
      }
    };

    return () => {
      es.close();
    };
  }, []);
}
