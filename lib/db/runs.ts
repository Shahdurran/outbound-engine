import { getDb } from "./index";
import { AGENT_NAMES, type AgentName } from "../agents/names";
import type { RunMode, RunStatus, TokenUsage, TraceEvent } from "../trace";

export type RunRow = {
  id: string;
  domain: string;
  icp: string | null;
  status: RunStatus;
  mode: RunMode;
  model: string;
  created_at: number;
  completed_at: number | null;
  duration_ms: number | null;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cost_usd: number;
  score: number | null;
  tier: string | null;
  error: string | null;
};

export type AgentStepRow = {
  run_id: string;
  agent: AgentName;
  step_index: number;
  status: "queued" | "running" | "done" | "error";
  started_at: number | null;
  duration_ms: number | null;
  attempts: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  output_json: string | null;
  error: string | null;
};

export function createRun(input: {
  id: string;
  domain: string;
  icp: string | null;
  mode: RunMode;
  model: string;
}): void {
  const db = getDb();
  const now = Date.now();

  db.prepare(
    `INSERT INTO runs (id, domain, icp, status, mode, model, created_at)
     VALUES (@id, @domain, @icp, 'running', @mode, @model, @created_at)`,
  ).run({ ...input, created_at: now });

  // Pre-create every step as `queued` so the console can render the full graph
  // before the first agent starts, rather than popping cards in one at a time.
  const insertStep = db.prepare(
    `INSERT INTO agent_steps (run_id, agent, step_index, status)
     VALUES (?, ?, ?, 'queued')`,
  );
  const seed = db.transaction(() => {
    AGENT_NAMES.forEach((agent, index) => insertStep.run(input.id, agent, index));
  });
  seed();
}

export function appendTraceEvent(runId: string, seq: number, event: TraceEvent): void {
  getDb()
    .prepare(
      `INSERT INTO trace_events (run_id, seq, type, ts, payload)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(runId, seq, event.type, event.ts, JSON.stringify(event));
}

export function markStepRunning(runId: string, agent: AgentName): void {
  getDb()
    .prepare(
      `UPDATE agent_steps SET status = 'running', started_at = ?
       WHERE run_id = ? AND agent = ?`,
    )
    .run(Date.now(), runId, agent);
}

export function markStepDone(input: {
  runId: string;
  agent: AgentName;
  durationMs: number;
  attempts: number;
  usage: TokenUsage;
  output: unknown;
}): void {
  getDb()
    .prepare(
      `UPDATE agent_steps
       SET status = 'done', duration_ms = @durationMs, attempts = @attempts,
           input_tokens = @inputTokens, output_tokens = @outputTokens,
           cost_usd = @costUsd, output_json = @output
       WHERE run_id = @runId AND agent = @agent`,
    )
    .run({
      runId: input.runId,
      agent: input.agent,
      durationMs: input.durationMs,
      attempts: input.attempts,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      costUsd: input.usage.costUsd,
      output: JSON.stringify(input.output),
    });
}

export function markStepError(input: {
  runId: string;
  agent: AgentName;
  durationMs: number;
  attempts: number;
  message: string;
}): void {
  getDb()
    .prepare(
      `UPDATE agent_steps
       SET status = 'error', duration_ms = @durationMs, attempts = @attempts, error = @message
       WHERE run_id = @runId AND agent = @agent`,
    )
    .run(input);
}

export function finishRun(input: {
  runId: string;
  status: RunStatus;
  durationMs: number;
  usage: TokenUsage;
  score: number | null;
  tier: string | null;
  error: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE runs
       SET status = @status, completed_at = @completedAt, duration_ms = @durationMs,
           input_tokens = @inputTokens, output_tokens = @outputTokens,
           cache_read_tokens = @cacheReadTokens, cost_usd = @costUsd,
           score = @score, tier = @tier, error = @error
       WHERE id = @runId`,
    )
    .run({
      runId: input.runId,
      status: input.status,
      completedAt: Date.now(),
      durationMs: input.durationMs,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cacheReadTokens: input.usage.cacheReadTokens,
      costUsd: input.usage.costUsd,
      score: input.score,
      tier: input.tier,
      error: input.error,
    });
}

export function listRuns(limit = 25): RunRow[] {
  return getDb()
    .prepare(`SELECT * FROM runs ORDER BY created_at DESC LIMIT ?`)
    .all(limit) as RunRow[];
}

export function getRun(runId: string): RunRow | undefined {
  return getDb().prepare(`SELECT * FROM runs WHERE id = ?`).get(runId) as RunRow | undefined;
}

export function getSteps(runId: string): AgentStepRow[] {
  return getDb()
    .prepare(`SELECT * FROM agent_steps WHERE run_id = ? ORDER BY step_index`)
    .all(runId) as AgentStepRow[];
}

export function getTrace(runId: string): TraceEvent[] {
  const rows = getDb()
    .prepare(`SELECT payload FROM trace_events WHERE run_id = ? ORDER BY seq`)
    .all(runId) as { payload: string }[];
  return rows.map((row) => JSON.parse(row.payload) as TraceEvent);
}
