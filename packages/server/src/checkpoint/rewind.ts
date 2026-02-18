import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";
import type { Checkpoint } from "../types/index.js";
import { findCheckpoint, updateCheckpoint } from "./storage.js";
import { findSession } from "../discovery/sessions.js";

function execGit(cwd: string, cmd: string): string {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

export interface RewindResult {
  checkpoint: Checkpoint;
  newSessionId: string;
  newSessionPath: string;
  gitRestored: boolean;
}

/**
 * Rewind to a checkpoint: restore git state + create truncated session.
 */
export function rewindToCheckpoint(checkpointId: string): RewindResult {
  const checkpoint = findCheckpoint(checkpointId);
  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  // 1. Find the original session
  const session = findSession(checkpoint.sessionId);
  if (!session) {
    throw new Error(
      `Original session not found: ${checkpoint.sessionId}`
    );
  }

  // 2. Create truncated JSONL copy
  const newSessionId = randomUUID();
  const newSessionPath = join(dirname(session.path), `${newSessionId}.jsonl`);

  const originalContent = readFileSync(session.path, "utf-8");
  const allLines = originalContent.split("\n");

  // Take lines up to the checkpoint's line count
  const truncatedLines = allLines.slice(0, checkpoint.jsonlLineCount);

  // Rewrite sessionId in each line to the new session ID
  const rewrittenLines = truncatedLines.map((line) => {
    if (!line.trim()) return line;
    try {
      const obj = JSON.parse(line);
      if (obj.sessionId) {
        obj.sessionId = newSessionId;
      }
      return JSON.stringify(obj);
    } catch {
      return line;
    }
  });

  writeFileSync(newSessionPath, rewrittenLines.join("\n") + "\n");

  // 3. Restore git state
  let gitRestored = false;
  if (checkpoint.gitCommitHash) {
    // Find the git root
    const gitRoot = execGit(checkpoint.projectPath, "rev-parse --show-toplevel");
    if (gitRoot) {
      try {
        execSync(`git checkout ${checkpoint.gitCommitHash} -- .`, {
          cwd: gitRoot,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });

        if (checkpoint.gitDiff) {
          try {
            execSync("git apply --allow-empty -", {
              cwd: gitRoot,
              input: checkpoint.gitDiff,
              encoding: "utf-8",
              stdio: ["pipe", "pipe", "pipe"],
            });
          } catch {
            console.warn(
              "Warning: could not reapply uncommitted changes from checkpoint"
            );
          }
        }

        gitRestored = true;
      } catch {
        console.warn("Warning: could not restore git state");
      }
    }
  }

  // 4. Update checkpoint with the new session ID
  updateCheckpoint(checkpointId, checkpoint.projectPath, {
    rewindSessionId: newSessionId,
  });

  return {
    checkpoint,
    newSessionId,
    newSessionPath,
    gitRestored,
  };
}
