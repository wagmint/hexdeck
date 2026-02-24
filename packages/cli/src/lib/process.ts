import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { createConnection } from "node:net";

export interface PidInfo {
  pid: number;
  port: number;
  startedAt: string;
  dashboardDir: string | null;
}

const PYLON_DIR = join(homedir(), ".hexdeck");
const PID_FILE = join(PYLON_DIR, "server.pid");

function ensureDir() {
  if (!existsSync(PYLON_DIR)) {
    mkdirSync(PYLON_DIR, { recursive: true });
  }
}

export function savePid(info: PidInfo): void {
  ensureDir();
  writeFileSync(PID_FILE, JSON.stringify(info, null, 2));
}

export function loadPid(): PidInfo | null {
  if (!existsSync(PID_FILE)) return null;
  try {
    return JSON.parse(readFileSync(PID_FILE, "utf-8"));
  } catch {
    return null;
  }
}

export function clearPid(): void {
  if (existsSync(PID_FILE)) {
    unlinkSync(PID_FILE);
  }
}

export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: "127.0.0.1" });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => {
      resolve(false);
    });
  });
}
