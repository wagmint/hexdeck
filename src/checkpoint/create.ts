import { execSync } from "child_process";
import { readFileSync } from "fs";
import { dirname } from "path";
import { randomUUID } from "crypto";
import type { Checkpoint } from "../types/index.js";
import { findProjectForPath, listSessions } from "../discovery/sessions.js";
import { saveCheckpoint } from "./storage.js";

/**
 * Create a checkpoint for the current project + most recent session.
 */
export function createCheckpoint(
  projectPath: string,
  note: string
): Checkpoint {
  // Find the project — try exact path first, then walk up parent directories
  let project = findProjectForPath(projectPath);
  let searchPath = projectPath;
  if (!project) {
    let current = projectPath;
    while (current !== dirname(current)) {
      current = dirname(current);
      project = findProjectForPath(current);
      if (project) {
        searchPath = current;
        break;
      }
    }
  }
  if (!project) {
    throw new Error(`No Claude Code sessions found for: ${projectPath}`);
  }

  const sessions = listSessions(project.encodedName);
  if (sessions.length === 0) {
    throw new Error(`No sessions found for project: ${projectPath}`);
  }

  const session = sessions[0]; // Most recent

  // Count JSONL lines
  const content = readFileSync(session.path, "utf-8");
  const lineCount = content.split("\n").filter((l) => l.trim().length > 0).length;

  // Find the git root (might be a subdirectory of the project path)
  const gitRoot = execGit(projectPath, "rev-parse --show-toplevel");

  // Capture git state
  let gitCommitHash = "";
  let gitBranch = "";
  let gitDiff = "";
  let filesChanged: string[] = [];

  if (gitRoot) {
    gitCommitHash = execGit(gitRoot, "rev-parse HEAD");
    gitBranch = execGit(gitRoot, "rev-parse --abbrev-ref HEAD");
    gitDiff = execGit(gitRoot, "diff");

    const diffFiles = execGit(gitRoot, "diff --name-only")
      .split("\n")
      .filter(Boolean);
    const stagedFiles = execGit(gitRoot, "diff --cached --name-only")
      .split("\n")
      .filter(Boolean);
    filesChanged = [...new Set([...diffFiles, ...stagedFiles])];
  }

  const checkpoint: Checkpoint = {
    id: randomUUID().slice(0, 8),
    sessionId: session.id,
    projectPath: searchPath,
    note,
    timestamp: new Date().toISOString(),
    jsonlLineCount: lineCount,
    gitCommitHash,
    gitBranch,
    gitDiff,
    filesChanged,
    rewindSessionId: null,
  };

  saveCheckpoint(checkpoint);
  return checkpoint;
}

function execGit(cwd: string, cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}
