import type Anthropic from "@anthropic-ai/sdk";
import type { AgentName } from "../agents/names";
import type { RunMode, TokenUsage } from "../trace";

/**
 * The seam.
 *
 * Everything above this interface - the tool loop, Zod validation, the retry,
 * the trace emitter, the orchestrator, the UI - is identical whether the run
 * is hitting the Anthropic API or replaying a recording. There is no `if
 * (mock)` anywhere in agent code, which is the only way the replayed console
 * can be trusted to look like the live one.
 */

export type ProviderRequest = {
  agent: AgentName;
  system: string;
  messages: Anthropic.MessageParam[];
  tools: Anthropic.ToolUnion[];
  maxTokens: number;
  effort: "low" | "medium" | "high";
};

export type ProviderResponse = {
  content: Anthropic.ContentBlock[];
  stopReason: string | null;
  usage: TokenUsage;
};

export interface Provider {
  readonly mode: RunMode;
  readonly model: string;
  createMessage(request: ProviderRequest): Promise<ProviderResponse>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
