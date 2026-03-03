"use client";

interface TourOverlayProps {
  targetRect: DOMRect | null;
  onClick: () => void;
}

const PADDING = 8;
const RADIUS = 8;

export function TourOverlay({ targetRect, onClick }: TourOverlayProps) {
  if (!targetRect) return null;

  const x = targetRect.x - PADDING;
  const y = targetRect.y - PADDING;
  const w = targetRect.width + PADDING * 2;
  const h = targetRect.height + PADDING * 2;

  return (
    <svg
      className="fixed inset-0 w-full h-full z-40 tour-spotlight-in"
      style={{ pointerEvents: "auto" }}
      onClick={onClick}
    >
      <defs>
        <mask id="tour-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect
            x={x}
            y={y}
            width={w}
            height={h}
            rx={RADIUS}
            ry={RADIUS}
            fill="black"
          />
        </mask>
      </defs>
      {/* Dark overlay with cutout */}
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.6)"
        mask="url(#tour-mask)"
      />
      {/* Cutout border glow */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={RADIUS}
        ry={RADIUS}
        fill="none"
        stroke="var(--dash-blue)"
        strokeWidth="1"
        strokeOpacity="0.5"
        style={{ pointerEvents: "none" }}
      />
    </svg>
  );
}
