import type { Tier } from "../config/scoring";
import type { CompetitorMapOutput } from "./agents/competitor-map";
import type { CopyOutput } from "./agents/copy";
import type { LeakageOutput } from "./agents/leakage";
import type { OrganicVisibilityOutput } from "./agents/organic-visibility";
import type { RecceOutput } from "./agents/recce";
import type { ScoringOutput } from "./agents/scoring";
import { getRun, getSteps } from "./db/runs";
import type { RunArtifacts } from "./orchestrator";

/**
 * Rebuilds a run's artifacts from the persisted agent steps.
 *
 * Each step stored the typed output object it produced, so a completed run can
 * be reopened without re-running anything. Parsing is deliberately forgiving:
 * a degraded run has null steps by design and must still render.
 */
function parseStep<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

export function loadArtifacts(runId: string): RunArtifacts {
  const steps = getSteps(runId);
  const run = getRun(runId);
  const byAgent = new Map(steps.map((step) => [step.agent, step]));

  return {
    recce: parseStep<RecceOutput>(byAgent.get("RecceAgent")?.output_json ?? null),
    competitorMap: parseStep<CompetitorMapOutput>(
      byAgent.get("CompetitorMapAgent")?.output_json ?? null,
    ),
    visibility: parseStep<OrganicVisibilityOutput>(
      byAgent.get("OrganicVisibilityAgent")?.output_json ?? null,
    ),
    leakage: parseStep<LeakageOutput>(byAgent.get("LeakageAgent")?.output_json ?? null),
    scoring: parseStep<ScoringOutput>(byAgent.get("ScoringAgent")?.output_json ?? null),
    copy: parseStep<CopyOutput>(byAgent.get("CopyAgent")?.output_json ?? null),
    score: run?.score ?? null,
    tier: (run?.tier as Tier | null) ?? null,
  };
}
