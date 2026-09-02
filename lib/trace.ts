import type { AgentName } from "./agents/names";

/**
 * Trace events are the contract between the orchestrator and everything that
 * watches it: the SSE endpoint, the React console, the persisted replay, and
 * the headless Agent SDK runner. The orchestrator knows about none of those
 * consumers - it just emits.
 */

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
};

export const ZERO_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  costUsd: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    costUsd: a.costUsd + b.costUsd,
  };
}

export type RunStatus = "running" | "complete" | "degraded" | "failed";
export type RunMode = "live" | "replay";

export type TraceEvent =
  | {
      type: "run_start";
      runId: string;
      domain: string;
      icp: string | null;
      mode: RunMode;
      model: string;
      ts: number;
    }
  | { type: "agent_queued"; runId: string; agent: AgentName; ts: number }
  | { type: "agent_start"; runId: string; agent: AgentName; ts: number }
  | {
      type: "model_call";
      runId: string;
      agent: AgentName;
      attempt: number;
      ts: number;
    }
  | {
      type: "tool_call";
      runId: string;
      agent: AgentName;
      callId: string;
      tool: string;
      args: unknown;
      ts: number;
    }
  | {
      type: "tool_result";
      runId: string;
      agent: AgentName;
      callId: string;
      tool: string;
      ok: boolean;
      summary: string;
      cached: boolean;
      durationMs: number;
      ts: number;
    }
  | {
      type: "schema_retry";
      runId: string;
      agent: AgentName;
      issues: string[];
      ts: number;
    }
  | {
      type: "agent_done";
      runId: string;
      agent: AgentName;
      durationMs: number;
      usage: TokenUsage;
      output: unknown;
      ts: number;
    }
  | {
      type: "agent_error";
      runId: string;
      agent: AgentName;
      message: string;
      durationMs: number;
      ts: number;
    }
  | {
      type: "run_done";
      runId: string;
      status: RunStatus;
      durationMs: number;
      usage: TokenUsage;
      ts: number;
    };

export type Emit = (event: TraceEvent) => void;

/** Short, human-readable one-liner. Used by the headless CLI runner. */
export function describeEvent(event: TraceEvent): string {
  switch (event.type) {
    case "run_start":
      return `run ${event.runId} ${event.domain} (${event.mode}, ${event.model})`;
    case "agent_queued":
      return `${event.agent} queued`;
    case "agent_start":
      return `${event.agent} start`;
    case "model_call":
      return `${event.agent} model call (attempt ${event.attempt})`;
    case "tool_call":
      return `${event.agent} -> ${event.tool}(${JSON.stringify(event.args).slice(0, 120)})`;
    case "tool_result":
      return `${event.agent} <- ${event.tool} ${event.ok ? "ok" : "ERR"} ${event.summary}${
        event.cached ? " [cache]" : ""
      } ${event.durationMs}ms`;
    case "schema_retry":
      return `${event.agent} schema retry: ${event.issues.join("; ")}`;
    case "agent_done":
      return `${event.agent} done ${event.durationMs}ms ${event.usage.inputTokens}in/${event.usage.outputTokens}out`;
    case "agent_error":
      return `${event.agent} FAILED ${event.message}`;
    case "run_done":
      return `run ${event.status} in ${event.durationMs}ms, cost ${event.usage.costUsd.toFixed(4)} USD`;
  }
}
