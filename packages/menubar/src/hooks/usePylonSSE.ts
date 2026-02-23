import { useEffect, useState, useRef } from "react";
import type { DashboardState } from "../lib/types";

const SSE_URL = "http://localhost:3002/api/dashboard/stream";

interface UsePylonSSEResult {
  state: DashboardState | null;
  loading: boolean;
  error: string | null;
  connected: boolean;
}

export function usePylonSSE(): UsePylonSSEResult {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const hasReceivedData = useRef(false);

  useEffect(() => {
    const es = new EventSource(SSE_URL);

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
      if (!hasReceivedData.current) {
        setError("Cannot connect to Pylon server");
        setLoading(false);
      }
    };

    return () => {
      es.close();
    };
  }, []);

  return { state, loading, error, connected };
}
