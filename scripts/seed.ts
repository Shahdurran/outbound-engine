#!/usr/bin/env node
import { getDb } from "../lib/db/index";
import { createRun, listRuns } from "../lib/db/runs";
import { runPipeline } from "../lib/orchestrator";
import { newRunId, resolveProvider } from "../lib/run-context";
import { RECORDED_RUNS } from "../fixtures/index";

/**
 * Seeds one completed run so the console shows real work before anyone touches
 * an API key.
 *
 * It seeds by *running* the pipeline in replay mode rather than inserting
 * rows. The seeded run is therefore a genuine run - the same orchestrator, the
 * same trace events, the same tool executions against the cached pages - which
 * is why clicking it in the history renders identically to one you watched
 * live. Hand-written seed rows would drift from the real shape within a week.
 */

async function main(): Promise<void> {
  getDb();

  const recording = RECORDED_RUNS[0];
  if (!recording) {
    console.error("No recordings available to seed from.");
    process.exit(1);
  }

  const existing = listRuns(50).filter((run) => run.domain === recording.domain);
  if (existing.length > 0) {
    console.log(`Already seeded: ${existing.length} run(s) for ${recording.domain}. Nothing to do.`);
    return;
  }

  const resolution = resolveProvider(recording.domain);
  if (!resolution.ok) {
    console.error(resolution.message);
    process.exit(1);
  }

  const runId = newRunId();
  createRun({
    id: runId,
    domain: recording.domain,
    icp: recording.icp,
    mode: resolution.provider.mode,
    model: resolution.provider.model,
  });

  console.log(`Seeding ${recording.domain} (${resolution.provider.mode} mode)...`);

  const result = await runPipeline({
    runId,
    domain: recording.domain,
    icp: recording.icp,
    ctx: { runId, provider: resolution.provider },
    emit: (event) => {
      if (event.type === "agent_done") {
        console.log(`  ${event.agent} ${event.durationMs}ms`);
      } else if (event.type === "agent_error") {
        console.log(`  ${event.agent} FAILED: ${event.message}`);
      }
    },
  });

  console.log(
    `Seeded run ${runId}: ${result.status}, score ${result.artifacts.score ?? "n/a"}, tier ${result.artifacts.tier ?? "n/a"}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
