import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Checkpoint } from "../types/index.js";

const PYLON_DIR = join(homedir(), ".hexdeck");
const CHECKPOINTS_DIR = join(PYLON_DIR, "checkpoints");

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function getProjectCheckpointsFile(projectPath: string): string {
  // Encode the project path the same way Claude Code does
  const encoded = projectPath.replace(/\//g, "-");
  return join(CHECKPOINTS_DIR, `${encoded}.json`);
}

/**
 * Load all checkpoints for a project.
 */
export function loadCheckpoints(projectPath: string): Checkpoint[] {
  const file = getProjectCheckpointsFile(projectPath);
  if (!existsSync(file)) return [];

  const data = readFileSync(file, "utf-8");
  return JSON.parse(data);
}

/**
 * Save a new checkpoint.
 */
export function saveCheckpoint(checkpoint: Checkpoint): void {
  ensureDir(CHECKPOINTS_DIR);

  const existing = loadCheckpoints(checkpoint.projectPath);
  existing.push(checkpoint);

  const file = getProjectCheckpointsFile(checkpoint.projectPath);
  writeFileSync(file, JSON.stringify(existing, null, 2));
}

/**
 * Find a checkpoint by ID across all projects, or within a specific project.
 */
export function findCheckpoint(
  checkpointId: string,
  projectPath?: string
): Checkpoint | null {
  if (projectPath) {
    const checkpoints = loadCheckpoints(projectPath);
    return checkpoints.find((c) => c.id === checkpointId) ?? null;
  }

  // Search all checkpoint files
  if (!existsSync(CHECKPOINTS_DIR)) return null;

  const files = readdirSync(CHECKPOINTS_DIR) as string[];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    const data = readFileSync(join(CHECKPOINTS_DIR, file), "utf-8");
    const checkpoints: Checkpoint[] = JSON.parse(data);
    const match = checkpoints.find((c) => c.id === checkpointId);
    if (match) return match;
  }

  return null;
}

/**
 * Update a checkpoint (e.g., to set rewindSessionId).
 */
export function updateCheckpoint(
  checkpointId: string,
  projectPath: string,
  updates: Partial<Checkpoint>
): void {
  const checkpoints = loadCheckpoints(projectPath);
  const idx = checkpoints.findIndex((c) => c.id === checkpointId);
  if (idx === -1) return;

  checkpoints[idx] = { ...checkpoints[idx], ...updates };

  const file = getProjectCheckpointsFile(projectPath);
  writeFileSync(file, JSON.stringify(checkpoints, null, 2));
}
