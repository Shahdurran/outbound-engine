#!/usr/bin/env node
import { createRun } from "../lib/db/runs";
import { runPipeline } from "../lib/orchestrator";
import { newRunId, normalizeDomain, resolveProvider } from "../lib/run-context";
import { describeEvent } from "../lib/trace";

/**
 * The same orchestration graph, headless.
 *
 * No Next.js, no React, no HTTP. This is the proof that the graph in
 * lib/orchestrator.ts is genuinely independent of its UI: the web console and
 * this CLI are two consumers of one emitter.
 *
 *   npm run agent -- acmedental.com
 *   npm run agent -- acmedental.com "dental practices in the Pacific Northwest"
 *
 * Works with no API key, replaying a recorded run.
 */

const RESET = "[0m";
const DIM = "[2m";
const GREEN = "[32m";
const RED = "[31m";
const YELLOW = "[33m";

async function main(): Promise<void> {
  const [rawDomain, rawIcp] = process.argv.slice(2);

  if (!rawDomain) {
    console.error("Usage: npm run agent -- <domain> [icp description]");
    process.exit(1);
  }

  const domain = normalizeDomain(rawDomain);
  const icp = rawIcp?.trim() ? rawIcp.trim() : null;

  const resolution = resolveProvider(domain);
  if (!resolution.ok) {
    console.error(`\n${RED}${resolution.message}${RESET}\n`);
    for (const target of resolution.recordedDomains) {
      console.error(`  ${target.domain}  ${DIM}${target.label}${RESET}`);
    }
    console.error("");
    process.exit(1);
  }

  const runId = newRunId();
  createRun({
    id: runId,
    domain,
    icp,
    mode: resolution.provider.mode,
    model: resolution.provider.model,
  });

  const started = Date.now();

  const result = await runPipeline({
    runId,
    domain,
    icp,
    ctx: { runId, provider: resolution.provider },
    emit: (event) => {
      const elapsed = String(Date.now() - started).padStart(6, " ");
      const colour =
        event.type === "agent_error"
          ? RED
          : event.type === "schema_retry"
            ? YELLOW
            : event.type === "agent_done" || event.type === "run_done"
              ? GREEN
              : DIM;
      console.log(`${DIM}${elapsed}ms${RESET} ${colour}${describeEvent(event)}${RESET}`);
    },
  });

  const { artifacts } = result;

  console.log("");
  console.log(`${GREEN}${result.status.toUpperCase()}${RESET} ${domain} in ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log(`cost $${result.usage.costUsd.toFixed(4)}  ${result.usage.inputTokens} in / ${result.usage.outputTokens} out`);

  if (artifacts.score !== null) {
    console.log(`score ${artifacts.score}/100  tier ${artifacts.tier}`);
  }

  if (artifacts.leakage) {
    console.log("");
    console.log("Findings:");
    for (const finding of artifacts.leakage.conversionLeakage) {
      console.log(`  [${finding.impact}] ${finding.title}`);
    }
    for (const finding of artifacts.leakage.competitorLeakage) {
      console.log(`  [${finding.impact}] ${finding.title} ${DIM}(${finding.ownedBy.join(", ")})${RESET}`);
    }
  }

  if (artifacts.copy) {
    console.log("");
    console.log("Sequence:");
    for (const touch of artifacts.copy.touches) {
      console.log(
        `  Day ${String(touch.day).padStart(2, " ")} ${touch.channel.padEnd(8)} ${touch.subject ?? "(no subject)"}`,
      );
      console.log(`         ${DIM}cites: ${touch.referencedFinding}${RESET}`);
    }
  }

  if (result.failures.length) {
    console.log("");
    console.log(`${YELLOW}Degraded:${RESET}`);
    for (const failure of result.failures) {
      console.log(`  ${failure.agent}: ${failure.message}`);
    }
  }

  console.log("");
  console.log(`${DIM}run ${runId} persisted. Open it in the console at /${RESET}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
