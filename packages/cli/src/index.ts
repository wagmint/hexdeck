#!/usr/bin/env node

import { startCommand } from "./commands/start.js";
import { stopCommand } from "./commands/stop.js";
import { statusCommand } from "./commands/status.js";
import { exec } from "node:child_process";

const args = process.argv.slice(2);
const command = args[0];

function getFlag(name: string): boolean {
  return args.includes(name);
}

function getOption(name: string, fallback: string): string {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return fallback;
}

function printHelp() {
  console.log(`
Usage: hex <command> [options]

Commands:
  start       Start the Hexdeck server
  stop        Stop the Hexdeck server
  restart     Restart the Hexdeck server
  status      Show server status
  open        Open the dashboard in a browser
  relay       Manage cloud relay connections
  help        Show this help message

Options (start):
  --port N        Port number (default: 7433)
  --foreground    Run in foreground instead of background

Relay subcommands:
  relay <connect-link>                     Add/update a relay target
  relay list                               List configured targets
  relay remove <hexcoreId>                 Remove a target
  relay sessions                           List active sessions
  relay include <hexcoreId> <projectPath>  Start relaying a project
  relay exclude <hexcoreId> <projectPath>  Stop relaying a project
`.trim());
}

async function main() {
  switch (command) {
    case "start":
      await startCommand({
        port: parseInt(getOption("--port", "7433"), 10),
        foreground: getFlag("--foreground"),
      });
      break;

    case "stop":
      stopCommand();
      break;

    case "restart":
      stopCommand();
      // Small delay to let the port free up
      await new Promise((r) => setTimeout(r, 500));
      await startCommand({
        port: parseInt(getOption("--port", "7433"), 10),
        foreground: getFlag("--foreground"),
      });
      break;

    case "status":
      await statusCommand();
      break;

    case "relay": {
      const { relayCommand } = await import("./commands/relay.js");
      await relayCommand(args.slice(1));
      break;
    }

    case "open": {
      const port = getOption("--port", "7433");
      const url = `http://localhost:${port}`;
      console.log(`Opening ${url}...`);
      if (process.platform === "darwin") {
        exec(`open ${url}`);
      } else if (process.platform === "linux") {
        exec(`xdg-open ${url}`);
      } else {
        console.log(`Open ${url} in your browser.`);
      }
      break;
    }

    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;

    default:
      if (command) {
        console.error(`Unknown command: ${command}`);
      }
      printHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
