"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { RelayTargetInfo, ActiveProject } from "@hexdeck/dashboard-ui";
import {
  getRelayTargets,
  connectRelay as apiConnect,
  removeRelayTarget,
  includeProject as apiInclude,
  excludeProject as apiExclude,
  pollClaimStatus,
  cancelClaim,
  type ConnectResult,
} from "@/lib/relay-api";
import { getActiveSessions } from "@/lib/api";

export interface PendingOnboarding {
  claimId: string;
  hexcoreName: string;
  hexcoreId: string;
  joinUrl: string;
}

interface UseRelayResult {
  targets: RelayTargetInfo[];
  activeProjects: ActiveProject[];
  pendingOnboarding: PendingOnboarding | null;
  connect: (link: string) => Promise<ConnectResult>;
  remove: (hexcoreId: string) => void;
  toggleProject: (hexcoreId: string, projectPath: string, include: boolean) => void;
  cancelOnboarding: () => void;
  openJoinUrl: () => void;
}

const CLAIM_POLL_INTERVAL = 3000;

export function useRelay(isOpen: boolean): UseRelayResult {
  const [targets, setTargets] = useState<RelayTargetInfo[]>([]);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [pendingOnboarding, setPendingOnboarding] = useState<PendingOnboarding | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const claimPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Main data polling
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

  // Claim status polling (when onboarding is active)
  useEffect(() => {
    if (!pendingOnboarding) {
      if (claimPollRef.current) {
        clearInterval(claimPollRef.current);
        claimPollRef.current = null;
      }
      return;
    }

    const poll = async () => {
      try {
        const result = await pollClaimStatus(pendingOnboarding.claimId);
        if (result.status === "completed") {
          setPendingOnboarding(null);
          fetchData(); // Refresh targets to show the new connection
        } else if (result.status === "expired") {
          setPendingOnboarding(null);
        }
      } catch {
        // Keep polling
      }
    };

    // Poll immediately, then on interval
    poll();
    claimPollRef.current = setInterval(poll, CLAIM_POLL_INTERVAL);

    return () => {
      if (claimPollRef.current) {
        clearInterval(claimPollRef.current);
        claimPollRef.current = null;
      }
    };
  }, [pendingOnboarding, fetchData]);

  const connect = useCallback(async (link: string): Promise<ConnectResult> => {
    const result = await apiConnect(link);
    if (result.error) return result;

    if (result.needsOnboarding && result.claimId && result.hexcoreName && result.hexcoreId && result.joinUrl) {
      setPendingOnboarding({
        claimId: result.claimId,
        hexcoreName: result.hexcoreName,
        hexcoreId: result.hexcoreId,
        joinUrl: result.joinUrl,
      });
      return result;
    }

    // Legacy flow — already connected
    fetchData();
    return result;
  }, [fetchData]);

  const remove = useCallback((hexcoreId: string) => {
    removeRelayTarget(hexcoreId).then(fetchData).catch(() => {});
  }, [fetchData]);

  const toggleProject = useCallback(
    (hexcoreId: string, projectPath: string, include: boolean) => {
      const fn = include ? apiInclude : apiExclude;
      fn(hexcoreId, projectPath).then(fetchData).catch(() => {});
    },
    [fetchData]
  );

  const cancelOnboardingCb = useCallback(() => {
    if (pendingOnboarding) {
      cancelClaim(pendingOnboarding.claimId).catch(() => {});
      setPendingOnboarding(null);
    }
  }, [pendingOnboarding]);

  const openJoinUrl = useCallback(() => {
    if (pendingOnboarding?.joinUrl) {
      window.open(pendingOnboarding.joinUrl, "_blank");
    }
  }, [pendingOnboarding]);

  return {
    targets,
    activeProjects,
    pendingOnboarding,
    connect,
    remove,
    toggleProject,
    cancelOnboarding: cancelOnboardingCb,
    openJoinUrl,
  };
}
