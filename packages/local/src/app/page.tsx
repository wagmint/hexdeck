"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useDashboard } from "@/hooks/useDashboard";
import type { Collision } from "@pylon-dev/dashboard-ui";
import {
  OperatorProvider,
  TopBar,
  PanelHeader,
  AgentCard,
  WorkstreamNode,
  FeedItem,
  CollisionDetail,
  PlanDetail,
  RiskPanel,
} from "@pylon-dev/dashboard-ui";

export default function DashboardPage() {
  const { state, loading, error, connected } = useDashboard();
  const [selectedCollision, setSelectedCollision] = useState<Collision | null>(null);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [seenEventIds, setSeenEventIds] = useState<Set<string>>(new Set());
  const isFirstRender = useRef(true);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(400);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const makeResizeHandler = useCallback(
    (setter: (h: number) => void, currentHeight: number, min = 80) =>
      (e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        dragStartY.current = e.clientY;
        dragStartHeight.current = currentHeight;
        const maxH = Math.floor(window.innerHeight * 0.9);

        const onMouseMove = (ev: MouseEvent) => {
          if (!isDragging.current) return;
          const delta = dragStartY.current - ev.clientY;
          setter(Math.min(Math.max(dragStartHeight.current + delta, min), maxH));
        };

        const onMouseUp = () => {
          isDragging.current = false;
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
      },
    []
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => makeResizeHandler(setBottomPanelHeight, bottomPanelHeight)(e),
    [bottomPanelHeight, makeResizeHandler]
  );


  // Workstream focus filter
  const toggleWorkstream = useCallback((projectPath: string) => {
    setSelectedProjectPath(prev => prev === projectPath ? null : projectPath);
  }, []);

  // Escape key clears workstream filter
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedProjectPath(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const { operators, agents, workstreams, collisions, feed, summary } = state;

  const isFiltered = selectedProjectPath !== null;
  const filteredWorkstreams = isFiltered
    ? workstreams.filter(ws => ws.projectPath === selectedProjectPath)
    : workstreams;
  const filteredFeed = isFiltered
    ? feed.filter(e => e.projectPath === selectedProjectPath)
    : feed;
  const filteredAgents = isFiltered
    ? agents.filter(a => a.projectPath === selectedProjectPath)
    : agents;
  const filteredCollisions = isFiltered
    ? collisions.filter(c => c.agents.some(a => a.projectPath === selectedProjectPath))
    : collisions;
  const selectedName = isFiltered
    ? workstreams.find(ws => ws.projectPath === selectedProjectPath)?.name
    : null;

  return (
    <OperatorProvider operators={operators}>
    <div className="h-screen flex flex-col bg-dash-bg text-dash-text font-mono text-[11px] leading-relaxed overflow-hidden">
      <TopBar summary={summary} operators={operators} />

      <div
        className="flex-1 grid gap-px bg-dash-border min-h-0"
        style={{ gridTemplateColumns: "260px 1fr 320px", gridTemplateRows: "1fr" }}
      >
        {/* LEFT PANEL: Workstream / Agent cards */}
        <div className="relative z-20 bg-dash-bg overflow-y-auto scrollbar-thin">
          <PanelHeader
            title={isFiltered && selectedName ? `Filtered: ${selectedName}` : "Workstreams"}
            count={isFiltered ? undefined : `${workstreams.length} project${workstreams.length !== 1 ? "s" : ""}`}
          >
            {isFiltered && (
              <button
                onClick={() => setSelectedProjectPath(null)}
                className="bg-dash-surface-3 px-1.5 py-0.5 rounded text-dash-text-dim font-normal tracking-normal normal-case hover:text-dash-text transition-colors"
              >
                ✕ clear
              </button>
            )}
          </PanelHeader>
          {workstreams.length === 0 ? (
            <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
              No active projects
            </div>
          ) : (
            workstreams.map((ws) => (
              <AgentCard
                key={ws.projectId}
                workstream={ws}
                isSelected={selectedProjectPath === ws.projectPath}
                onSelect={toggleWorkstream}
              />
            ))
          )}
        </div>

        {/* CENTER PANEL */}
        <div className="flex flex-col bg-dash-bg min-h-0">
          {/* Top half: Intent Map + Live Feed */}
          <div className="flex-1 grid grid-cols-2 gap-px bg-dash-border min-h-0">
            {/* Intent Map */}
            <div className="bg-dash-bg overflow-y-auto scrollbar-thin">
              <PanelHeader
                title="Intent Map"
                count={`${filteredWorkstreams.length} workstream${filteredWorkstreams.length !== 1 ? "s" : ""}`}
              />
              {filteredWorkstreams.length === 0 ? (
                <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
                  No workstreams
                </div>
              ) : (
                filteredWorkstreams.map((ws) => (
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
              {filteredFeed.length === 0 ? (
                <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
                  No events yet
                </div>
              ) : (
                filteredFeed.map((event) => (
                  <FeedItem
                    key={event.id}
                    event={event}
                    isNew={!isFirstRender.current && !seenEventIds.has(event.id)}
                    onClick={
                      event.collisionId
                        ? () => {
                            const col = filteredCollisions.find(
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

          {/* Bottom: Plan / Collision Detail (resizable) */}
          <div className="shrink-0 bg-dash-surface overflow-hidden" style={{ height: bottomPanelHeight }}>
            {/* Drag handle */}
            <div
              onMouseDown={onResizeStart}
              className="h-5 cursor-row-resize border-t border-dash-border hover:bg-dash-surface-2 active:bg-dash-blue/20 transition-colors flex flex-col items-center justify-center gap-[3px]"
            >
              <span className="block w-8 border-t border-dash-text-muted/40" />
              <span className="block w-8 border-t border-dash-text-muted/40" />
              <span className="block w-8 border-t border-dash-text-muted/40" />
            </div>
            {selectedCollision ? (
              <CollisionDetail collision={selectedCollision} onDismiss={() => setSelectedCollision(null)} />
            ) : (
              <PlanDetail workstreams={filteredWorkstreams} />
            )}
          </div>
        </div>

        {/* RIGHT PANEL: Risk Analytics */}
        <div className="bg-dash-bg overflow-y-auto scrollbar-thin">
          <PanelHeader
            title="Risk"
            count={`${summary.agentsAtRisk} at risk`}
          />
          {filteredAgents.length === 0 ? (
            <div className="px-3.5 py-8 text-center text-dash-text-muted text-xs">
              No agents to analyze
            </div>
          ) : (
            <RiskPanel agents={filteredAgents} />
          )}
        </div>
      </div>
    </div>
    </OperatorProvider>
  );
}
