import { z } from "zod";
import { EvidenceSchema, MetricSchema } from "../evidence";
import type { AgentSpec } from "./contract";
import type { CompetitorMapOutput } from "./competitor-map";
import type { RecceOutput } from "./recce";
import { OUTPUT_CONTRACT, WEB_SEARCH_TOOL } from "./shared";

export type OrganicVisibilityInput = {
  recce: RecceOutput;
  competitorMap: CompetitorMapOutput;
};

export const VisibilityEntrySchema = z.object({
  domain: z.string().min(1),
  isProspect: z.boolean(),
  indexedContentVolume: MetricSchema,
  topicalCoverage: MetricSchema,
  contentFreshness: MetricSchema,
  rankingTrajectory: z.object({
    direction: z.enum(["rising", "flat", "declining", "unknown"]),
    confidence: z.enum(["high", "medium", "low"]),
    rationale: z.string().min(1),
    evidence: z.array(EvidenceSchema).min(1),
  }),
});
export type VisibilityEntry = z.infer<typeof VisibilityEntrySchema>;

export const OrganicVisibilityOutputSchema = z.object({
  entries: z.array(VisibilityEntrySchema).min(2),
  methodology: z.string().min(1),
  caveats: z.array(z.string()).min(1),
});
export type OrganicVisibilityOutput = z.infer<typeof OrganicVisibilityOutputSchema>;

export const organicVisibilitySpec: AgentSpec<
  OrganicVisibilityInput,
  OrganicVisibilityOutput
> = {
  name: "OrganicVisibilityAgent",
  description:
    "Estimates organic visibility for the prospect and each competitor: indexed content volume, " +
    "topical coverage, freshness and a ranking-trajectory read. Every number is labelled.",
  toolNames: ["fetch_page"],
  serverTools: [WEB_SEARCH_TOOL],
  effort: "high",
  maxTokens: 12000,
  outputSchema: OrganicVisibilityOutputSchema,
  systemPrompt: `
You are OrganicVisibilityAgent. You estimate how visible each company is in
organic search, for the prospect and every competitor you are given.

## The hard rule of this agent

You do not have access to a traffic analytics tool. You cannot know anyone's
monthly organic sessions, and you must not report a figure that implies you do.
No "approximately 12,400 monthly visits". That number would be invented, and
inventing it is the single worst thing this pipeline could do, because the
whole outreach sequence downstream would then be built on a fiction that the
prospect can immediately disprove.

What you can legitimately do:

- Count things you can see. Pages returned by a site: style search, distinct
  topics covered, dates on posts. Those are derived.
- Band things you cannot count. "Somewhere between 50 and 200 indexed pages"
  as kind:"range". "Thin, three service pages and no blog" as
  kind:"qualitative". Those are estimated, and must be labelled so.

Confidence is not decoration. Use "low" freely. A low-confidence honest read is
more useful to a salesperson than a high-confidence guess.

## What to assess, per domain

- indexedContentVolume: roughly how much of this site is in the index.
- topicalCoverage: how many distinct buyer-intent topics they cover.
- contentFreshness: are they still publishing, and when did they last.
- rankingTrajectory: rising, flat, declining or unknown. "unknown" is a real
  and often correct answer. Justify it from what you saw.

## Method

Run searches that reveal footprint: the brand plus its core service, the
service plus the location, question-shaped queries their buyer would type.
Note which domains keep appearing and which never do. You may fetch_page a
competitor's blog or sitemap-ish index page to check publishing cadence.

Include the prospect as one entry with isProspect true, and one entry per
competitor.

## methodology and caveats

State plainly how you arrived at the numbers and what would change them.
A reader should be able to tell exactly how much to trust each figure.

${OUTPUT_CONTRACT}
`.trim(),

  buildUserMessage: ({ recce, competitorMap }) =>
    [
      `Prospect: ${recce.companyName} (${recce.domain})`,
      `Core services: ${recce.services.map((s) => s.name).join(", ")}`,
      `Target market: ${recce.targetMarket}`,
      ``,
      `Competitors:`,
      ...competitorMap.competitors.map(
        (c) => `- ${c.name} (${c.domain}) - ${c.positioningOneLiner}`,
      ),
      ``,
      `Assess organic visibility for the prospect and each competitor.`,
    ].join("\n"),
};
