import { z } from "zod";

/**
 * The anti-fabrication primitive.
 *
 * The brief says: "Do NOT invent metrics. Every number the agents output is
 * either derived from fetched evidence or explicitly labelled as an estimate
 * with a confidence level."
 *
 * A system prompt is a weak place to enforce that, so it is enforced here in
 * the type system instead. Every number an agent emits arrives wrapped in a
 * Metric, and two rules are checked at parse time:
 *
 *   1. An exact number must be `derived` - you may only state a precise figure
 *      if it came from a page we actually fetched or a search result we saw.
 *   2. An `estimated` metric may never be exact. Estimates are ranges or
 *      qualitative bands, never false precision.
 *
 * A model that emits `{ kind: "exact", value: 47000, basis: "estimated" }`
 * fails validation, gets the Zod issue fed back to it, and has to correct
 * itself. See lib/agents/runtime.ts for that retry path.
 */

export const BasisSchema = z.enum(["derived", "estimated"]);
export type Basis = z.infer<typeof BasisSchema>;

export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const EvidenceSchema = z.object({
  /** A URL we fetched, or `search:<query>` for a web_search result. */
  source: z.string().min(1),
  /** The specific text supporting the claim. Keeps the trace auditable. */
  excerpt: z.string().min(1).max(500),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

const metricBase = {
  label: z.string().min(1),
  basis: BasisSchema,
  confidence: ConfidenceSchema,
  evidence: z
    .array(EvidenceSchema)
    .min(1, "every metric needs at least one piece of evidence"),
};

export const MetricSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...metricBase, kind: z.literal("exact"), value: z.number() }),
    z.object({
      ...metricBase,
      kind: z.literal("range"),
      low: z.number(),
      high: z.number(),
      unit: z.string(),
    }),
    z.object({
      ...metricBase,
      kind: z.literal("qualitative"),
      value: z.string().min(1),
    }),
  ])
  .superRefine((metric, ctx) => {
    if (metric.kind === "exact" && metric.basis !== "derived") {
      ctx.addIssue({
        code: "custom",
        message:
          `Metric "${metric.label}" is exact but labelled "${metric.basis}". ` +
          `An exact number must be basis:"derived" and traceable to fetched evidence. ` +
          `If you are estimating, use kind:"range" with low/high, or kind:"qualitative".`,
      });
    }
    if (metric.kind === "range" && metric.low > metric.high) {
      ctx.addIssue({
        code: "custom",
        message: `Metric "${metric.label}" has low (${metric.low}) greater than high (${metric.high}).`,
      });
    }
  });

export type Metric = z.infer<typeof MetricSchema>;

/** Render a Metric for the UI without losing its provenance. */
export function formatMetric(metric: Metric): string {
  switch (metric.kind) {
    case "exact":
      return metric.value.toLocaleString();
    case "range":
      return `${metric.low.toLocaleString()}-${metric.high.toLocaleString()} ${metric.unit}`;
    case "qualitative":
      return metric.value;
  }
}

export function metricIsEstimate(metric: Metric): boolean {
  return metric.basis === "estimated";
}
