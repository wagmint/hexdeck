import { readFileSync, writeFileSync, statSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { homedir } from "os";
import type { RelayConfig, RelayTarget } from "./types.js";

// ─── Config Cache ───────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".pylon", "relay.json");

let cachedConfig: RelayConfig | null = null;
let cachedMtimeMs = 0;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load relay config from ~/.pylon/relay.json.
 * Cached by mtime — re-read on file change.
 * Missing or malformed config → empty { targets: [] }.
 */
export function loadRelayConfig(): RelayConfig {
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
    cachedConfig = { targets: [] };
    cachedMtimeMs = 0;
    return cachedConfig;
  }
}

/**
 * Save relay config to ~/.pylon/relay.json.
 * Creates ~/.pylon/ directory if it doesn't exist.
 */
export function saveRelayConfig(config: RelayConfig): void {
  const dir = dirname(CONFIG_PATH);
  mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(config, null, 2);
  writeFileSync(CONFIG_PATH, json, "utf-8");
  // Invalidate cache so next load picks up the new mtime
  cachedConfig = null;
  cachedMtimeMs = 0;
}

// ─── Internal ───────────────────────────────────────────────────────────────

function normalizeConfig(raw: unknown): RelayConfig {
  if (!raw || typeof raw !== "object") return { targets: [] };
  const obj = raw as Record<string, unknown>;
  const targets = Array.isArray(obj.targets)
    ? obj.targets.filter(isValidTarget)
    : [];
  return { targets };
}

function isValidTarget(t: unknown): t is RelayTarget {
  if (!t || typeof t !== "object") return false;
  const o = t as Record<string, unknown>;
  return (
    typeof o.pylonId === "string" &&
    typeof o.wsUrl === "string" &&
    typeof o.token === "string"
  );
}
