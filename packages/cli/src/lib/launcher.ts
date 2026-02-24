/**
 * Entry point for the detached background server process.
 * Reads --port and --dashboard-dir from argv.
 */
import { startServer } from "@hexdeck/server";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

const port = parseInt(getArg("--port") ?? "3002", 10);
const dashboardDir = getArg("--dashboard-dir") ?? undefined;

startServer({ port, dashboardDir });
