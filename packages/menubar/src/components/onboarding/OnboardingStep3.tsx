import { GlowHex } from "../GlowHex";

export function OnboardingStep3() {
  return (
    <div className="flex flex-col items-center text-center px-8 pt-8 pb-4 gap-6">
      <GlowHex severity="blue" size={16} className="animate-dash-breathe" />

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-dash-text">
          Remote Approvals
        </h2>
        <p className="text-sm text-dash-text-dim leading-relaxed">
          When an agent needs permission, the hex turns blue.
          Expand the widget to approve or deny — or just press Enter to approve.
        </p>
      </div>

      {/* Mock approve/deny UI */}
      <div className="w-full bg-dash-surface rounded-lg px-5 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-dash-blue flex-shrink-0" />
          <span className="text-xs text-dash-text">Needs approval</span>
        </div>
        <div className="bg-dash-surface-2 rounded-md p-3 text-left">
          <p className="text-[11px] text-dash-text-dim">
            Agent wants to run:
          </p>
          <p className="text-xs text-dash-text font-mono mt-1">
            npm install react-router
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 rounded-md bg-dash-green/20 text-dash-green text-xs font-medium cursor-default"
            tabIndex={-1}
          >
            Approve
          </button>
          <button
            className="flex-1 py-2 rounded-md bg-dash-red/20 text-dash-red text-xs font-medium cursor-default"
            tabIndex={-1}
          >
            Deny
          </button>
        </div>
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <kbd className="inline-block px-1.5 py-0.5 text-[10px] font-mono bg-dash-surface-2 text-dash-text-dim border border-dash-border rounded">
            Enter
          </kbd>
          <span className="text-[11px] text-dash-text-muted">to quickly approve</span>
        </div>
      </div>
    </div>
  );
}
