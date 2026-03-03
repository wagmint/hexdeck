export function OnboardingStep2() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-8 pb-4 gap-6">
      {/* 2-tier visual: Favicon → Card */}
      <div className="flex items-end gap-6">
        {/* Favicon tier */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-lg bg-dash-surface border border-dash-border flex items-center justify-center">
            <svg viewBox="0 0 100 100" className="w-9 h-9">
              <polygon
                points="50,8 92,29 92,71 50,92 8,71 8,29"
                fill="none"
                stroke="#4a4a5e"
                strokeWidth="3"
              />
              <polygon
                points="50,32 68,42 68,58 50,68 32,58 32,42"
                fill="#4a4a5e"
              />
            </svg>
          </div>
          <span className="text-[10px] text-dash-text-muted">Favicon</span>
        </div>

        <span className="text-dash-text-muted mb-6 text-lg">&rarr;</span>

        {/* Card tier */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-[140px] h-[96px] rounded-lg bg-dash-surface border border-dash-border flex flex-col p-3 gap-2">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 100 100" className="w-4 h-4 flex-shrink-0">
                <polygon
                  points="50,8 92,29 92,71 50,92 8,71 8,29"
                  fill="none"
                  stroke="#00e87b"
                  strokeWidth="4"
                />
                <polygon
                  points="50,32 68,42 68,58 50,68 32,58 32,42"
                  fill="#00e87b"
                />
              </svg>
              <span className="text-[9px] font-semibold text-dash-text">Hexdeck</span>
              <span className="ml-auto text-[8px] text-dash-text-muted">1 agent</span>
            </div>
            <div className="flex-1 bg-dash-surface-2 rounded" />
          </div>
          <span className="text-[10px] text-dash-text-muted">Card</span>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-dash-text">
          The Floating Widget
        </h2>
        <p className="text-sm text-dash-text-dim leading-relaxed">
          Always visible on your desktop. Click to expand, drag to move.
        </p>
      </div>

      <div className="w-full bg-dash-surface rounded-lg px-5 py-4 space-y-3 text-left">
        <Hint keys={["Click"]} desc="Expand to card" />
        <Hint keys={["Drag"]} desc="Reposition anywhere" />
        <Hint keys={["Esc"]} desc="Collapse back to favicon" />
        <Hint keys={["Cmd", "Ctrl", "K"]} desc="Toggle widget visibility" />
        <Hint keys={["Cmd", "Ctrl", "H"]} desc="Show the card" />
      </div>
    </div>
  );
}

function Hint({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i}>
            <kbd className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-dash-surface-2 text-dash-text-dim border border-dash-border rounded">
              {k}
            </kbd>
            {i < keys.length - 1 && (
              <span className="text-dash-text-muted text-[10px] mx-0.5">+</span>
            )}
          </span>
        ))}
      </div>
      <span className="text-xs text-dash-text-dim">{desc}</span>
    </div>
  );
}
