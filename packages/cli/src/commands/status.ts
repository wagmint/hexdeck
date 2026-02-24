import { loadPid, isProcessRunning } from "../lib/process.js";

export async function statusCommand(): Promise<void> {
  const info = loadPid();

  if (!info) {
    console.log("Hexdeck is not running.");
    return;
  }

  const running = isProcessRunning(info.pid);

  console.log(`Hexdeck Status`);
  console.log(`─────────────────────────────`);
  console.log(`  PID:        ${info.pid} ${running ? "(running)" : "(dead)"}`);
  console.log(`  Port:       ${info.port}`);
  console.log(`  Started:    ${info.startedAt}`);
  console.log(`  Dashboard:  ${info.dashboardDir ?? "none"}`);

  if (!running) {
    console.log(`\nProcess is no longer running.`);
    return;
  }

  // Try to fetch live data
  try {
    const res = await fetch(`http://localhost:${info.port}/api/dashboard`);
    if (res.ok) {
      const data = await res.json() as { agents?: unknown[] };
      const agentCount = Array.isArray(data.agents) ? data.agents.length : "?";
      console.log(`  Agents:     ${agentCount}`);
    }
  } catch {
    console.log(`  API:        unreachable`);
  }
}
