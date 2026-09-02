import { AGENT_NAMES, type AgentName } from "../lib/agents/names";
import type { RunArtifacts } from "../lib/orchestrator";
import { addUsage, ZERO_USAGE, type RunMode, type RunStatus, type TokenUsage, type TraceEvent } from "../lib/trace";

/**
 * The console is a pure reduction over the trace event stream.
 *
 * That is the point of persisting trace events: a live run and a run reopened
 * from SQLite go through this identical reducer, so there is no second code
 * path that could render history differently from the thing you just watched.
 */

export type CardStatus = "queued" | "running" | "done" | "error";

export type ToolCallRow = {
  callId: string;
  tool: string;
  args: unknown;
  ts: number;
  ok?: boolean;
  summary?: string;
  cached?: boolean;
  durationMs?: number;
};

export type TraceLine = {
  ts: number;
  text: string;
  tone: "muted" | "normal" | "accent" | "warn" | "error";
  indent: number;
};

export type AgentCard = {
  name: AgentName;
  status: CardStatus;
  attempt: number;
  durationMs: number | null;
  usage: TokenUsage | null;
  output: unknown;
  error: string | null;
  toolCalls: ToolCallRow[];
  retries: string[][];
  lines: TraceLine[];
};

export type ConsoleState = {
  runId: string | null;
  domain: string | null;
  mode: RunMode;
  model: string;
  status: RunStatus | "idle";
  startedAt: number | null;
  durationMs: number | null;
  usage: TokenUsage;
  cards: AgentCard[];
  artifacts: RunArtifacts | null;
  failures: { agent: string; message: string }[];
  error: string | null;
};

function blankCard(name: AgentName): AgentCard {
  return {
    name,
    status: "queued",
    attempt: 0,
    durationMs: null,
    usage: null,
    output: null,
    error: null,
    toolCalls: [],
    retries: [],
    lines: [],
  };
}

export function initialState(mode: RunMode, model: string): ConsoleState {
  return {
    runId: null,
    domain: null,
    mode,
    model,
    status: "idle",
    startedAt: null,
    durationMs: null,
    usage: ZERO_USAGE,
    cards: AGENT_NAMES.map(blankCard),
    artifacts: null,
    failures: [],
    error: null,
  };
}

function updateCard(
  state: ConsoleState,
  name: AgentName,
  change: (card: AgentCard) => AgentCard,
): ConsoleState {
  return {
    ...state,
    cards: state.cards.map((card) => (card.name === name ? change(card) : card)),
  };
}

function withLine(card: AgentCard, line: TraceLine): AgentCard {
  return { ...card, lines: [...card.lines, line] };
}

export function reduceEvent(state: ConsoleState, event: TraceEvent): ConsoleState {
  switch (event.type) {
    case "run_start":
      return {
        ...initialState(event.mode, event.model),
        runId: event.runId,
        domain: event.domain,
        status: "running",
        startedAt: event.ts,
      };

    case "agent_queued":
      return state;

    case "agent_start":
      return updateCard(state, event.agent, (card) => ({
        ...card,
        status: "running",
        lines: [...card.lines, { ts: event.ts, text: "start", tone: "accent", indent: 0 }],
      }));

    case "model_call":
      return updateCard(state, event.agent, (card) =>
        withLine({ ...card, attempt: event.attempt }, {
          ts: event.ts,
          text: event.attempt > 1 ? `model call (repair attempt ${event.attempt})` : "model call",
          tone: "muted",
          indent: 1,
        }),
      );

    case "tool_call":
      return updateCard(state, event.agent, (card) =>
        withLine(
          {
            ...card,
            toolCalls: [
              ...card.toolCalls,
              { callId: event.callId, tool: event.tool, args: event.args, ts: event.ts },
            ],
          },
          {
            ts: event.ts,
            text: `-> ${event.tool}(${compactArgs(event.args)})`,
            tone: "normal",
            indent: 2,
          },
        ),
      );

    case "tool_result":
      return updateCard(state, event.agent, (card) =>
        withLine(
          {
            ...card,
            toolCalls: card.toolCalls.map((row) =>
              row.callId === event.callId
                ? {
                    ...row,
                    ok: event.ok,
                    summary: event.summary,
                    cached: event.cached,
                    durationMs: event.durationMs,
                  }
                : row,
            ),
          },
          {
            ts: event.ts,
            text: `<- ${event.ok ? "ok" : "ERR"} ${event.summary}${event.cached ? "  [cache]" : ""}${
              event.durationMs ? `  ${event.durationMs}ms` : ""
            }`,
            tone: event.ok ? "muted" : "error",
            indent: 2,
          },
        ),
      );

    case "schema_retry":
      return updateCard(state, event.agent, (card) =>
        withLine(
          { ...card, retries: [...card.retries, event.issues] },
          {
            ts: event.ts,
            text: `schema rejected: ${event.issues.length} issue${event.issues.length === 1 ? "" : "s"}, feeding back`,
            tone: "warn",
            indent: 1,
          },
        ),
      );

    case "agent_done":
      return updateCard(state, event.agent, (card) =>
        withLine(
          {
            ...card,
            status: "done",
            durationMs: event.durationMs,
            usage: event.usage,
            output: event.output,
          },
          {
            ts: event.ts,
            text: `done  ${event.durationMs}ms  ${event.usage.inputTokens}in/${event.usage.outputTokens}out  $${event.usage.costUsd.toFixed(4)}`,
            tone: "accent",
            indent: 0,
          },
        ),
      );

    case "agent_error":
      return updateCard(state, event.agent, (card) =>
        withLine(
          { ...card, status: "error", durationMs: event.durationMs, error: event.message },
          { ts: event.ts, text: event.message, tone: "error", indent: 0 },
        ),
      );

    case "run_done":
      return { ...state, status: event.status, durationMs: event.durationMs, usage: event.usage };
  }
}

export function replayTrace(
  events: TraceEvent[],
  mode: RunMode,
  model: string,
): ConsoleState {
  return events.reduce(reduceEvent, initialState(mode, model));
}

function compactArgs(args: unknown): string {
  if (args === null || args === undefined) return "";
  const json = JSON.stringify(args);
  if (!json) return "";
  const inner = json.startsWith("{") ? json.slice(1, -1) : json;
  return inner.length > 96 ? `${inner.slice(0, 96)}...` : inner;
}

export function aggregateUsage(cards: AgentCard[]): TokenUsage {
  return cards.reduce((total, card) => (card.usage ? addUsage(total, card.usage) : total), ZERO_USAGE);
}
