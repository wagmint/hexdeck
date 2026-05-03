"use client";

import { useEffect, useState, useRef } from "react";
import { getDashboardState, SSE_DASHBOARD_URL } from "@/lib/dashboard-api";
import type { DashboardState } from "@hexdeck/dashboard-ui";

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
    let cancelled = false;
    const es = new EventSource(SSE_DASHBOARD_URL);

    void getDashboardState()
      .then((data) => {
        if (cancelled) return;
        setState(data);
        setError(null);
        if (!hasReceivedData.current) {
          hasReceivedData.current = true;
          setLoading(false);
        }
      })
      .catch(() => {
        if (cancelled || hasReceivedData.current) return;
        // Let SSE remain the fallback path before surfacing an error.
      });

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
      cancelled = true;
      es.close();
    };
  }, []);

  return { state, loading, error, connected };
}
