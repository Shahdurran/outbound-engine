import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { AgentSpec } from "../lib/agents/contract";
import { AgentFailure } from "../lib/agents/contract";
import { execute, extractJson } from "../lib/agents/runtime";
import { ZERO_USAGE } from "../lib/trace";
import { collectEvents, ScriptedProvider, textResponse } from "./helpers";

const OutputSchema = z.object({ score: z.number(), note: z.string() });

const spec: AgentSpec<{ domain: string }, z.infer<typeof OutputSchema>> = {
  name: "ScoringAgent",
  description: "test agent",
  toolNames: [],
  systemPrompt: "return json",
  outputSchema: OutputSchema,
  effort: "low",
  maxTokens: 512,
  buildUserMessage: (input) => `score ${input.domain}`,
};

describe("extractJson", () => {
  it("parses a bare object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a fenced block", () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it("parses an object buried in prose", () => {
    expect(extractJson('Here you go:\n{"a":1}\nHope that helps.')).toEqual({ a: 1 });
  });

  it("throws when there is no object at all", () => {
    expect(() => extractJson("no json here")).toThrow();
  });
});

describe("schema repair retry", () => {
  it("feeds the validation error back and accepts the corrected second attempt", async () => {
    const provider = new ScriptedProvider({
      ScoringAgent: [
        textResponse('{"score":"high","note":"oops, score is a string"}'),
        textResponse('{"score":81,"note":"corrected"}'),
      ],
    });
    const { emit, events } = collectEvents();

    const outcome = await execute(spec, { runId: "r1", provider }, [], { domain: "x.com" }, emit);

    expect(outcome.output).toEqual({ score: 81, note: "corrected" });
    expect(outcome.attempts).toBe(2);

    const retry = events.find((event) => event.type === "schema_retry");
    expect(retry).toBeDefined();
    expect(JSON.stringify(retry)).toContain("score");
  });

  it("gives up after the second failure rather than looping", async () => {
    const provider = new ScriptedProvider({
      ScoringAgent: [textResponse('{"score":"a"}'), textResponse('{"score":"still bad"}')],
    });
    const { emit } = collectEvents();

    await expect(
      execute(spec, { runId: "r1", provider }, [], { domain: "x.com" }, emit),
    ).rejects.toBeInstanceOf(AgentFailure);
  });

  it("treats a server-tool turn with no answer as a continuation, not a schema failure", async () => {
    // Regression: a turn carrying only web_search blocks was being read as a
    // malformed final answer, which burned the single repair attempt and put a
    // schema retry in the trace that had never happened.
    const provider = new ScriptedProvider({
      ScoringAgent: [
        { content: [], stopReason: "pause_turn", usage: { ...ZERO_USAGE } },
        textResponse('{"score":70,"note":"answered after the search"}'),
      ],
    });
    const { emit, events } = collectEvents();

    const outcome = await execute(spec, { runId: "r1", provider }, [], { domain: "x.com" }, emit);

    expect(outcome.attempts).toBe(1);
    expect(events.some((event) => event.type === "schema_retry")).toBe(false);
  });

  it("does not share a message array between agents", async () => {
    // Two runs of the same spec must each start from a single user turn.
    const seen: number[] = [];
    const provider = {
      mode: "replay" as const,
      model: "claude-opus-5",
      async createMessage(request: { messages: unknown[] }) {
        seen.push(request.messages.length);
        return textResponse('{"score":50,"note":"ok"}');
      },
    };
    const { emit } = collectEvents();

    await execute(spec, { runId: "r1", provider }, [], { domain: "a.com" }, emit);
    await execute(spec, { runId: "r1", provider }, [], { domain: "b.com" }, emit);

    expect(seen).toEqual([1, 1]);
  });
});
