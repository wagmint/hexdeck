import { listProjects, listSessions, findSession } from "../discovery/sessions.js";
import { parseSessionFile, getSessionStats } from "../parser/jsonl.js";

const command = process.argv[2];

if (command === "projects") {
  // List all projects with Claude Code sessions
  const projects = listProjects();
  console.log(`\nFound ${projects.length} projects:\n`);

  for (const project of projects) {
    console.log(`  ${project.decodedPath}`);
    console.log(`    Sessions: ${project.sessionCount} | Last active: ${project.lastActive.toLocaleDateString()}`);
    console.log();
  }
} else if (command === "sessions") {
  // List sessions for a project
  const projectPath = process.argv[3];
  if (!projectPath) {
    // Default: show sessions for all projects, most recent first
    const projects = listProjects();
    for (const project of projects.slice(0, 5)) {
      console.log(`\n${project.decodedPath}:`);
      const sessions = listSessions(project.encodedName);
      for (const session of sessions.slice(0, 5)) {
        const sizeKb = (session.sizeBytes / 1024).toFixed(1);
        console.log(`  ${session.id}  ${sizeKb}KB  ${session.modifiedAt.toLocaleString()}`);
      }
    }
  } else {
    const sessions = listSessions(projectPath);
    console.log(`\nFound ${sessions.length} sessions:\n`);
    for (const session of sessions) {
      const sizeKb = (session.sizeBytes / 1024).toFixed(1);
      console.log(`  ${session.id}  ${sizeKb}KB  ${session.modifiedAt.toLocaleString()}`);
    }
  }
} else if (command === "parse") {
  // Parse a specific session — accepts session ID or full path
  const input = process.argv[3];
  if (!input) {
    console.error("Usage: parse <session-id or path-to-session.jsonl>");
    process.exit(1);
  }

  // Resolve: if it looks like a UUID (no slashes, no .jsonl), look it up
  let sessionPath = input;
  if (!input.includes("/") && !input.endsWith(".jsonl")) {
    const session = findSession(input);
    if (!session) {
      console.error(`Session not found: ${input}`);
      process.exit(1);
    }
    sessionPath = session.path;
  }

  console.log(`\nParsing: ${sessionPath}\n`);

  const events = parseSessionFile(sessionPath);
  const stats = getSessionStats(events);

  console.log(`  Total events:        ${stats.totalEvents}`);
  console.log(`  User messages:       ${stats.userMessages}`);
  console.log(`  Assistant messages:   ${stats.assistantMessages}`);
  console.log(`  Tool calls:          ${stats.toolCalls}`);
  console.log(`  Compactions:         ${stats.compactions}`);
  console.log();
  console.log(`  Tools used:`);
  for (const [tool, count] of Object.entries(stats.toolsUsed)) {
    console.log(`    ${tool}: ${count}`);
  }
} else {
  console.log(`
Hexdeck CLI — Parse Claude Code sessions

Commands:
  projects              List all projects with sessions
  sessions [project]    List sessions (optionally filter by project)
  parse <id or file>    Parse a session by ID or file path
  `);
}
