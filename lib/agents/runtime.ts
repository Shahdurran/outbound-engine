import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { runTool, toAnthropicTools } from "../tools/registry";
import { addUsage, ZERO_USAGE, type Emit, type TokenUsage } from "../trace";
import { AgentFailure, type AgentSpec, type RunContext, type SubAgent } from "./contract";

/**
 * The one loop every sub-agent runs through.
 *
 * Responsibilities, in order:
 *   1. Build a fresh message array (never shared between agents)
 *   2. Call the provider
 *   3. Execute any tool calls and feed results back
 *   4. Parse the final turn as JSON and validate it against the agent's schema
 *   5. On schema failure, feed the Zod issues back to the model exactly once
 *
 * Because this is the only place any of that happens, "every agent validates
 * its output and retries once" is a property of the system rather than
 * something six files each remember to do.
 */

const MAX_TOOL_ROUNDS = 8;
const MAX_SCHEMA_ATTEMPTS = 2;

export type AgentOutcome<TOut> = {
  output: TOut;
  usage: TokenUsage;
  attempts: number;
};

/** Models wrap JSON in prose or fences often enough that this is not optional. */
export function extractJson(text: string): unknown {
  const trimmed = text.trim();

  const direct = tryParse(trimmed);
  if (direct.ok) return direct.value;

  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed.ok) return parsed.value;
  }

  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last > first) {
    const parsed = tryParse(trimmed.slice(first, last + 1));
    if (parsed.ok) return parsed.value;
  }

  throw new Error("no parseable JSON object in the model's final turn");
}

