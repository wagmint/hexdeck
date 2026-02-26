import { useEffect, useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { DashboardState } from "../lib/types";

const SSE_URL = "http://localhost:7433/api/dashboard/stream";
const INITIAL_RETRY_MS = 2000;
const MAX_RETRY_MS = 10000;

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
  const retryDelay = useRef(INITIAL_RETRY_MS);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const hasTriedEnsure = useRef(false);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.addEventListener("state", (e) => {
      try {
        const data: DashboardState = JSON.parse(e.data);
        setState(data);
        setError(null);
        if (!hasReceivedData.current) {
          hasReceivedData.current = true;
          setLoading(false);
        }
        // Reset retry delay on successful data
        retryDelay.current = INITIAL_RETRY_MS;
      } catch {
        setError("Failed to parse dashboard state");
      }
    });

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setConnected(false);

      if (!hasReceivedData.current) {
        setError("Starting server...");
        setLoading(false);
      }

      // On first error, ask the backend to ensure the server is running
      if (!hasTriedEnsure.current) {
        hasTriedEnsure.current = true;
        invoke("ensure_server").catch(() => {});
      }

      // Schedule reconnect with exponential backoff
      if (mountedRef.current) {
        const delay = retryDelay.current;
        retryDelay.current = Math.min(delay * 1.5, MAX_RETRY_MS);
        retryTimer.current = setTimeout(connect, delay);
      }
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [connect]);

  return { state, loading, error, connected };
}
