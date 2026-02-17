import { readFileSync, statSync } from "fs";
import { join } from "path";
import { homedir, userInfo } from "os";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OperatorConfig {
  name: string;
  claude?: string;  // path to .claude directory
  codex?: string;   // path to .codex directory
}

export interface PylonConfig {
  selfName?: string;
  operators: OperatorConfig[];
}

// ─── Color Palette ──────────────────────────────────────────────────────────

const OPERATOR_COLORS = [
  "#4ADE80", // green (self)
  "#60A5FA", // blue
  "#A78BFA", // purple
  "#FACC15", // yellow
  "#F97583", // pink
  "#56D4DD", // cyan
  "#FB923C", // orange
  "#E879F9", // fuchsia
];

// ─── Config Cache ───────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".pylon", "operators.json");

let cachedConfig: PylonConfig | null = null;
let cachedMtimeMs = 0;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load operator config from ~/.pylon/operators.json.
 * Cached by mtime — re-read on file change.
 * Missing or malformed config → empty { operators: [] }.
 */
export function loadOperatorConfig(): PylonConfig {
  try {
    const stat = statSync(CONFIG_PATH);
    if (cachedConfig && stat.mtimeMs === cachedMtimeMs) {
      return cachedConfig;
    }

    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    cachedMtimeMs = stat.mtimeMs;
    cachedConfig = normalizeConfig(parsed);
    return cachedConfig;
  } catch {
    // File doesn't exist or is malformed
    cachedConfig = { operators: [] };
    cachedMtimeMs = 0;
    return cachedConfig;
  }
}

/**
 * Get the self operator's display name.
 * Prefers config selfName, falls back to OS username.
 */
export function getSelfName(config: PylonConfig): string {
  if (config.selfName) return config.selfName;
  try {
    return userInfo().username;
  } catch {
    return "self";
  }
}

/**
 * Generate a stable operator ID from a name.
 * "self" for the local user, "op-<lowercase>" for configured operators.
 */
export function operatorId(name: string): string {
  return `op-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
}

/**
 * Get a color from the palette by index (wraps around).
 */
export function getOperatorColor(index: number): string {
  return OPERATOR_COLORS[index % OPERATOR_COLORS.length];
}

// ─── Internal ───────────────────────────────────────────────────────────────

function normalizeConfig(raw: unknown): PylonConfig {
  // Array form: [{ name, claude?, codex? }]
  if (Array.isArray(raw)) {
    return {
      operators: raw.filter(isValidOperator),
    };
  }

  // Object form: { self?: { name }, operators: [...] }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const selfName = obj.self && typeof obj.self === "object"
      ? (obj.self as Record<string, unknown>).name as string | undefined
      : undefined;
    const operators = Array.isArray(obj.operators)
      ? obj.operators.filter(isValidOperator)
      : [];
    return {
      selfName: typeof selfName === "string" ? selfName : undefined,
      operators,
    };
  }

  return { operators: [] };
}

function isValidOperator(op: unknown): op is OperatorConfig {
  if (!op || typeof op !== "object") return false;
  const o = op as Record<string, unknown>;
  return typeof o.name === "string" && o.name.length > 0;
}
