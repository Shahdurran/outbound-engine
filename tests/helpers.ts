import type { AgentName } from "../lib/agents/names";
import type { Provider, ProviderRequest, ProviderResponse } from "../lib/provider/types";
import type { RecordedRun } from "../fixtures/types";
import { ZERO_USAGE, type TraceEvent } from "../lib/trace";

/** Wraps text in the content-block shape a real response carries. */
export function textResponse(text: string, stopReason = "end_turn"): ProviderResponse {
  return {
    content: [{ type: "text", text, citations: null }],
    stopReason,
    usage: { ...ZERO_USAGE, inputTokens: 100, outputTokens: 50 },
  };
}

/**
 * Serves a scripted list of responses per agent. Anything not scripted throws,
 * so a test that accidentally makes an extra model call fails loudly.
 */
export class ScriptedProvider implements Provider {
  readonly mode = "replay" as const;
  readonly model = "claude-opus-5";
  private cursors = new Map<AgentName, number>();

  constructor(private script: Partial<Record<AgentName, ProviderResponse[]>>) {}

  async createMessage(request: ProviderRequest): Promise<ProviderResponse> {
    const turns = this.script[request.agent];
    if (!turns) throw new Error(`No script for ${request.agent}`);
    const cursor = this.cursors.get(request.agent) ?? 0;
    const turn = turns[cursor];
    if (!turn) throw new Error(`${request.agent} asked for turn ${cursor}, script has ${turns.length}`);
    this.cursors.set(request.agent, cursor + 1);
    return turn;
  }
}

/**
 * Serves each agent's recorded final answer directly, skipping the recorded
 * tool turns. Lets orchestrator tests exercise the whole graph without a
 * database or any tool execution.
 */
export class FinalsOnlyProvider implements Provider {
  readonly mode = "replay" as const;
  readonly model = "claude-opus-5";

  constructor(
    private recording: RecordedRun,
    private failOn: AgentName[] = [],
  ) {}

  async createMessage(request: ProviderRequest): Promise<ProviderResponse> {
    if (this.failOn.includes(request.agent)) {
      throw new Error(`simulated upstream failure in ${request.agent}`);
    }
    const turns = this.recording.agents[request.agent];
    const withFinal = turns.find((turn) => turn.final !== undefined);
    if (!withFinal) throw new Error(`Recording has no final answer for ${request.agent}`);
    return textResponse(JSON.stringify(withFinal.final));
  }
}

export function collectEvents(): { emit: (event: TraceEvent) => void; events: TraceEvent[] } {
  const events: TraceEvent[] = [];
  return { emit: (event) => events.push(event), events };
}
