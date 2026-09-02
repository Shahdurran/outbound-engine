import type { AgentName } from "../lib/agents/names";

/**
 * A recorded run.
 *
 * Fixtures are TypeScript, not JSON, on purpose: each agent's recorded final
 * output is declared as its own `RecceOutput` / `LeakageOutput` / etc., so the
 * compiler checks the recording against the live schemas. If someone changes
 * an agent's output shape and forgets the fixture, `npm run typecheck` fails
 * rather than the demo failing in front of a client.
 *
 * The runtime refinements (evidence rules, copy rules) are checked separately
 * in tests/fixtures.test.ts, which parses every fixture through the real Zod
 * schemas.
 */

export type RecordedUsage = {
  input: number;
  output: number;
  cacheRead?: number;
  cacheCreation?: number;
};

export type RecordedSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type RecordedSearch = {
  query: string;
  results: RecordedSearchResult[];
};

export type RecordedTurn = {
  /** Recorded latency, replayed so the console streams at a realistic pace. */
  delayMs: number;
  usage: RecordedUsage;
  /** Optional text the model emitted alongside its tool calls. */
  preamble?: string;
  /**
   * Server-side web searches captured at record time. Replayed as
   * server_tool_use + web_search_tool_result blocks so they appear in the
   * trace exactly as a live search would.
   */
  searches?: RecordedSearch[];
  /** Client tools the model asked for. These are really executed on replay. */
  toolCalls?: { name: string; input: unknown }[];
  /** The final structured answer. Serialized to JSON as the model's last turn. */
  final?: unknown;
};

/** A page captured at record time, replayed into the SQLite page cache. */
export type RecordedPage = {
  url: string;
  html: string;
};

export type RecordedRun = {
  domain: string;
  /** Shown in the UI as a suggested demo target. */
  label: string;
  icp: string;
  pages: RecordedPage[];
  agents: Record<AgentName, RecordedTurn[]>;
};
