import { z } from "zod";
import { EvidenceSchema } from "../evidence";
import type { AgentSpec } from "./contract";
import type { RecceOutput } from "./recce";
import { OUTPUT_CONTRACT, WEB_SEARCH_TOOL } from "./shared";

export type CompetitorMapInput = {
  recce: RecceOutput;
};

export const CompetitorSchema = z.object({
  domain: z.string().min(1),
  name: z.string().min(1),
  positioningOneLiner: z.string().min(1).max(200),
  whyTheyCompete: z.string().min(1),
  overlapType: z.enum(["direct", "adjacent", "substitute"]),
  evidence: z.array(EvidenceSchema).min(1),
});
export type Competitor = z.infer<typeof CompetitorSchema>;

export const CompetitorMapOutputSchema = z.object({
  competitors: z.array(CompetitorSchema).min(3).max(4),
  marketNotes: z.string().min(1),
});
export type CompetitorMapOutput = z.infer<typeof CompetitorMapOutputSchema>;

export const competitorMapSpec: AgentSpec<CompetitorMapInput, CompetitorMapOutput> = {
  name: "CompetitorMapAgent",
  description:
    "Identifies the three or four closest competitors from search plus the prospect's own copy.",
  toolNames: ["fetch_page"],
  serverTools: [WEB_SEARCH_TOOL],
  effort: "medium",
  maxTokens: 8000,
  outputSchema: CompetitorMapOutputSchema,
  systemPrompt: `
You are CompetitorMapAgent. You are given a structured profile of a prospect,
produced by an agent that read their website. You did not see that website and
you cannot ask it questions. Work from the profile and from search.

## What counts as a competitor

Someone the prospect's buyer would realistically consider instead. Judge on
overlap of service, market and geography together:

- direct: same service, same market, same geography.
- adjacent: overlapping service, would show up in the same shortlist.
- substitute: solves the same job a different way, including "do it in-house".

A national brand is not a competitor to a local business just because it is
large. A local business is not a competitor to a national brand just because it
is nearby. If the prospect is geographically bound, say so and stay local.

## Method

Use web_search to find who ranks for the prospect's core service and market.
You may fetch_page a candidate to confirm what they actually do; do not list a
competitor whose positioning you could not verify from search results or a
fetch. Return three or four, ordered by how much they threaten the prospect.

Every competitor needs evidence: the search you ran or the page you fetched,
with the excerpt that establishes what they do.

## marketNotes

One paragraph on the shape of the market: fragmented or consolidated, who owns
the premium end, whether anyone is clearly winning. This is context for the
agents downstream, so keep it factual.

${OUTPUT_CONTRACT}
`.trim(),

  buildUserMessage: ({ recce }) =>
    [
      `Prospect: ${recce.companyName} (${recce.domain})`,
      `Positioning: ${recce.positioning}`,
      `Target market: ${recce.targetMarket}`,
      `Services: ${recce.services.map((s) => s.name).join(", ")}`,
      ``,
      `Find the three or four closest competitors.`,
    ].join("\n"),
};
