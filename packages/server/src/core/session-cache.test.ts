import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { getCachedOrParse, evictStaleCacheEntries } from "./session-cache.js";
import type { SessionInfo } from "../types/index.js";

const tempRoots: string[] = [];

afterEach(() => {
  evictStaleCacheEntries(new Set());
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("getCachedOrParse", () => {
  it("stores a pruned parsed session in cache", () => {
    const root = mkdtempSync(join(tmpdir(), "hexdeck-cache-"));
    tempRoots.push(root);

    const sessionPath = join(root, "session.jsonl");
    writeFileSync(sessionPath, [
      JSON.stringify({
        timestamp: "2026-05-01T12:00:00.000Z",
        role: "user",
        content: "Update the landing page",
      }),
      JSON.stringify({
        timestamp: "2026-05-01T12:00:05.000Z",
        role: "assistant",
        usage: { input_tokens: 1234, output_tokens: 200 },
        content: [
          {
            type: "tool_use",
            id: "tool-1",
            name: "Write",
            input: {
              file_path: "/tmp/demo/src/page.tsx",
              content: "x".repeat(10_000),
            },
          },
        ],
      }),
    ].join("\n"));

    const session: SessionInfo = {
      id: "session-cache-test",
      path: sessionPath,
      projectPath: "/tmp/demo",
      createdAt: new Date("2026-05-01T12:00:00.000Z"),
      modifiedAt: new Date("2026-05-01T12:00:05.000Z"),
      sizeBytes: 0,
    };

    const first = getCachedOrParse(session);
    expect(first.parsed.turns[0].events).toHaveLength(2);
    expect(first.parsed.turns[0].toolCalls[0].input).toHaveProperty("content");

    const second = getCachedOrParse(session);
    expect(second.events).toBeNull();
    expect(second.parsed.turns[0].events).toEqual([]);
    expect(second.parsed.turns[0].toolCalls[0].input).toEqual({
      file_path: "/tmp/demo/src/page.tsx",
    });
  });
});
