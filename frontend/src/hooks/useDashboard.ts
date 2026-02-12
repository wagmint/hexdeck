"use client";

import { useEffect, useState, useCallback } from "react";
import { getDashboardState } from "@/lib/dashboard-api";
import type { DashboardState } from "@/lib/dashboard-types";

interface UseDashboardResult {
  state: DashboardState | null;
  loading: boolean;
  error: string | null;
}

export function useDashboard(intervalMs = 3000): UseDashboardResult {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getDashboardState();
      setState(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, intervalMs);
    return () => clearInterval(interval);
  }, [refresh, intervalMs]);

  return { state, loading, error };
}
