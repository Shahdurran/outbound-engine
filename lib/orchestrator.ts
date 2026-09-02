import { applyDegradedCeiling, tierFor, weightedTotal, type Tier } from "../config/scoring";
import { AGENT_NAMES, type AgentName } from "./agents/names";
import { AgentFailure, type AgentSpec, type RunContext } from "./agents/contract";
import { execute } from "./agents/runtime";
import { toAnthropicTools } from "./tools/registry";
import { competitorMapSpec, type CompetitorMapOutput } from "./agents/competitor-map";
import { buildCopySpec, type CopyOutput } from "./agents/copy";
import { findingTitles, leakageSpec, type LeakageOutput } from "./agents/leakage";
import { organicVisibilitySpec, type OrganicVisibilityOutput } from "./agents/organic-visibility";
import { recceSpec, type RecceOutput } from "./agents/recce";
import { scoringSpec, type ScoringOutput } from "./agents/scoring";
import {
  appendTraceEvent,
  finishRun,
  markStepDone,
  markStepError,
  markStepRunning,
} from "./db/runs";
import { addUsage, ZERO_USAGE, type Emit, type RunStatus, type TokenUsage, type TraceEvent } from "./trace";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * A typed sequential graph.
 *
 * Each step declares what it needs. If a dependency is missing because an
 * earlier agent failed, the step is skipped with an explicit reason rather
 * than being fed a null and asked to improvise. The run continues and ends
 * `degraded`; it does not die.
 *
 * The one exception is RecceAgent. Every other agent's input type contains a
 * RecceOutput, so if the recce fails there is literally nothing to pass on.
 * That case ends the run as `failed`, which is the honest outcome.
 */

export type RunArtifacts = {
  recce: RecceOutput | null;
  competitorMap: CompetitorMapOutput | null;
  visibility: OrganicVisibilityOutput | null;
  leakage: LeakageOutput | null;
  scoring: ScoringOutput | null;
  copy: CopyOutput | null;
  score: number | null;
  tier: Tier | null;
};

export type RunResult = {
  runId: string;
  status: RunStatus;
  durationMs: number;
  usage: TokenUsage;
  artifacts: RunArtifacts;
  failures: { agent: AgentName; message: string }[];
};

export type OrchestratorInput = {
  runId: string;
  domain: string;
  icp: string | null;
  ctx: RunContext;
  emit: Emit;
  /** Persist trace + steps. The headless runner turns this off. */
  persist?: boolean;
};

type StepOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; skipped: boolean; message: string };

