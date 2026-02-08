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
import {
  MessageSquare,
  GitCommit,
  AlertTriangle,
  Layers,
  FileCode,
  Wrench,
} from "lucide-react";

// ─── Custom Node Component ──────────────────────────────────────────────────

type TurnNodeData = {
  turn: TurnNode;
  selected: boolean;
};

function TurnNodeComponent({ data }: NodeProps<Node<TurnNodeData>>) {
  const { turn, selected } = data;
  const totalTools = Object.values(turn.toolCounts).reduce((a, b) => a + b, 0);

  const borderColor = turn.hasError
    ? "border-red-500/60"
    : turn.hasCommit
      ? "border-emerald-500/60"
      : turn.hasCompaction
        ? "border-yellow-500/60"
        : selected
          ? "border-primary/80"
          : "border-border";

  const instruction =
    turn.userInstruction.trim() || "(tool results / continuation)";

  return (
    <div
      className={cn(
        "bg-card rounded-lg border-2 px-4 py-3 w-[320px] cursor-pointer transition-all hover:shadow-elevated",
        borderColor,
        selected && "shadow-elevated ring-1 ring-primary/30"
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-border !w-2 !h-2" />

      {/* Turn index + type badges */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
          #{turn.index}
        </span>
        {turn.hasCommit && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">
            <GitCommit className="w-2.5 h-2.5" /> commit
          </span>
        )}
        {turn.hasError && (
          <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
            <AlertTriangle className="w-2.5 h-2.5" /> error
          </span>
        )}
        {turn.hasCompaction && (
          <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded">
            <Layers className="w-2.5 h-2.5" /> compacted
          </span>
        )}
      </div>

      {/* User instruction */}
      <div className="flex items-start gap-2 mb-2">
        <MessageSquare className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
        <p className="text-sm leading-snug line-clamp-2">{instruction}</p>
      </div>

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

export function TurnFlow({ turns, selectedTurnId, onSelectTurn }: TurnFlowProps) {
  const { nodes, edges } = useMemo(() => {
    const NODE_SPACING = 120;

    const flowNodes: Node<TurnNodeData>[] = turns.map((turn, i) => ({
      id: turn.id,
      type: "turnNode",
      position: { x: 0, y: i * NODE_SPACING },
      data: { turn, selected: turn.id === selectedTurnId },
    }));

    const flowEdges: Edge[] = turns.slice(1).map((turn, i) => ({
      id: `e-${turns[i].id}-${turn.id}`,
      source: turns[i].id,
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
