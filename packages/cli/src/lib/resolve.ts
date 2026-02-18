import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

/**
 * Resolve the dashboard static export directory.
 * 1. PYLON_DASHBOARD_DIR env var
 * 2. @pylon/local workspace package out/ directory
 * 3. null (API-only mode)
 */
export function resolveDashboardDir(): string | null {
  // 1. Explicit env var
  const envDir = process.env.PYLON_DASHBOARD_DIR;
  if (envDir && existsSync(envDir)) {
    return envDir;
  }

  // 2. Resolve from @pylon/local package
  try {
    const require = createRequire(import.meta.url);
    const pkgPath = require.resolve("@pylon/local/package.json");
    const outDir = join(dirname(pkgPath), "out");
    if (existsSync(outDir)) {
      return outDir;
    }
  } catch {
    // Package not found — that's fine
  }

  return null;
}
