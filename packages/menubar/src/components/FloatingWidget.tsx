import { getCurrentWindow } from "@tauri-apps/api/window";
import type { TraySeverity, PylonAlert } from "../lib/alerts";
import type { DashboardState } from "../lib/types";
import type { WidgetState } from "../hooks/useWidgetState";
import { FaviconIcon } from "./FaviconIcon";
import { SummaryPill } from "./SummaryPill";
import { ExpandedCard } from "./ExpandedCard";

interface FloatingWidgetProps {
  widget: WidgetState;
  severity: TraySeverity;
  state: DashboardState | null;
  alerts: PylonAlert[];
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function FloatingWidget({
  widget,
  severity,
  state,
  alerts,
  connected,
  loading,
  error,
}: FloatingWidgetProps) {
  // Drag-or-click: start drag only after 3px of movement, otherwise treat as click
  const handleMouseDown = (e: React.MouseEvent) => {
    if (widget.tier === "card") return; // Card has its own drag handler on the header
    if (e.button !== 0) return;

    const startX = e.screenX;
    const startY = e.screenY;

    const onMove = (moveE: MouseEvent) => {
      if (Math.abs(moveE.screenX - startX) > 3 || Math.abs(moveE.screenY - startY) > 3) {
        cleanup();
        getCurrentWindow().startDragging();
      }
    };

    const onUp = () => {
      cleanup();
      // No significant movement → treat as click
      widget.onClickFavicon();
    };

    const cleanup = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  return (
    <div
      // Nearly-invisible bg forces macOS to deliver mouse events to transparent window areas
      style={{ background: "rgba(0,0,0,0.01)" }}
      onMouseEnter={widget.onHoverEnter}
      onMouseLeave={widget.onHoverLeave}
      onMouseDown={handleMouseDown}
    >
      {widget.tier === "favicon" && (
        <FaviconIcon severity={severity} />
      )}
      {widget.tier === "pill" && (
        <SummaryPill
          severity={severity}
          state={state}
          connected={connected}
        />
      )}
      {widget.tier === "card" && (
        <ExpandedCard
          severity={severity}
          state={state}
          alerts={alerts}
          connected={connected}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
}
