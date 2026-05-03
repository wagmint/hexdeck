import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tempRoots: string[] = [];
const storageClosers: Array<() => void> = [];

afterEach(() => {
  for (const close of storageClosers.splice(0)) {
    close();
  }
  delete process.env.HEXDECK_HOME_DIR;
  delete process.env.HEXDECK_STORAGE_PARSER_VERSION;
  delete process.env.HEXDECK_STORAGE_RETENTION_DAYS;
  vi.resetModules();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("storage retention", () => {
  it("prunes ended sessions older than the retention window and keeps recent/live ones", async () => {
    const root = mkdtempSync(join(tmpdir(), "hexdeck-retention-"));
    tempRoots.push(root);

    process.env.HEXDECK_HOME_DIR = root;
    process.env.HEXDECK_STORAGE_PARSER_VERSION = "retention-test";
    vi.resetModules();

    const dbMod = await import("./db.js");
    const repos = await import("./repositories.js");
    await dbMod.initStorage();
    storageClosers.push(() => {
      try {
        dbMod.closeStorage();
      } catch {}
    });

    const db = dbMod.getDb();

    insertSessionWithSource(db, {
      sessionId: "old-ended",
      transcriptSourceId: 1,
      lastEventAt: "2026-03-01T10:00:00.000Z",
      endedAt: "2026-03-01T10:05:00.000Z",
      status: "ended",
    });
    insertSessionWithSource(db, {
      sessionId: "recent-ended",
      transcriptSourceId: 2,
      lastEventAt: "2026-04-25T10:00:00.000Z",
      endedAt: "2026-04-25T10:05:00.000Z",
      status: "ended",
    });
    insertSessionWithSource(db, {
      sessionId: "active-session",
      transcriptSourceId: 3,
      lastEventAt: "2026-03-01T10:00:00.000Z",
      endedAt: null,
      status: "discovered",
    });

    const result = repos.pruneStoredSessionHistory(30, new Date("2026-05-01T00:00:00.000Z"));

    expect(result).toEqual({
      retentionDays: 30,
      deletedSessions: 1,
      deletedTranscriptSources: 1,
    });
    expect(repos.listStoredSessions().map((row) => row.id).sort()).toEqual([
      "active-session",
      "recent-ended",
    ]);
    expect(repos.listTranscriptSources().map((row) => row.sessionId).sort()).toEqual([
      "active-session",
      "recent-ended",
    ]);
  });
});

function insertSessionWithSource(
  db: Awaited<ReturnType<typeof import("./db.js")["initStorage"]>>,
  opts: {
    sessionId: string;
    transcriptSourceId: number;
    lastEventAt: string;
    endedAt: string | null;
    status: string;
  },
): void {
  db.prepare(`
    INSERT INTO transcript_sources(
      id, source_type, session_id, file_path, file_size_bytes, file_mtime, discovered_at, last_seen_at, is_active
    ) VALUES (?, 'claude', ?, ?, 100, ?, ?, ?, ?)
  `).run(
    opts.transcriptSourceId,
    opts.sessionId,
    `/tmp/${opts.sessionId}.jsonl`,
    opts.lastEventAt,
    opts.lastEventAt,
    opts.lastEventAt,
    opts.status === "ended" ? 0 : 1,
  );

  db.prepare(`
    INSERT INTO ingestion_checkpoints(
      transcript_source_id, parser_version, last_processed_line, last_processed_byte_offset,
      last_processed_timestamp, last_ingested_at, status, error_message
    ) VALUES (?, 'retention-test', 1, 100, ?, ?, 'ready', NULL)
  `).run(
    opts.transcriptSourceId,
    opts.lastEventAt,
    opts.lastEventAt,
  );

  db.prepare(`
    INSERT INTO sessions(
      id, source_type, transcript_source_id, project_path, cwd, git_branch,
      created_at, last_event_at, ended_at, status, end_reason, metadata_json
    ) VALUES (?, 'claude', ?, '/tmp/demo', '/tmp/demo', 'main', ?, ?, ?, ?, NULL, '{}')
  `).run(
    opts.sessionId,
    opts.transcriptSourceId,
    opts.lastEventAt,
    opts.lastEventAt,
    opts.endedAt,
    opts.status,
  );
}
