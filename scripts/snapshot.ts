#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../lib/db/index";
import { createRun, listRuns } from "../lib/db/runs";
import { pushRunToCrm } from "../lib/crm-push";
import { runPipeline } from "../lib/orchestrator";
import { newRunId, resolveProvider } from "../lib/run-context";
import { RECORDED_RUNS } from "../fixtures/index";
import { SNAPSHOT_TABLES, type RunSnapshot } from "../lib/snapshot-tables";

/**
 * Produces fixtures/seed-run.json: one complete run, at real speed, with its
 * CRM writes.
 *
 * Why a snapshot instead of seeding at boot: a serverless instance has no
 * start hook and a cold /tmp, so a boot-time seed has to be fast, and a fast
 * replay records its own wall-clock - which meant the seeded run showed 161ms
 * agents and a 0.3s total. Those numbers are real but they are the wrong real
 * thing, and they read as fake. Capturing a genuine 40s run once and restoring
 * the rows keeps the seeded run honest and the boot instant.
 *
 *   npm run snapshot
 */

async function main(): Promise<void> {
  const recording = RECORDED_RUNS[0];
  if (!recording) throw new Error("No recordings to snapshot.");

  const dbPath = path.join(process.cwd(), "data", "outbound.db");
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(`${dbPath}${suffix}`, { force: true });
  }

  getDb();

  const resolution = resolveProvider(recording.domain);
  if (!resolution.ok) throw new Error(resolution.message);

  const runId = newRunId();
  createRun({
    id: runId,
    domain: recording.domain,
    icp: recording.icp,
    mode: resolution.provider.mode,
    model: resolution.provider.model,
  });

  console.log(`Capturing ${recording.domain} at real speed. This takes about 40 seconds.`);

  const result = await runPipeline({
    runId,
    domain: recording.domain,
    icp: recording.icp,
    ctx: { runId, provider: resolution.provider },
    emit: (event) => {
      if (event.type === "agent_done") console.log(`  ${event.agent} ${event.durationMs}ms`);
    },
  });

  if (result.status !== "complete") {
    throw new Error(`Refusing to snapshot a ${result.status} run.`);
  }

  console.log("Pushing to the mock CRM so the CRM tab is populated on a fresh deploy.");
  await pushRunToCrm(runId);

  const db = getDb();
  const snapshot: RunSnapshot = { runId, tables: {} };
  for (const table of SNAPSHOT_TABLES) {
    snapshot.tables[table] = db
      .prepare(`SELECT * FROM ${table} WHERE ${table === "runs" ? "id" : "run_id"} = ?`)
      .all(runId) as Record<string, unknown>[];
  }

  const out = path.join(process.cwd(), "fixtures", "seed-run.json");
  fs.writeFileSync(out, `${JSON.stringify(snapshot, null, 2)}\n`);

  const rows = Object.values(snapshot.tables).reduce((sum, list) => sum + list.length, 0);
  console.log(
    `Wrote ${out}: ${rows} rows, ${(fs.statSync(out).size / 1024).toFixed(0)}kb, ` +
      `run took ${(result.durationMs / 1000).toFixed(1)}s.`,
  );
  console.log(`Sanity check: ${listRuns(1)[0]?.duration_ms}ms recorded on the run row.`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
