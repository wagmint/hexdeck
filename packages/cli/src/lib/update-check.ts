import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function getLocalVersion(): string {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    // Works from both src/ (dev) and dist/ (published)
    const pkg = JSON.parse(readFileSync(join(dir, "../../package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://registry.npmjs.org/@hexdeck/cli/latest", {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

function isNewer(latest: string, current: string): boolean {
  const a = latest.split(".").map(Number);
  const b = current.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

/**
 * Returns a promise that resolves to an update message (or null).
 * Call early, await later — the fetch runs in the background.
 */
export function checkForUpdate(): Promise<string | null> {
  const current = getLocalVersion();
  return fetchLatestVersion().then((latest) => {
    if (latest && isNewer(latest, current)) {
      return `\n  Update available: ${current} → ${latest}\n  Run: npm install -g @hexdeck/cli@latest\n`;
    }
    return null;
  });
}
