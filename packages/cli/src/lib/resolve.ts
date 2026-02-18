import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Find the package root by walking up from a file path until we find package.json.
 */
export function findPackageRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    dir = dirname(dir);
  }
  return dir;
}

/**
 * Resolve the dashboard static export directory.
 * 1. PYLON_DASHBOARD_DIR env var (explicit override)
 * 2. Bundled dashboard/ directory (npm-installed package)
 * 3. @pylon/local workspace package out/ directory (dev mode)
 * 4. null (API-only mode)
 */
export function resolveDashboardDir(): string | null {
  // 1. Explicit env var
  const envDir = process.env.PYLON_DASHBOARD_DIR;
  if (envDir && existsSync(envDir)) {
    return envDir;
  }

  // 2. Bundled dashboard directory (for published npm package)
  const pkgRoot = findPackageRoot();
  const bundledDir = join(pkgRoot, "dashboard");
  if (existsSync(join(bundledDir, "index.html"))) {
    return bundledDir;
  }

  // 3. Resolve from @pylon/local workspace package (dev mode)
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
