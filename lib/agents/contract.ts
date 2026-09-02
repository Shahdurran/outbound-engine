import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";
import type { Emit } from "../trace";
import type { Provider } from "../provider/types";
import type { AgentName } from "./names";

/**
 * The contract every sub-agent satisfies, exactly as briefed.
 *
 * The rule that makes this design worth anything: a sub-agent receives the
 * typed output object of the agents before it and nothing else. No shared
 * message history, no accumulated scratchpad, no "context" bag. Each agent
 * starts from a freshly built message array (see runtime.ts), so the isolation
 * is structural - there is no shared thing available to leak even by accident.
 */
export type SubAgent<TIn, TOut> = {
  name: AgentName;
  description: string;
  tools: Anthropic.ToolUnion[];
  systemPrompt: string;
  outputSchema: z.ZodType<TOut>;
  run(input: TIn, emit: Emit): Promise<TOut>;
};

/**
 * What an agent module actually declares. Everything here is data; the loop,
 * validation, repair retry and tracing come from runtime.ts. Adding a seventh
 * sub-agent means writing one of these, not writing another loop.
 */
export type AgentSpec<TIn, TOut> = {
  name: AgentName;
  description: string;
  /** Custom tool names resolved through lib/tools/registry.ts. */
  toolNames: readonly string[];
  /** Anthropic server-side tools, passed through untouched. */
  serverTools?: readonly Anthropic.ToolUnion[];
  systemPrompt: string;
  outputSchema: z.ZodType<TOut>;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** Renders the typed input from upstream agents into this agent's only user turn. */
  buildUserMessage(input: TIn): string;
};

export type RunContext = {
  runId: string;
  provider: Provider;
};

export class AgentFailure extends Error {
  constructor(
    readonly agent: AgentName,
    message: string,
    readonly issues?: string[],
  ) {
    super(message);
    this.name = "AgentFailure";
  }
}
