import { GlowHex } from "../GlowHex";
import { ColorLegendContent } from "./ColorLegendContent";

export function OnboardingStep1() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-8 pb-4 gap-6">
      <GlowHex severity="green" size={16} />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-dash-text">
          Welcome to Hexdeck
        </h2>
        <p className="text-sm text-dash-text-dim leading-relaxed">
          Monitor your Claude Code and Codex sessions in real-time.
          The hex color tells you what's happening at a glance.
        </p>
      </div>

      <div className="w-full bg-dash-surface rounded-lg px-5 py-4">
        <ColorLegendContent />
      </div>
    </div>
  );
}
