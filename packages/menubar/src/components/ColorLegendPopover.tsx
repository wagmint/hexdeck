import { useState, useEffect, useRef } from "react";
import { ColorLegendContent } from "./onboarding/ColorLegendContent";

export function ColorLegendPopover() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Close on Escape (capture phase so it doesn't collapse the card)
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="text-dash-text-muted hover:text-dash-text transition-colors text-sm leading-none w-5 h-5 rounded hover:bg-dash-surface-2 flex items-center justify-center"
        aria-label="Color legend"
        title="Color legend"
      >
        ?
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-[220px] bg-dash-surface border border-dash-border rounded-lg p-3 shadow-lg z-50 animate-fade-in">
          <p className="text-[10px] text-dash-text-muted uppercase tracking-wider font-medium mb-2">
            Status Colors
          </p>
          <ColorLegendContent compact />
        </div>
      )}
    </div>
  );
}
