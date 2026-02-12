"use client";

import { useState, useRef, useEffect } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import type { Collision } from "@/lib/dashboard-types";
import { TopBar } from "@/components/dashboard/TopBar";
import { PanelHeader } from "@/components/dashboard/PanelHeader";
import { AgentCard } from "@/components/dashboard/AgentCard";
import { WorkstreamNode } from "@/components/dashboard/WorkstreamNode";
import { FeedItem } from "@/components/dashboard/FeedItem";
import { CollisionDetail } from "@/components/dashboard/CollisionDetail";
import { ProgressBar } from "@/components/dashboard/ProgressBar";
import { DeviationItem } from "@/components/dashboard/DeviationItem";

export default function DashboardPage() {
  const { state, loading, error } = useDashboard(3000);
  const [selectedCollision, setSelectedCollision] = useState<Collision | null>(null);
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(new Set());
  const isFirstRender = useRef(true);

  // Track seen event IDs for flash-in animation
  useEffect(() => {
    if (!state) return;
    if (isFirstRender.current) {
      // On first render, mark all events as seen (no flash)
      setSeenEventIds(new Set(state.feed.map((e) => e.id)));
      isFirstRender.current = false;
      return;
    }
    // After first render, only newly arrived events get flash
    setSeenEventIds((prev) => {
      const next = new Set(prev);
      for (const e of state.feed) next.add(e.id);
      return next;
    });
  }, [state]);

  // Auto-select first collision when data loads
  useEffect(() => {
    if (state && state.collisions.length > 0 && !selectedCollision) {
      setSelectedCollision(state.collisions[0]);
    }
  }, [state, selectedCollision]);

  if (loading && !state) {
    return (
      <div className="h-screen bg-dash-bg flex items-center justify-center text-dash-text-muted text-sm font-mono">
        Scanning sessions...
      </div>
    );
  }

  if (error && !state) {
    return (
      <div className="h-screen bg-dash-bg flex items-center justify-center text-dash-red text-sm font-mono">
        {error}
      </div>
    );
  }

  if (!state) return null;

  const { workstreams, collisions, feed, summary } = state;

  return (
    <div className="h-screen flex flex-col bg-dash-bg text-dash-text font-mono text-[11px] leading-relaxed overflow-hidden">
      <TopBar summary={summary} />

      <div
        className="flex-1 grid gap-px bg-dash-border"
        style={{ gridTemplateColumns: "260px 1fr 320px" }}
      >
        {/* LEFT PANEL: Workstream / Agent cards */}
        <div className="bg-dash-bg overflow-y-auto scrollbar-thin">
          <PanelHeader
            title="Workstreams"
            count={`${workstreams.length} project${workstreams.length !== 1 ? "s" : ""}`}
          />
          {workstreams.length === 0 ? (
            <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
              No active projects
            </div>
          ) : (
            workstreams.map((ws) => (
              <AgentCard key={ws.projectId} workstream={ws} />
            ))
          )}
        </div>

        {/* CENTER PANEL */}
        <div className="flex flex-col bg-dash-bg">
          {/* Top half: Intent Map + Live Feed */}
          <div className="flex-1 grid grid-cols-2 gap-px bg-dash-border min-h-0">
            {/* Intent Map */}
            <div className="bg-dash-bg overflow-y-auto scrollbar-thin">
              <PanelHeader
                title="Intent Map"
                count={`${workstreams.length} workstream${workstreams.length !== 1 ? "s" : ""}`}
              />
              {workstreams.length === 0 ? (
                <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
                  No workstreams
                </div>
              ) : (
                workstreams.map((ws) => (
                  <WorkstreamNode key={ws.projectId} workstream={ws} />
                ))
              )}
            </div>

            {/* Live Feed */}
            <div className="bg-dash-bg overflow-y-auto scrollbar-thin">
              <PanelHeader title="Live Feed">
                <span className="inline-flex items-center gap-1 bg-dash-green-dim text-dash-green text-[8px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">
                  <span className="w-1 h-1 rounded-full bg-dash-green animate-dash-pulse" />
                  streaming
                </span>
              </PanelHeader>
              {feed.length === 0 ? (
                <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
                  No events yet
                </div>
              ) : (
                feed.map((event) => (
                  <FeedItem
                    key={event.id}
                    event={event}
                    isNew={!isFirstRender.current && !seenEventIds.has(event.id)}
                    onClick={
                      event.collisionId
                        ? () => {
                            const col = collisions.find(
                              (c) => c.id === event.collisionId
                            );
                            if (col) setSelectedCollision(col);
                          }
                        : undefined
                    }
                  />
                ))
              )}
            </div>
          </div>

          {/* Bottom: Collision Detail */}
          <div className="h-[200px] shrink-0 border-t border-dash-border bg-dash-surface overflow-hidden">
            <CollisionDetail collision={selectedCollision} />
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex flex-col gap-px bg-dash-border">
          {/* Sprint Progress */}
          <div className="flex-1 bg-dash-bg overflow-y-auto scrollbar-thin">
            <PanelHeader
              title="Progress"
              count={`${summary.totalCommits} commit${summary.totalCommits !== 1 ? "s" : ""}`}
            />
            {workstreams.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
                No workstreams
              </div>
            ) : (
              workstreams.map((ws) => (
                <ProgressBar key={ws.projectId} workstream={ws} />
              ))
            )}
          </div>

          {/* Deviation Log */}
          <div className="flex-1 bg-dash-bg overflow-y-auto scrollbar-thin">
            <PanelHeader
              title="Deviations"
              count={`${collisions.length} active`}
            />
            {collisions.length === 0 ? (
              <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
                No deviations detected
              </div>
            ) : (
              collisions.map((col) => (
                <DeviationItem key={col.id} collision={col} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
