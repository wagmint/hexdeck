"use client";

import { useState } from "react";
import type { TurnNode, TurnSections } from "@/lib/types";
import {
  X,
  Target,
  Route,
  GitFork,
  Search,
  Hammer,
  ShieldAlert,
  Package,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  GitCommit,
  Layers,
} from "lucide-react";

interface NodePanelProps {
  turn: TurnNode;
  onClose: () => void;
}

export function NodePanel({ turn, onClose }: NodePanelProps) {
  const { sections } = turn;

  return (
    <div className="fixed right-0 top-[53px] bottom-0 w-[400px] bg-card border-l border-border overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">
            Turn #{turn.index}
          </span>
          {turn.hasCommit && (
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
          )}
          {turn.hasCompaction && (
            <Layers className="w-3.5 h-3.5 text-yellow-400" />
          )}
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded hover:bg-secondary"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-3 space-y-1">
        <SectionRow
          icon={<Target className="w-3.5 h-3.5 text-primary" />}
          label="Goal"
          summary={sections.goal.summary}
          hasDetails={!!sections.goal.fullInstruction}
        >
          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {sections.goal.fullInstruction || "(no instruction)"}
          </p>
        </SectionRow>

        <SectionRow
          icon={<Route className="w-3.5 h-3.5 text-blue-400" />}
          label="Approach"
          summary={sections.approach.summary}
          hasDetails={!!sections.approach.thinking}
          dimIfEmpty
        >
          {sections.approach.thinking ? (
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {sections.approach.thinking}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">No thinking blocks captured</p>
          )}
        </SectionRow>

        <SectionRow
          icon={<GitFork className="w-3.5 h-3.5 text-purple-400" />}
          label="Decisions"
          summary={sections.decisions.summary}
          hasDetails={sections.decisions.items.length > 0}
          dimIfEmpty
        >
          {sections.decisions.items.length > 0 ? (
            <div className="space-y-2">
              {sections.decisions.items.map((d, i) => (
                <div key={i} className="text-xs">
                  <p className="text-foreground">{d.choice}</p>
                  {d.reasoning && (
                    <p className="text-muted-foreground mt-0.5 italic">{d.reasoning}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No explicit decisions detected</p>
          )}
        </SectionRow>

        <SectionRow
          icon={<Search className="w-3.5 h-3.5 text-cyan-400" />}
          label="Research"
          summary={sections.research.summary}
          hasDetails={sections.research.filesRead.length > 0 || sections.research.searches.length > 0}
          dimIfEmpty
        >
          <div className="space-y-2">
            {sections.research.filesRead.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Files Read</p>
                <div className="space-y-0.5">
                  {sections.research.filesRead.map((f, i) => (
                    <div key={i} className="font-mono text-xs text-muted-foreground truncate">{f}</div>
                  ))}
                </div>
              </div>
            )}
            {sections.research.searches.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Searches</p>
                <div className="space-y-0.5">
                  {sections.research.searches.map((s, i) => (
                    <div key={i} className="font-mono text-xs text-muted-foreground truncate">{s}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionRow>

        <SectionRow
          icon={<Hammer className="w-3.5 h-3.5 text-orange-400" />}
          label="Actions"
          summary={sections.actions.summary}
          hasDetails={sections.actions.edits.length > 0 || sections.actions.creates.length > 0 || sections.actions.commands.length > 0}
          dimIfEmpty
        >
          <div className="space-y-2">
            {sections.actions.creates.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                <div className="space-y-0.5">
                  {sections.actions.creates.map((f, i) => (
                    <div key={i} className="font-mono text-xs text-emerald-400/80 truncate">{f}</div>
                  ))}
                </div>
              </div>
            )}
            {sections.actions.edits.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Edited</p>
                <div className="space-y-0.5">
                  {sections.actions.edits.map((f, i) => (
                    <div key={i} className="font-mono text-xs text-muted-foreground truncate">{f}</div>
                  ))}
                </div>
              </div>
            )}
            {sections.actions.commands.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commands</p>
                <div className="space-y-0.5">
                  {sections.actions.commands.map((c, i) => (
                    <div key={i} className="font-mono text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded truncate">{c}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionRow>

        <SectionRow
          icon={<ShieldAlert className="w-3.5 h-3.5 text-red-400" />}
          label="Corrections"
          summary={sections.corrections.summary}
          hasDetails={sections.corrections.items.length > 0}
          dimIfEmpty
          accentColor={sections.corrections.items.length > 0 ? "text-red-400" : undefined}
        >
          {sections.corrections.items.length > 0 ? (
            <div className="space-y-2">
              {sections.corrections.items.map((c, i) => (
                <div key={i} className="text-xs border-l-2 border-red-400/30 pl-2">
                  <p className="text-red-400/80 font-mono truncate">{c.error}</p>
                  <p className="text-muted-foreground mt-0.5">{c.fix}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No errors</p>
          )}
        </SectionRow>

        <SectionRow
          icon={<Package className="w-3.5 h-3.5 text-emerald-400" />}
          label="Artifacts"
          summary={sections.artifacts.summary}
          hasDetails={sections.artifacts.filesChanged.length > 0 || sections.artifacts.commits.length > 0}
          dimIfEmpty
        >
          <div className="space-y-2">
            {sections.artifacts.commits.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Commits</p>
                {sections.artifacts.commits.map((c, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <GitCommit className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="font-mono text-xs text-emerald-400/80 truncate">{c}</span>
                  </div>
                ))}
              </div>
            )}
            {sections.artifacts.filesChanged.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Files Changed</p>
                <div className="space-y-0.5">
                  {sections.artifacts.filesChanged.map((f, i) => (
                    <div key={i} className="font-mono text-xs text-muted-foreground truncate">{f}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionRow>

        <SectionRow
          icon={<HelpCircle className="w-3.5 h-3.5 text-yellow-400" />}
          label="Escalations"
          summary={sections.escalations.summary}
          hasDetails={sections.escalations.questions.length > 0}
          dimIfEmpty
        >
          {sections.escalations.questions.length > 0 ? (
            <div className="space-y-1.5">
              {sections.escalations.questions.map((q, i) => (
                <p key={i} className="text-xs text-muted-foreground italic">&ldquo;{q}&rdquo;</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No escalations</p>
          )}
        </SectionRow>

        {/* JSONL position */}
        <div className="pt-2 mt-2 border-t border-border">
          <span className="font-mono text-[10px] text-muted-foreground">
            JSONL lines {turn.startLine}&ndash;{turn.endLine}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Section Row Component ───────────────────────────────────────────────────

function SectionRow({
  icon,
  label,
  summary,
  hasDetails,
  dimIfEmpty,
  accentColor,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  summary: string;
  hasDetails: boolean;
  dimIfEmpty?: boolean;
  accentColor?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const isEmpty = summary.startsWith("(");
  const isDimmed = dimIfEmpty && isEmpty;

  return (
    <div className={`rounded-md ${isDimmed ? "opacity-40" : ""}`}>
      <button
        onClick={() => hasDetails && setOpen(!open)}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
          hasDetails ? "hover:bg-secondary/50 cursor-pointer" : "cursor-default"
        }`}
      >
        {icon}
        <span className={`text-[11px] font-medium uppercase tracking-wider w-[80px] shrink-0 ${accentColor ?? "text-muted-foreground"}`}>
          {label}
        </span>
        <span className="text-xs text-foreground truncate flex-1">
          {summary}
        </span>
        {hasDetails && (
          open ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
          )
        )}
      </button>
      {open && (
        <div className="px-2 pb-2 pt-1 ml-[26px]">
          {children}
        </div>
      )}
    </div>
  );
}
