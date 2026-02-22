"use client";

import type { ParsedSession } from "@/lib/types";
import { formatBytes, timeAgo } from "@/lib/utils";
import {
  ArrowLeft,
  Activity,
  GitCommit,
  FileCode,
  Wrench,
  AlertCircle,
  Layers,
  DollarSign,
} from "lucide-react";
import Link from "next/link";

export function SessionHeader({ session }: { session: ParsedSession }) {
  const { stats } = session;

  return (
    <header className="border-b border-border px-6 py-3">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <Activity className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Pylon</span>
        </Link>

        <div className="h-4 w-px bg-border" />

        <span className="font-mono text-xs text-muted-foreground truncate max-w-[200px]">
          {session.session.id}
        </span>

        <div className="h-4 w-px bg-border" />

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {stats.totalTurns} turns
          </span>
          <span className="flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            {stats.toolCalls} tool calls
          </span>
          {stats.commits > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <GitCommit className="w-3 h-3" />
              {stats.commits} commits
            </span>
          )}
          {stats.compactions > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <AlertCircle className="w-3 h-3" />
              {stats.compactions} compactions
            </span>
          )}
          <span className="flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            {stats.filesChanged.length} files changed
          </span>
          {stats.totalCost > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${stats.totalCost.toFixed(2)} total
            </span>
          )}
        </div>

        <div className="flex-1" />

        <span className="text-xs text-muted-foreground">
          {formatBytes(session.session.sizeBytes)} &middot;{" "}
          {timeAgo(session.session.modifiedAt)}
        </span>
      </div>
    </header>
  );
}
