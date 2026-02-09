"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { TurnNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TurnCategory } from "@/lib/types";
import {
  MessageSquare,
  GitCommit,
  Layers,
  FileCode,
  Wrench,
  HelpCircle,
  MessageCircle,
  Terminal,
  Zap,
  ArrowRight,
  Pause,
  Share2,
} from "lucide-react";

// ─── Custom Node Component ──────────────────────────────────────────────────

type TurnNodeData = {
  turn: TurnNode;
  selected: boolean;
};

const categoryConfig: Record<TurnCategory, { icon: typeof MessageSquare; color: string; label: string }> = {
  task:          { icon: Zap,            color: "text-primary",          label: "Task" },
  question:      { icon: HelpCircle,     color: "text-blue-400",         label: "Question" },
  feedback:      { icon: MessageCircle,  color: "text-orange-400",       label: "Feedback" },
  command:       { icon: Terminal,        color: "text-purple-400",       label: "Command" },
  continuation:  { icon: ArrowRight,     color: "text-muted-foreground", label: "Continue" },
  interruption:  { icon: Pause,          color: "text-muted-foreground", label: "Interrupted" },
  context:       { icon: Share2,         color: "text-muted-foreground", label: "Context" },
  system:        { icon: Terminal,        color: "text-muted-foreground", label: "System" },
  conversation:  { icon: MessageSquare,  color: "text-cyan-400",         label: "Chat" },
};

function TurnNodeComponent({ data }: NodeProps<Node<TurnNodeData>>) {
  const { turn, selected } = data;
  const totalTools = Object.values(turn.toolCounts).reduce((a, b) => a + b, 0);

  const borderColor = turn.hasCommit
    ? "border-emerald-500/60"
    : turn.hasCompaction
      ? "border-yellow-500/60"
      : selected
        ? "border-primary/80"
        : "border-border";

  const cat = categoryConfig[turn.category] ?? categoryConfig.conversation;
  const CatIcon = cat.icon;

  return (
    <div
      className={cn(
        "bg-card rounded-lg border-2 px-4 py-3 w-[320px] cursor-pointer transition-all hover:shadow-elevated",
        borderColor,
        selected && "shadow-elevated ring-1 ring-primary/30"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />

      {/* Turn index + category + badges */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
          #{turn.index}
        </span>
        <span className={cn("flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-secondary/50", cat.color)}>
          <CatIcon className="w-2.5 h-2.5" /> {cat.label}
        </span>
        {turn.hasCommit && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            <GitCommit className="w-2.5 h-2.5" /> commit
          </span>
        )}
        {turn.hasCompaction && (
          <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
            <Layers className="w-2.5 h-2.5" /> compacted
          </span>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm leading-snug line-clamp-2 mb-2">
        {turn.summary}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {totalTools > 0 && (
          <span className="flex items-center gap-1">
            <Wrench className="w-2.5 h-2.5" />
            {totalTools} tools
          </span>
        )}
        {turn.filesChanged.length > 0 && (
          <span className="flex items-center gap-1">
            <FileCode className="w-2.5 h-2.5" />
            {turn.filesChanged.length} files
          </span>
        )}
        {turn.commitMessage && (
          <span className="truncate max-w-[150px] text-emerald-400/70 italic">
            &quot;{turn.commitMessage}&quot;
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-border !w-2 !h-2" />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  turnNode: TurnNodeComponent,
};

// ─── TurnFlow ───────────────────────────────────────────────────────────────

interface TurnFlowProps {
  turns: TurnNode[];
  selectedTurnId: string | null;
  onSelectTurn: (turn: TurnNode) => void;
}

/** Filter out noise turns that add no value to the timeline */
function isSignificantTurn(turn: TurnNode): boolean {
  const totalTools = Object.values(turn.toolCounts).reduce((a, b) => a + b, 0);
  // Keep turns that have tools, files, commits, or compactions
  if (totalTools > 0 || turn.filesChanged.length > 0 || turn.hasCommit || turn.hasCompaction) return true;
  // Keep turns with real user conversation (not interruptions/continuations with no action)
  if (turn.category === "interruption" || turn.category === "system") return false;
  if (turn.category === "continuation" && !turn.userInstruction.trim()) return false;
  return true;
}

export function TurnFlow({ turns, selectedTurnId, onSelectTurn }: TurnFlowProps) {
  const { nodes, edges } = useMemo(() => {
    const NODE_SPACING = 140;
    const significantTurns = turns.filter(isSignificantTurn);

    const flowNodes: Node<TurnNodeData>[] = significantTurns.map((turn, i) => ({
      id: turn.id,
      type: "turnNode",
      position: { x: 0, y: i * NODE_SPACING },
      data: { turn, selected: turn.id === selectedTurnId },
    }));

    const flowEdges: Edge[] = significantTurns.slice(1).map((turn, i) => ({
      id: `e-${significantTurns[i].id}-${turn.id}`,
      source: significantTurns[i].id,
      target: turn.id,
      type: "smoothstep",
      style: { stroke: "hsl(220 12% 25%)", strokeWidth: 2 },
      animated: false,
    }));

    return { nodes: flowNodes, edges: flowEdges };
  }, [turns, selectedTurnId]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TurnNodeData>) => {
      onSelectTurn(node.data.turn);
    },
    [onSelectTurn]
  );

  return (
    <div className="w-full h-[calc(100vh-53px)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(220 12% 15%)" gap={20} size={1} />
        <Controls
          className="!bg-card !border-border !shadow-card [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-secondary"
        />
      </ReactFlow>
    </div>
  );
}
