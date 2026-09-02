import type { TokenUsage } from "./trace";

/**
 * Per-million-token prices, so the console can show real cost per sub-agent
 * rather than a token count nobody can price. Cache reads bill at ~0.1x input
 * and cache writes at ~1.25x, which is what makes the per-agent system-prompt
 * caching in runtime.ts worth doing on re-runs.
 */
type Price = { input: number; output: number };

const PRICES: Record<string, Price> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

const FALLBACK: Price = { input: 5, output: 25 };

export function priceFor(model: string): Price {
  return PRICES[model] ?? FALLBACK;
}

export type TokenCounts = Pick<
  TokenUsage,
  "inputTokens" | "outputTokens" | "cacheReadTokens" | "cacheCreationTokens"
>;

export function costOf(model: string, counts: TokenCounts): number {
  const price = priceFor(model);
  const perInputToken = price.input / 1_000_000;
  return (
    counts.inputTokens * perInputToken +
    counts.cacheReadTokens * perInputToken * 0.1 +
    counts.cacheCreationTokens * perInputToken * 1.25 +
    counts.outputTokens * (price.output / 1_000_000)
  );
}
