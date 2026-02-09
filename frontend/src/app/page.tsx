"use client";

import { useEffect, useState } from "react";
import { getActiveSessions } from "@/lib/api";
import type { SessionInfo } from "@/lib/types";
import { formatBytes, timeAgo } from "@/lib/utils";
import {
  FolderOpen,
  ChevronRight,
  Activity,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    setLoading(true);
    getActiveSessions()
      .then(setSessions)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // Poll every 10 seconds for active session changes
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Pylon</h1>
          <span className="text-sm text-muted-foreground">
            Active Sessions
          </span>
          <div className="flex-1" />
          <button
            onClick={refresh}
            className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded hover:bg-secondary"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {loading && sessions.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            Scanning for active sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>No active Claude Code sessions.</p>
            <p className="text-sm mt-2">
              Start a Claude Code session to see it here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/session/${session.id}`}
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                <span className="font-mono text-sm text-muted-foreground truncate max-w-[300px]">
                  {session.projectPath}
                </span>
                <div className="h-4 w-px bg-border" />
                <span className="font-mono text-xs text-muted-foreground truncate flex-1">
                  {session.id}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(session.sizeBytes)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {timeAgo(session.modifiedAt)}
                </span>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
