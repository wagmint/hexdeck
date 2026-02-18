import { spawn, exec } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadPid, savePid, clearPid, isProcessRunning, isPortInUse } from "../lib/process.js";
import { resolveDashboardDir } from "../lib/resolve.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function startCommand(options: { port: number; foreground: boolean }): Promise<void> {
  const { port, foreground } = options;

  // Check if already running
  const existing = loadPid();
  if (existing && isProcessRunning(existing.pid)) {
    console.log(`Pylon is already running (PID ${existing.pid}, port ${existing.port})`);
    console.log(`  http://localhost:${existing.port}`);
    return;
  }

  // Check port availability
  if (await isPortInUse(port)) {
    console.error(`Error: Port ${port} is already in use.`);
    process.exit(1);
  }

  // Resolve dashboard directory
  const dashboardDir = resolveDashboardDir();
  if (dashboardDir) {
    console.log(`Dashboard: ${dashboardDir}`);
  } else {
    console.log("Dashboard not found — running API-only mode.");
    console.log("Run `npm run build --workspace=packages/local` to build the dashboard.");
  }

  if (foreground) {
    // Import and run directly
    const { startServer } = await import("@pylon/server");
    startServer({ port, dashboardDir: dashboardDir ?? undefined });

    savePid({
      pid: process.pid,
      port,
      startedAt: new Date().toISOString(),
      dashboardDir,
    });

    // Clean up PID file on exit
    const cleanup = () => {
      clearPid();
      process.exit(0);
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } else {
    // Spawn detached background process
    const launcherPath = join(__dirname, "..", "lib", "launcher.js");
    const tsLauncherPath = join(__dirname, "..", "lib", "launcher.ts");

    // Determine whether to use tsx (dev) or node (compiled)
    const isTsx = process.argv[1]?.endsWith(".ts") || process.argv[0]?.includes("tsx");
    const cmd = isTsx ? "tsx" : "node";
    const script = isTsx ? tsLauncherPath : launcherPath;

    const args = [script, "--port", String(port)];
    if (dashboardDir) {
      args.push("--dashboard-dir", dashboardDir);
    }

    const child = spawn(cmd, args, {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    if (!child.pid) {
      console.error("Error: Failed to start background process.");
      process.exit(1);
    }

    savePid({
      pid: child.pid,
      port,
      startedAt: new Date().toISOString(),
      dashboardDir,
    });

    console.log(`Pylon started (PID ${child.pid})`);
    console.log(`  http://localhost:${port}`);

    // Open browser on macOS
    if (process.platform === "darwin") {
      exec(`open http://localhost:${port}`);
    }
  }
}
