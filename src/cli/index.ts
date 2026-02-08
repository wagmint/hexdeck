import { resolve, dirname } from "path";
import { createCheckpoint } from "../checkpoint/create.js";
import { rewindToCheckpoint } from "../checkpoint/rewind.js";
import { loadCheckpoints } from "../checkpoint/storage.js";

/** Load checkpoints, walking up directories if none found at cwd. */
function findCheckpointsForCwd(startPath: string) {
  let checkpoints = loadCheckpoints(startPath);
  if (checkpoints.length > 0) return checkpoints;

  let current = startPath;
  while (current !== dirname(current)) {
    current = dirname(current);
    checkpoints = loadCheckpoints(current);
    if (checkpoints.length > 0) return checkpoints;
  }
  return [];
}

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case "checkpoint": {
    const note = args.join(" ");
    if (!note) {
      console.error("Usage: pylon checkpoint <note>");
      console.error('  e.g.: pylon checkpoint "auth flow working"');
      process.exit(1);
    }

    const projectPath = resolve(process.cwd());
    try {
      const cp = createCheckpoint(projectPath, note);
      console.log(`\nCheckpoint created: ${cp.id}`);
      console.log(`  Note:     ${cp.note}`);
      console.log(`  Session:  ${cp.sessionId.slice(0, 8)}...`);
      console.log(`  JSONL at: line ${cp.jsonlLineCount}`);
      console.log(`  Git:      ${cp.gitCommitHash.slice(0, 7)} (${cp.gitBranch})`);
      if (cp.filesChanged.length > 0) {
        console.log(`  Changed:  ${cp.filesChanged.join(", ")}`);
      }
      console.log();
    } catch (e: unknown) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
    break;
  }

  case "rewind": {
    const checkpointId = args[0];
    if (!checkpointId) {
      console.error("Usage: pylon rewind <checkpoint-id>");
      process.exit(1);
    }

    try {
      const result = rewindToCheckpoint(checkpointId);
      console.log(`\nRewound to checkpoint: ${result.checkpoint.id}`);
      console.log(`  Note:        ${result.checkpoint.note}`);
      console.log(`  New session: ${result.newSessionId}`);
      console.log(`  Git state:   ${result.gitRestored ? "restored" : "not restored"}`);
      console.log();
      console.log(`To resume from this checkpoint:`);
      console.log(`  claude --resume`);
      console.log(`  → Select the session starting with "${result.newSessionId.slice(0, 8)}..."`);
      console.log();
    } catch (e: unknown) {
      console.error(`Error: ${(e as Error).message}`);
      process.exit(1);
    }
    break;
  }

  case "checkpoints": {
    const projectPath = args[0] ? resolve(args[0]) : resolve(process.cwd());
    const checkpoints = findCheckpointsForCwd(projectPath);

    if (checkpoints.length === 0) {
      console.log("\nNo checkpoints found for this project.\n");
      break;
    }

    console.log(`\nCheckpoints (${checkpoints.length}):\n`);
    for (const cp of checkpoints) {
      const age = timeAgo(cp.timestamp);
      const rewound = cp.rewindSessionId ? " [rewound]" : "";
      console.log(`  ${cp.id}  "${cp.note}"  ${age}  ${cp.gitCommitHash.slice(0, 7)}${rewound}`);
    }
    console.log();
    break;
  }

  default:
    console.log(`
Pylon — Checkpoints for Claude Code sessions

Commands:
  checkpoint <note>       Create a checkpoint with a note
  rewind <checkpoint-id>  Rewind to a checkpoint
  checkpoints             List all checkpoints for this project
    `);
    break;
}

function timeAgo(iso: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
