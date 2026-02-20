"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { RelayTargetInfo, ActiveProject } from "@pylon-dev/dashboard-ui";
import {
  getRelayTargets,
  connectRelay as apiConnect,
  removeRelayTarget,
  includeProject as apiInclude,
  excludeProject as apiExclude,
} from "@/lib/relay-api";
import { getActiveSessions } from "@/lib/api";

interface UseRelayResult {
  targets: RelayTargetInfo[];
  activeProjects: ActiveProject[];
  connect: (link: string) => Promise<{ error?: string }>;
  remove: (pylonId: string) => void;
  toggleProject: (pylonId: string, projectPath: string, include: boolean) => void;
}

export function useRelay(isOpen: boolean): UseRelayResult {
  const [targets, setTargets] = useState<RelayTargetInfo[]>([]);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [t, sessions] = await Promise.all([
        getRelayTargets(),
        getActiveSessions(),
      ]);
      setTargets(t);

      // Group sessions by project path
      const byProject = new Map<string, number>();
      for (const s of sessions) {
        byProject.set(s.projectPath, (byProject.get(s.projectPath) || 0) + 1);
      }
      setActiveProjects(
        [...byProject.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([projectPath, sessionCount]) => ({ projectPath, sessionCount }))
      );
    } catch {
      // Silently ignore fetch errors
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    fetchData();
    intervalRef.current = setInterval(fetchData, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, fetchData]);

  const connect = useCallback(async (link: string) => {
    const result = await apiConnect(link);
    if (!result.error) fetchData();
    return result;
  }, [fetchData]);

  const remove = useCallback((pylonId: string) => {
    removeRelayTarget(pylonId).then(fetchData).catch(() => {});
  }, [fetchData]);

  const toggleProject = useCallback(
    (pylonId: string, projectPath: string, include: boolean) => {
      const fn = include ? apiInclude : apiExclude;
      fn(pylonId, projectPath).then(fetchData).catch(() => {});
    },
    [fetchData]
  );

  return { targets, activeProjects, connect, remove, toggleProject };
}
