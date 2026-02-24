import { loadPid, clearPid, isProcessRunning } from "../lib/process.js";

export function stopCommand(): void {
  const info = loadPid();

  if (!info) {
    console.log("Hexdeck is not running (no PID file found).");
    return;
  }

  if (!isProcessRunning(info.pid)) {
    console.log(`Hexdeck process (PID ${info.pid}) is no longer running. Cleaning up.`);
    clearPid();
    return;
  }

  try {
    process.kill(info.pid, "SIGTERM");
    console.log(`Hexdeck stopped (PID ${info.pid}).`);
  } catch (err) {
    console.error(`Failed to stop process ${info.pid}:`, err);
  }

  clearPid();
}
