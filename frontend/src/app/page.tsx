"use client";

import { useEffect, useState } from "react";
import { getProjects, getProjectSessions } from "@/lib/api";
import type { ProjectInfo, SessionInfo } from "@/lib/types";
import { formatBytes, timeAgo } from "@/lib/utils";
import {
  FolderOpen,
  GitBranch,
  Clock,
  ChevronRight,
  Activity,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [sessions, setSessions] = useState<Record<string, SessionInfo[]>>({});
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  const toggleProject = async (encodedName: string) => {
    if (expandedProject === encodedName) {
      setExpandedProject(null);
      return;
    }

    setExpandedProject(encodedName);

    if (!sessions[encodedName]) {
      const data = await getProjectSessions(encodedName);
      setSessions((prev) => ({ ...prev, [encodedName]: data }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading sessions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Activity className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">Pylon</h1>
          <span className="text-sm text-muted-foreground">
            Claude Code Session Explorer
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-3">
          {projects.map((project) => (
            <div key={project.encodedName} className="rounded-lg border border-border bg-card">
              {/* Project row */}
              <button
                onClick={() => toggleProject(project.encodedName)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors rounded-lg text-left"
              >
                <ChevronRight
                  className={`w-4 h-4 text-muted-foreground transition-transform ${
                    expandedProject === project.encodedName ? "rotate-90" : ""
                  }`}
                />
                <FolderOpen className="w-4 h-4 text-primary" />
                <span className="font-mono text-sm flex-1 truncate">
                  {project.decodedPath}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <GitBranch className="w-3 h-3" />
                  {project.sessionCount} sessions
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {timeAgo(project.lastActive)}
                </span>
              </button>

              {/* Expanded sessions */}
              {expandedProject === project.encodedName && sessions[project.encodedName] && (
                <div className="border-t border-border">
                  {sessions[project.encodedName].map((session) => (
                    <Link
                      key={session.id}
                      href={`/session/${session.id}`}
                      className="flex items-center gap-3 px-4 py-2.5 pl-11 hover:bg-secondary/30 transition-colors border-b border-border last:border-b-0"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary/60" />
                      <span className="font-mono text-xs text-muted-foreground flex-1 truncate">
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
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p>No Claude Code sessions found.</p>
            <p className="text-sm mt-2">
              Start a Claude Code session to see it here.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
