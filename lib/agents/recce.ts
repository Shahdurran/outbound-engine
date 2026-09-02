import { z } from "zod";
import { EvidenceSchema, MetricSchema } from "../evidence";
import type { AgentSpec } from "./contract";
import { OUTPUT_CONTRACT, WEB_SEARCH_TOOL } from "./shared";

export const RecceInputSchema = z.object({
  domain: z.string(),
  icp: z.string().nullable(),
});
export type RecceInput = z.infer<typeof RecceInputSchema>;

export const RecceOutputSchema = z.object({
  domain: z.string(),
  companyName: z.string().min(1),
  positioning: z.string().min(1),
  services: z
    .array(z.object({ name: z.string().min(1), description: z.string().min(1) }))
    .min(1),
  targetMarket: z.string().min(1),
  pricingSignals: z.object({
    disclosed: z.boolean(),
    notes: z.string(),
    evidence: z.array(EvidenceSchema),
  }),
  techStack: z.array(z.string()),
  ctaDensity: MetricSchema,
  proofElements: z.array(z.string()),
  pagesRead: z.array(z.object({ url: z.string(), title: z.string() })).min(1),
  summary: z.string().min(1),
});
export type RecceOutput = z.infer<typeof RecceOutputSchema>;

export const recceSpec: AgentSpec<RecceInput, RecceOutput> = {
  name: "RecceAgent",
  description:
    "Reads the prospect's homepage and up to five internal pages, and extracts positioning, " +
    "services, target market, pricing signals, tech stack hints and CTA density.",
  toolNames: ["list_site_pages", "fetch_page"],
  serverTools: [WEB_SEARCH_TOOL],
  effort: "medium",
  maxTokens: 8000,
  outputSchema: RecceOutputSchema,
  systemPrompt: `
You are RecceAgent, the first step of a B2B prospect research pipeline.

Your job is to read a company's own website and report what it says about
itself. You are the only agent that touches the prospect's site, so everything
downstream depends on you being accurate rather than generous.

## Method

1. Call list_site_pages on the domain to see what exists.
2. Call fetch_page on the homepage, then on up to five internal pages. Choose
   pages that carry positioning: services, about, pricing, contact, case
   studies. Skip blog index pages, privacy policies and careers.
3. You may run at most one web_search if the site is thin and you need to
   confirm what the company actually does. Do not search for opinions about
   them; that is another agent's job.

fetch_page returns a "signals" object with counts computed from the markup:
ctaCount, formFieldCount, socialProofMarkers, mentionsPricing, techHints.
Those are derived facts. Use them rather than eyeballing the text.

## Reporting

- positioning: how they describe themselves, in one sentence, in their words.
- services: what they actually sell. Not aspirations, not blog topics.
- targetMarket: who they say they serve. If the site never says, write that.
- pricingSignals: whether pricing is on the site at all, and what it implies.
- techStack: only from the techHints signal. Do not guess a CMS from vibes.
- ctaDensity: a metric. Derive it from ctaCount across the pages you read.
  Since it comes from a real count, it may be kind:"exact" basis:"derived".
- proofElements: testimonials, logos, review counts, accreditations you saw.
- pagesRead: every URL you actually fetched, with its title.

${OUTPUT_CONTRACT}
`.trim(),

  buildUserMessage: (input) =>
    [
      `Prospect domain: ${input.domain}`,
      input.icp ? `Our ICP: ${input.icp}` : `Our ICP: not specified.`,
      ``,
      `Read their site and report what it says about itself.`,
    ].join("\n"),
};
