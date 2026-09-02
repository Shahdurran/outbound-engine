/**
 * Scoring weights live here so they are tunable without touching agent code.
 * ScoringAgent receives these in its system prompt and must return a breakdown
 * whose components match these keys exactly - the Zod schema enforces the
 * shape, and the orchestrator recomputes the total from the components rather
 * than trusting the model's arithmetic.
 */

export const SCORING_WEIGHTS = {
  /** Does the company look like who we sell to at all? */
  fit: 0.35,
  /** How badly is the problem we fix actually hurting them right now? */
  painSeverity: 0.3,
  /** Anything suggesting this is the right month, not just the right company. */
  timingSignals: 0.2,
  /** Can we actually get to a decision maker? */
  reachability: 0.15,
} as const;

export type ScoringComponent = keyof typeof SCORING_WEIGHTS;

export const SCORING_COMPONENTS = Object.keys(SCORING_WEIGHTS) as ScoringComponent[];

/** Tier cutoffs on the weighted 0-100 total. */
export const TIER_THRESHOLDS = {
  A: 75,
  B: 50,
} as const;

export type Tier = "A" | "B" | "C";

export function tierFor(score: number): Tier {
  if (score >= TIER_THRESHOLDS.A) return "A";
  if (score >= TIER_THRESHOLDS.B) return "B";
  return "C";
}

/**
 * The model scores each component 0-100; we do the weighting ourselves.
 * Keeping the arithmetic on our side is why the breakdown in the UI always
 * reconciles with the headline number.
 */
export function weightedTotal(components: Record<ScoringComponent, number>): number {
  const total = SCORING_COMPONENTS.reduce(
    (sum, key) => sum + components[key] * SCORING_WEIGHTS[key],
    0,
  );
  return Math.round(Math.max(0, Math.min(100, total)));
}

/**
 * A run that lost sub-agents upstream should not score as confidently as a
 * complete one. Rather than invent a number, we cap the ceiling: a degraded
 * run cannot reach tier A on partial evidence.
 */
export const DEGRADED_SCORE_CEILING = 74;

export function applyDegradedCeiling(score: number, degraded: boolean): number {
  return degraded ? Math.min(score, DEGRADED_SCORE_CEILING) : score;
}
