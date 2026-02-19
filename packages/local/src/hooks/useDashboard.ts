"use client";

import { useEffect, useState, useRef } from "react";
import { SSE_DASHBOARD_URL } from "@/lib/dashboard-api";
import type { DashboardState } from "@pylon-dev/dashboard-ui";

interface UseDashboardResult {
  state: DashboardState | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
}

export function useDashboard(): UseDashboardResult {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const hasReceivedData = useRef(false);

  useEffect(() => {
    const es = new EventSource(SSE_DASHBOARD_URL);

    es.addEventListener("state", (e) => {
      try {
        const data: DashboardState = JSON.parse(e.data);
        setState(data);
        setError(null);
        if (!hasReceivedData.current) {
          hasReceivedData.current = true;
          setLoading(false);
        }
      } catch {
        setError("Failed to parse dashboard state");
      }
    });

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects; only set error if we never got data
      if (!hasReceivedData.current) {
        setError("Connection to dashboard failed");
        setLoading(false);
      }
    };

    return () => {
      es.close();
    };
  }, []);

  return { state, loading, error, connected };
}