function tryParse(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** Flatten Zod issues into lines the model can actually act on. */
export function describeIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

type UnknownBlock = { type: string; [key: string]: unknown };

function isServerToolUse(block: UnknownBlock): block is UnknownBlock & {
  id: string;
  name: string;
  input: unknown;
} {
  return block.type === "server_tool_use";
}

function isServerToolResult(block: UnknownBlock): block is UnknownBlock & {
  tool_use_id: string;
  content: unknown;
} {
  return typeof block.type === "string" && block.type.endsWith("_tool_result");
}

function summariseServerResult(content: unknown): { ok: boolean; summary: string } {
  if (Array.isArray(content)) {
    return { ok: true, summary: `${content.length} results` };
  }
  if (content && typeof content === "object" && "error_code" in content) {
    return { ok: false, summary: String((content as { error_code: unknown }).error_code) };
  }
  return { ok: true, summary: "ok" };
}

export function createAgent<TIn, TOut>(
  spec: AgentSpec<TIn, TOut>,
  ctx: RunContext,
): SubAgent<TIn, TOut> {
  const tools: Anthropic.ToolUnion[] = [
    ...toAnthropicTools(spec.toolNames),
    ...(spec.serverTools ?? []),
  ];

  return {
    name: spec.name,
    description: spec.description,
    tools,
    systemPrompt: spec.systemPrompt,
    outputSchema: spec.outputSchema,

    async run(input: TIn, emit: Emit): Promise<TOut> {
      const outcome = await execute(spec, ctx, tools, input, emit);
      return outcome.output;
    },
  };
}

/**
 * Same as `run`, but also returns usage and attempt count. The orchestrator
 * uses this; `SubAgent.run` is the narrower contract-conformant wrapper.
 */
export async function execute<TIn, TOut>(
  spec: AgentSpec<TIn, TOut>,
  ctx: RunContext,
  tools: Anthropic.ToolUnion[],
  input: TIn,
  emit: Emit,
): Promise<AgentOutcome<TOut>> {
  // Fresh every time. This is the isolation guarantee.
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: spec.buildUserMessage(input) },
  ];

  let usage = ZERO_USAGE;
  let attempt = 1;
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds += 1;

    emit({
      type: "model_call",
      runId: ctx.runId,
      agent: spec.name,
      attempt,
      ts: Date.now(),
    });

    const response = await ctx.provider.createMessage({
      agent: spec.name,
      system: spec.systemPrompt,
      messages,
      tools,
      maxTokens: spec.maxTokens,
      effort: spec.effort,
    });

    usage = addUsage(usage, response.usage);

    const blocks = response.content as unknown as UnknownBlock[];

    // Server tools (web_search) execute on Anthropic's side; their calls and
    // results arrive inline. Surface them in the trace like any other tool.
    for (const block of blocks) {
      if (isServerToolUse(block)) {
        emit({
          type: "tool_call",
          runId: ctx.runId,
          agent: spec.name,
          callId: block.id,
          tool: block.name,
          args: block.input,
          ts: Date.now(),
        });
      } else if (isServerToolResult(block)) {
        const { ok, summary } = summariseServerResult(block.content);
        emit({
          type: "tool_result",
          runId: ctx.runId,
          agent: spec.name,
          callId: block.tool_use_id,
          tool: "web_search",
          ok,
          summary,
          cached: false,
          durationMs: 0,
          ts: Date.now(),
        });
      }
    }

    const clientToolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (clientToolUses.length > 0) {
      messages.push({ role: "assistant", content: response.content });

      // Run them concurrently, then return every result in one user message.
      // Splitting results across messages trains the model out of parallel
      // tool use, which would make runs slower for no reason.
      const results = await Promise.all(
        clientToolUses.map(async (call) => {
          emit({
            type: "tool_call",
            runId: ctx.runId,
            agent: spec.name,
            callId: call.id,
            tool: call.name,
            args: call.input,
            ts: Date.now(),
          });

          const startedAt = Date.now();
          const result = await runTool(call.name, call.input);
          const durationMs = Date.now() - startedAt;

          emit({
            type: "tool_result",
            runId: ctx.runId,
            agent: spec.name,
            callId: call.id,
            tool: call.name,
            ok: !result.isError,
            summary: result.summary,
            cached: result.cached ?? false,
            durationMs,
            ts: Date.now(),
          });

          const block: Anthropic.ToolResultBlockParam = {
            type: "tool_result",
            tool_use_id: call.id,
            content: JSON.stringify(result.content),
            is_error: result.isError ?? false,
          };
          return block;
        }),
      );

      messages.push({ role: "user", content: results });
      continue;
    }

    const text = textOf(response.content);

    // `pause_turn` means a server tool is mid-flight. A turn with no text at
    // all is the same situation by another name: the model used a server tool
    // and has not answered yet. Treating either as a malformed final answer
    // would waste the single repair attempt on a turn that was never wrong.
    if (response.stopReason === "pause_turn" || text.length === 0) {
      messages.push({
        role: "assistant",
        content: response.content.length ? response.content : "(continuing)",
      });
      continue;
    }

    // Final turn: parse and validate.
    let issues: string[];

    try {
      const candidate = extractJson(text);
      const parsed = spec.outputSchema.safeParse(candidate);
      if (parsed.success) {
        return { output: parsed.data, usage, attempts: attempt };
      }
      issues = describeIssues(parsed.error);
    } catch (error) {
      issues = [error instanceof Error ? error.message : String(error)];
    }

    if (attempt >= MAX_SCHEMA_ATTEMPTS) {
      throw new AgentFailure(
        spec.name,
        `output failed schema validation after ${attempt} attempts`,
        issues,
      );
    }

    emit({
      type: "schema_retry",
      runId: ctx.runId,
      agent: spec.name,
      issues,
      ts: Date.now(),
    });

    attempt += 1;
    messages.push({ role: "assistant", content: text || "(no output)" });
    messages.push({
      role: "user",
      content:
        `Your response did not satisfy the output schema. Fix these problems and return ` +
        `the corrected JSON object only, with no prose and no code fences:\n\n` +
        issues.map((issue) => `- ${issue}`).join("\n"),
    });
  }

  throw new AgentFailure(
    spec.name,
    `exceeded ${MAX_TOOL_ROUNDS} tool rounds without producing a final answer`,
  );
}
