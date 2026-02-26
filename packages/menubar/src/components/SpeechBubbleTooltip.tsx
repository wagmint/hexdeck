interface SpeechBubbleTooltipProps {
  onDismiss: () => void;
}

export function SpeechBubbleTooltip({ onDismiss }: SpeechBubbleTooltipProps) {
  return (
    <div
      className="animate-tooltip-in flex items-center"
      onClick={onDismiss}
      style={{ cursor: "pointer" }}
    >
      {/* Bubble */}
      <div className="relative bg-dash-surface border border-dash-border rounded-lg px-3 py-2 shadow-lg max-w-[250px]">
        <p className="text-dash-text text-[11px] font-medium leading-snug">
          Hexdeck is running here
        </p>
        <p className="text-dash-text-dim text-[10px] leading-snug mt-1">
          Drag me anywhere. Hover to peek, click for details.
        </p>
        <p className="text-dash-text-dim text-[10px] leading-snug">
          Toggle with{" "}
          <kbd className="text-dash-text bg-dash-surface-2 px-1 rounded text-[9px]">
            Cmd+Ctrl+K
          </kbd>{" "}
          or from the tray icon.
        </p>
      </div>

      {/* Right-pointing arrow */}
      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-dash-border -ml-px" />
    </div>
  );
}
