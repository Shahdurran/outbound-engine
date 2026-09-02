import { RECORDED_RUNS } from "../fixtures/index";
import seedRun from "../fixtures/seed-run.json";
import { getDb } from "./db/index";
import { createRun, listRuns } from "./db/runs";
import { runPipeline } from "./orchestrator";
import { newRunId, resolveProvider } from "./run-context";
import { SNAPSHOT_TABLES, type RunSnapshot } from "./snapshot-tables";

/**
 * Makes sure the console has a completed run in it before anyone looks at it.
 *
 * A serverless deployment has no start hook and a fresh /tmp on every cold
 * start, so seeding cannot live in a start command there. It happens here
 * instead: once per process, on the first page or API request, single-flighted
 * so concurrent requests share the same promise.
 *
 * The seed is a snapshot of a genuine full-speed run (see scripts/snapshot.ts),
 * restored row for row. That matters: replaying the pipeline fast enough for a
 * cold start would record its own wall clock and show 161ms agents, which is a
 * true number about the wrong thing. Restoring the captured rows keeps the
 * durations in the console the ones the agents actually took.
 *
 * If the snapshot is missing or will not restore, it falls back to running the
 * pipeline at speed. A slightly odd-looking seed beats an empty console.
 */

const FALLBACK_REPLAY_SPEED = 400;

let inFlight: Promise<void> | null = null;

function restoreSnapshot(): boolean {
  const snapshot = seedRun as RunSnapshot;
  if (!snapshot?.runId) return false;

  const db = getDb();

  const insertAll = db.transaction(() => {
    for (const table of SNAPSHOT_TABLES) {
      const rows = snapshot.tables[table] ?? [];
      for (const row of rows) {
        const columns = Object.keys(row);
        if (columns.length === 0) continue;
        const placeholders = columns.map((column) => `@${column}`).join(", ");
        db.prepare(
          `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        ).run(row);
      }
    }
  });

  insertAll();
  return true;
}

async function seedIfEmpty(): Promise<void> {
  try {
    if (listRuns(1).length > 0) return;
    if (restoreSnapshot()) return;
  } catch (error) {
    console.error(
      "snapshot restore failed, falling back to a live replay:",
      error instanceof Error ? error.message : error,
    );
  }

  try {
    if (listRuns(1).length > 0) return;

    const recording = RECORDED_RUNS[0];
    if (!recording) return;

    const resolution = resolveProvider(recording.domain, { replaySpeed: FALLBACK_REPLAY_SPEED });
    if (!resolution.ok) return;

    const runId = newRunId();
    createRun({
      id: runId,
      domain: recording.domain,
      icp: recording.icp,
      mode: resolution.provider.mode,
      model: resolution.provider.model,
    });

    await runPipeline({
      runId,
      domain: recording.domain,
      icp: recording.icp,
      ctx: { runId, provider: resolution.provider },
      emit: () => {},
    });
  } catch (error) {
    // A failed seed must never take the page down with it. An empty console is
    // a worse demo than a seeded one, but it is still a working app.
    console.error("seed failed:", error instanceof Error ? error.message : error);
  }
}

export function ensureSeeded(): Promise<void> {
  if (!inFlight) inFlight = seedIfEmpty();
  return inFlight;
}
