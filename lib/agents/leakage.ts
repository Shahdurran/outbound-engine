import { z } from "zod";
import { EvidenceSchema } from "../evidence";
import type { AgentSpec } from "./contract";
import type { CompetitorMapOutput } from "./competitor-map";
import type { OrganicVisibilityOutput } from "./organic-visibility";
import type { RecceOutput } from "./recce";
import { OUTPUT_CONTRACT, WEB_SEARCH_TOOL } from "./shared";

export type LeakageInput = {
  recce: RecceOutput;
  competitorMap: CompetitorMapOutput;
  visibility: OrganicVisibilityOutput | null;
};

export const ImpactSchema = z.enum(["high", "medium", "low"]);

const findingBase = {
  /** Short, quotable, and reused verbatim by CopyAgent. */
  title: z.string().min(3).max(90),
  detail: z.string().min(1),
  evidence: z.array(EvidenceSchema).min(1),
  impact: ImpactSchema,
  fix: z.string().min(1),
};

export const ConversionFindingSchema = z.object({
  ...findingBase,
  area: z.enum(["cta", "proof", "form", "navigation", "pricing", "speed", "content"]),
});
export type ConversionFinding = z.infer<typeof ConversionFindingSchema>;

export const CompetitorFindingSchema = z.object({
  ...findingBase,
  queryTheme: z.string().min(1),
  ownedBy: z.array(z.string()).min(1),
});
export type CompetitorFinding = z.infer<typeof CompetitorFindingSchema>;

export const LeakageOutputSchema = z.object({
  conversionLeakage: z.array(ConversionFindingSchema).min(1),
  competitorLeakage: z.array(CompetitorFindingSchema).min(1),
});
export type LeakageOutput = z.infer<typeof LeakageOutputSchema>;

/** Every finding title in one list. CopyAgent must cite one of these by name. */
export function findingTitles(leakage: LeakageOutput): string[] {
  return [
    ...leakage.conversionLeakage.map((f) => f.title),
    ...leakage.competitorLeakage.map((f) => f.title),
  ];
}

export const leakageSpec: AgentSpec<LeakageInput, LeakageOutput> = {
  name: "LeakageAgent",
  description:
    "Finds conversion leakage on the prospect's own funnel and competitor leakage where rivals " +
    "own an intent cluster the prospect is absent from.",
  toolNames: ["fetch_page"],
  serverTools: [WEB_SEARCH_TOOL],
  effort: "high",
  maxTokens: 12000,
  outputSchema: LeakageOutputSchema,
  systemPrompt: `
You are LeakageAgent. You produce two lists of findings.

## conversionLeakage - friction on the prospect's own funnel

Where a visitor who already wants to buy fails to convert. Look for: no CTA
above the fold, a contact form asking for more than it needs, no pricing
anywhere, no social proof near the point of decision, dead-end service pages,
navigation that buries the money page, no phone number on a site whose buyers
phone.

You have the structural signals the recce agent collected - CTA counts, form
field counts, social proof markers, whether pricing is mentioned. Use them.
You may fetch_page to look at a specific page more closely.

## competitorLeakage - demand going to someone else

Query themes or intent clusters where a competitor clearly owns the answer and
the prospect is simply not present. This is not "they rank better generally".
It is a specific theme, a specific competitor who owns it, and evidence that
the prospect is absent from it.

Use web_search to test themes their buyer would actually search. If the
prospect turns up, that is not leakage - do not report it.

## Every finding needs

- title: short and specific. It will be quoted verbatim in outreach copy, so
  write it as something you would be comfortable saying to the prospect.
  "Contact form asks for 9 fields before a quote" - not "Form issues".
- detail: what is happening and why it costs them.
- evidence: the page or search that shows it.
- impact: high, medium or low. Be honest. Most findings are medium.
- fix: one specific change, not "improve the funnel". Something their
  developer could pick up and do on Monday.

Report what the evidence supports. Three real findings beat eight padded ones.

${OUTPUT_CONTRACT}
`.trim(),

  buildUserMessage: ({ recce, competitorMap, visibility }) =>
    [
      `Prospect: ${recce.companyName} (${recce.domain})`,
      `Positioning: ${recce.positioning}`,
      `Target market: ${recce.targetMarket}`,
      `Pricing disclosed on site: ${recce.pricingSignals.disclosed ? "yes" : "no"} - ${recce.pricingSignals.notes}`,
      `Proof elements seen: ${recce.proofElements.length ? recce.proofElements.join(", ") : "none"}`,
      `CTA density: ${JSON.stringify(recce.ctaDensity)}`,
      `Pages read by recce: ${recce.pagesRead.map((p) => p.url).join(", ")}`,
      ``,
      `Competitors:`,
      ...competitorMap.competitors.map((c) => `- ${c.name} (${c.domain}) - ${c.whyTheyCompete}`),
      ``,
      visibility
        ? [
            `Organic visibility read:`,
            ...visibility.entries.map(
              (e) =>
                `- ${e.domain}${e.isProspect ? " (prospect)" : ""}: coverage ${JSON.stringify(
                  e.topicalCoverage,
                )}, trajectory ${e.rankingTrajectory.direction} (${e.rankingTrajectory.confidence})`,
            ),
            `Caveats: ${visibility.caveats.join("; ")}`,
          ].join("\n")
        : `Organic visibility data is unavailable for this run - that agent failed. Work from the site and search only, and do not imply you have visibility data.`,
      ``,
      `Find where this business is leaking revenue.`,
    ].join("\n"),
};