export async function runPipeline(input: OrchestratorInput): Promise<RunResult> {
  const { runId, domain, icp, ctx, emit: rawEmit } = input;
  const persist = input.persist ?? true;
  const startedAt = Date.now();

  let seq = 0;
  const emit: Emit = (event) => {
    if (persist) {
      appendTraceEvent(runId, seq, event);
    }
    seq += 1;
    rawEmit(event);
  };

  let usage = ZERO_USAGE;
  const failures: { agent: AgentName; message: string }[] = [];

  emit({
    type: "run_start",
    runId,
    domain,
    icp,
    mode: ctx.provider.mode,
    model: ctx.provider.model,
    ts: Date.now(),
  });

  for (const agent of AGENT_NAMES) {
    emit({ type: "agent_queued", runId, agent, ts: Date.now() });
  }

  /** Runs one agent with timing, usage accounting and error isolation. */
  async function step<TIn, TOut>(
    spec: AgentSpec<TIn, TOut>,
    agentInput: TIn,
  ): Promise<StepOutcome<TOut>> {
    const tools: Anthropic.ToolUnion[] = [
      ...toAnthropicTools(spec.toolNames),
      ...(spec.serverTools ?? []),
    ];

    if (persist) markStepRunning(runId, spec.name);
    emit({ type: "agent_start", runId, agent: spec.name, ts: Date.now() });

    const stepStart = Date.now();
    try {
      const outcome = await execute(spec, ctx, tools, agentInput, emit);
      const durationMs = Date.now() - stepStart;
      usage = addUsage(usage, outcome.usage);

      if (persist) {
        markStepDone({
          runId,
          agent: spec.name,
          durationMs,
          attempts: outcome.attempts,
          usage: outcome.usage,
          output: outcome.output,
        });
      }

      emit({
        type: "agent_done",
        runId,
        agent: spec.name,
        durationMs,
        usage: outcome.usage,
        output: outcome.output,
        ts: Date.now(),
      });

      return { ok: true, value: outcome.output };
    } catch (error) {
      const durationMs = Date.now() - stepStart;
      const message =
        error instanceof AgentFailure
          ? [error.message, ...(error.issues ?? [])].join(" | ")
          : error instanceof Error
            ? error.message
            : String(error);

      failures.push({ agent: spec.name, message });
      if (persist) {
        markStepError({ runId, agent: spec.name, durationMs, attempts: 1, message });
      }
      emit({ type: "agent_error", runId, agent: spec.name, message, durationMs, ts: Date.now() });

      return { ok: false, skipped: false, message };
    }
  }

  /** Records a step that could not run because a dependency was missing. */
  function skip(agent: AgentName, reason: string): StepOutcome<never> {
    const message = `skipped: ${reason}`;
    failures.push({ agent, message });
    if (persist) {
      markStepError({ runId, agent, durationMs: 0, attempts: 0, message });
    }
    emit({ type: "agent_start", runId, agent, ts: Date.now() });
    emit({ type: "agent_error", runId, agent, message, durationMs: 0, ts: Date.now() });
    return { ok: false, skipped: true, message };
  }

  const artifacts: RunArtifacts = {
    recce: null,
    competitorMap: null,
    visibility: null,
    leakage: null,
    scoring: null,
    copy: null,
    score: null,
    tier: null,
  };

  // 1. Recce. Fatal if it fails - nothing downstream has an input without it.
  const recce = await step(recceSpec, { domain, icp });
  if (!recce.ok) {
    for (const agent of AGENT_NAMES.slice(1)) {
      skip(agent, "RecceAgent produced no profile to work from");
    }
    return finalize("failed");
  }
  artifacts.recce = recce.value;

  // 2. Competitors.
  const competitorMap = await step(competitorMapSpec, { recce: recce.value });
  if (competitorMap.ok) artifacts.competitorMap = competitorMap.value;

  // 3. Organic visibility. Needs a competitive set to compare against.
  const visibility = competitorMap.ok
    ? await step(organicVisibilitySpec, {
        recce: recce.value,
        competitorMap: competitorMap.value,
      })
    : skip("OrganicVisibilityAgent", "no competitor set to compare visibility against");
  if (visibility.ok) artifacts.visibility = visibility.value;

  // 4. Leakage. Competitor leakage needs the competitive set; conversion
  //    leakage would survive without it, but a half-populated findings list is
  //    worse than an explicit skip.
  const leakage = competitorMap.ok
    ? await step(leakageSpec, {
        recce: recce.value,
        competitorMap: competitorMap.value,
        visibility: visibility.ok ? visibility.value : null,
      })
    : skip("LeakageAgent", "competitor leakage requires a competitor set");
  if (leakage.ok) artifacts.leakage = leakage.value;

  const degraded = failures.length > 0;

  // 5. Scoring. Only needs the recce, so it runs on every survivable run.
  const scoring = await step(scoringSpec, {
    recce: recce.value,
    competitorMap: competitorMap.ok ? competitorMap.value : null,
    visibility: visibility.ok ? visibility.value : null,
    leakage: leakage.ok ? leakage.value : null,
    icp,
    degraded,
  });

  if (scoring.ok) {
    artifacts.scoring = scoring.value;
    // The weighting is ours, not the model's, so the breakdown in the UI
    // always reconciles with the headline number.
    const raw = weightedTotal({
      fit: scoring.value.components.fit.score,
      painSeverity: scoring.value.components.painSeverity.score,
      timingSignals: scoring.value.components.timingSignals.score,
      reachability: scoring.value.components.reachability.score,
    });
    artifacts.score = applyDegradedCeiling(raw, degraded);
    artifacts.tier = tierFor(artifacts.score);
  }

  // 6. Copy. Needs findings to cite, by definition.
  if (leakage.ok) {
    const titles = findingTitles(leakage.value);
    const copy = await step(buildCopySpec(titles), {
      recce: recce.value,
      leakage: leakage.value,
      scoring: scoring.ok ? scoring.value : null,
      score: artifacts.score ?? 0,
      tier: artifacts.tier ?? "C",
    });
    if (copy.ok) artifacts.copy = copy.value;
  } else {
    skip("CopyAgent", "no findings available to reference");
  }

  return finalize(failures.length === 0 ? "complete" : "degraded");

  function finalize(status: RunStatus): RunResult {
    const durationMs = Date.now() - startedAt;

    const doneEvent: TraceEvent = {
      type: "run_done",
      runId,
      status,
      durationMs,
      usage,
      ts: Date.now(),
    };
    emit(doneEvent);

    if (persist) {
      finishRun({
        runId,
        status,
        durationMs,
        usage,
        score: artifacts.score,
        tier: artifacts.tier,
        error: failures.length ? failures.map((f) => `${f.agent}: ${f.message}`).join("\n") : null,
      });
    }

    return { runId, status, durationMs, usage, artifacts, failures };
  }
}
