import type Anthropic from "@anthropic-ai/sdk";
import type { AgentName } from "../agents/names";
import { costOf } from "../pricing";
import type { RecordedRun, RecordedTurn } from "../../fixtures/types";
import type { Provider, ProviderRequest, ProviderResponse } from "./types";
import { ProviderError } from "./types";

/**
 * Replays a recorded run turn by turn, at the recorded pace.
 *
 * Two properties make this useful rather than a stub:
 *
 *  1. Tool calls in a replayed run are really executed. The recording says
 *     which tools the model asked for; runtime.ts then runs the actual
 *     handlers against the pre-seeded SQLite page cache. So the trace shows
 *     genuine fetch_page results with genuine derived signals, offline.
 *  2. The recorded final outputs are typed against each agent's Zod schema at
 *     build time (see fixtures/types.ts), so a fixture that would fail
 *     validation fails `npm run typecheck` instead of failing at demo time.
 */

const SPEED = Number(process.env.REPLAY_SPEED ?? "1");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function toContentBlocks(turn: RecordedTurn): Anthropic.ContentBlock[] {
  const blocks: Anthropic.ContentBlock[] = [];

  if (turn.preamble) {
    blocks.push({ type: "text", text: turn.preamble, citations: null });
  }

  if (turn.searches) {
    turn.searches.forEach((search, index) => {
      const id = `srvtoolu_replay_${index}`;
      // Shaped exactly like a live server-tool exchange so runtime.ts needs no
      // special case: it sees server_tool_use then *_tool_result either way.
      blocks.push({
        type: "server_tool_use",
        id,
        name: "web_search",
        input: { query: search.query },
      } as unknown as Anthropic.ContentBlock);
      blocks.push({
        type: "web_search_tool_result",
        tool_use_id: id,
        content: search.results.map((result) => ({
          type: "web_search_result",
          title: result.title,
          url: result.url,
          encrypted_content: result.snippet,
          page_age: null,
        })),
      } as unknown as Anthropic.ContentBlock);
    });
  }

  if (turn.toolCalls) {
    turn.toolCalls.forEach((call, index) => {
      blocks.push({
        type: "tool_use",
        id: `replay_${call.name}_${index}_${Math.random().toString(36).slice(2, 8)}`,
        name: call.name,
        input: call.input as Record<string, unknown>,
        caller: { type: "direct" },
      });
    });
  }

  if (turn.final !== undefined) {
    blocks.push({
      type: "text",
      text: JSON.stringify(turn.final, null, 2),
      citations: null,
    });
  }

  return blocks;
}

/**
 * A turn carrying only server-side searches is not an answer - the model ran a
 * web_search and still has to say something. Reporting it as `end_turn` made
 * the runtime treat an empty turn as a malformed final answer and burn its one
 * repair attempt on it, which showed up in the trace as a schema retry that
 * had not actually happened.
 */
function stopReasonFor(turn: RecordedTurn): string {
  if (turn.final !== undefined) return "end_turn";
  if (turn.toolCalls?.length) return "tool_use";
  if (turn.searches?.length) return "pause_turn";
  return "end_turn";
}

export class ReplayProvider implements Provider {
  readonly mode = "replay" as const;
  readonly model: string;
  private cursors = new Map<AgentName, number>();

  constructor(
    private recording: RecordedRun,
    model: string,
  ) {
    this.model = model;
  }

  async createMessage(request: ProviderRequest): Promise<ProviderResponse> {
    const turns = this.recording.agents[request.agent];
    const cursor = this.cursors.get(request.agent) ?? 0;
    const turn = turns[cursor];

    if (!turn) {
      throw new ProviderError(
        `Recording for ${request.agent} has no turn ${cursor}. The fixture and the agent's ` +
          `tool loop have drifted apart - re-record, or run live with ANTHROPIC_API_KEY set.`,
        false,
      );
    }

    this.cursors.set(request.agent, cursor + 1);

    // Pace the replay so the console streams rather than dumping. This is the
    // recorded latency, not an invented delay.
    await sleep(turn.delayMs / (SPEED || 1));

    const counts = {
      inputTokens: turn.usage.input,
      outputTokens: turn.usage.output,
      cacheReadTokens: turn.usage.cacheRead ?? 0,
      cacheCreationTokens: turn.usage.cacheCreation ?? 0,
    };

    return {
      content: toContentBlocks(turn),
      stopReason: stopReasonFor(turn),
      usage: { ...counts, costUsd: costOf(this.model, counts) },
    };
  }
}
