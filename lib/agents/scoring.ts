import { z } from "zod";
import { SCORING_WEIGHTS } from "../../config/scoring";
import type { AgentSpec } from "./contract";
import type { CompetitorMapOutput } from "./competitor-map";
import type { LeakageOutput } from "./leakage";
import type { OrganicVisibilityOutput } from "./organic-visibility";
import type { RecceOutput } from "./recce";
import { OUTPUT_CONTRACT } from "./shared";

export type ScoringInput = {
  recce: RecceOutput;
  competitorMap: CompetitorMapOutput | null;
  visibility: OrganicVisibilityOutput | null;
  leakage: LeakageOutput | null;
  icp: string | null;
  degraded: boolean;
};

const ComponentSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string().min(1),
});

export const ScoringOutputSchema = z.object({
  components: z.object({
    fit: ComponentSchema,
    painSeverity: ComponentSchema,
    timingSignals: ComponentSchema,
    reachability: ComponentSchema,
  }),
  rationale: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
});
export type ScoringOutput = z.infer<typeof ScoringOutputSchema>;

export const scoringSpec: AgentSpec<ScoringInput, ScoringOutput> = {
  name: "ScoringAgent",
  description:
    "Scores ICP fit 0-100 across four weighted components and explains the number in a paragraph.",
  toolNames: [],
  effort: "high",
  maxTokens: 6000,
  outputSchema: ScoringOutputSchema,
  systemPrompt: `
You are ScoringAgent. You score how good a prospect this is, from 0 to 100,
across four components. You do not compute the total - the orchestrator applies
the weights in config/scoring.ts and derives the tier. Your job is the four
component scores and an honest explanation.

Current weights: fit ${SCORING_WEIGHTS.fit}, painSeverity ${SCORING_WEIGHTS.painSeverity}, timingSignals ${SCORING_WEIGHTS.timingSignals}, reachability ${SCORING_WEIGHTS.reachability}.

## The components

- fit: how closely they match the stated ICP. If no ICP was given, score
  against "a business that sells a considered service and depends on inbound".
  Wrong size, wrong market or wrong buyer is a low score no matter how many
  problems they have.
- painSeverity: how badly the problems found actually hurt them. Weigh the
  impact ratings from the leakage findings. A high-impact finding on their
  main conversion path is severe; a missing meta description is not.
- timingSignals: evidence that now is the moment. A declining trajectory, a
  competitor who just started winning a theme, a site that looks recently
  rebuilt, hiring signals. Absence of a timing signal is a low score, not a
  medium one. Do not manufacture urgency.
- reachability: how easily we can get to a decision maker. A small owner-run
  business with a phone number on every page is highly reachable. A large firm
  behind a generic contact form is not.

## Calibration

Use the full range. If everything scores 70 the score means nothing. A genuinely
mediocre prospect should land in the 40s. Reserve above 85 for a company that
matches the ICP, is visibly bleeding, and is easy to reach.

## Degraded runs

If you are told some upstream agents failed, you are scoring on partial
evidence. Say so in the rationale, set confidence accordingly, and do not
compensate by guessing what the missing agent would have found.

## rationale

One paragraph. Name the specific things that drove the score up and down. A
salesperson should be able to read it and know whether to call.

${OUTPUT_CONTRACT}
`.trim(),

  buildUserMessage: ({ recce, competitorMap, visibility, leakage, icp, degraded }) => {
    const lines = [
      `Our ICP: ${icp ?? "not specified - score against a considered-purchase service business that depends on inbound."}`,
      ``,
      `Prospect: ${recce.companyName} (${recce.domain})`,
      `Positioning: ${recce.positioning}`,
      `Target market: ${recce.targetMarket}`,
      `Services: ${recce.services.map((s) => s.name).join(", ")}`,
      `Pricing disclosed: ${recce.pricingSignals.disclosed ? "yes" : "no"}`,
      `Proof elements: ${recce.proofElements.length ? recce.proofElements.join(", ") : "none found"}`,
      `Tech stack hints: ${recce.techStack.length ? recce.techStack.join(", ") : "none detected"}`,
      ``,
    ];

    if (competitorMap) {
      lines.push(
        `Competitive set: ${competitorMap.competitors.map((c) => `${c.name} (${c.overlapType})`).join(", ")}`,
        `Market notes: ${competitorMap.marketNotes}`,
        ``,
      );
    } else {
      lines.push(`Competitive set: unavailable, that agent failed.`, ``);
    }

    if (visibility) {
      const prospect = visibility.entries.find((e) => e.isProspect);
      lines.push(
        `Prospect trajectory: ${prospect ? `${prospect.rankingTrajectory.direction} (${prospect.rankingTrajectory.confidence} confidence)` : "not reported"}`,
        ``,
      );
    } else {
      lines.push(`Organic visibility: unavailable, that agent failed.`, ``);
    }

    if (leakage) {
      lines.push(
        `Conversion findings:`,
        ...leakage.conversionLeakage.map((f) => `- [${f.impact}] ${f.title}`),
        `Competitor findings:`,
        ...leakage.competitorLeakage.map((f) => `- [${f.impact}] ${f.title} (owned by ${f.ownedBy.join(", ")})`),
        ``,
      );
    } else {
      lines.push(`Leakage findings: unavailable, that agent failed.`, ``);
    }

    if (degraded) {
      lines.push(
        `NOTE: this run is degraded - at least one upstream agent failed. Score on what you have and lower your confidence accordingly.`,
        ``,
      );
    }

    lines.push(`Score this prospect.`);
    return lines.join("\n");
  },
};
