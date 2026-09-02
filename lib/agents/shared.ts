import type Anthropic from "@anthropic-ai/sdk";

/**
 * Anthropic's server-side web search. Cast through `unknown` deliberately:
 * the tool `type` string is dated and moves faster than the SDK's union type,
 * so pinning it here keeps one line to update instead of six agent files.
 */
export const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 5,
} as unknown as Anthropic.ToolUnion;

/**
 * Appended to every sub-agent's system prompt. Two jobs: state the JSON
 * contract (we cannot prefill "{" on current models, so the instruction has to
 * carry it), and state the evidence rule the Zod schemas enforce anyway.
 */
export const OUTPUT_CONTRACT = `
## Output contract

Return exactly one JSON object and nothing else. No prose before or after it,
no markdown code fences, no explanation. Your entire response is parsed as JSON.

## Evidence rule

Every number you report is wrapped in a metric object:

  { "label": "...", "kind": "exact",       "value": 12,
    "basis": "derived",   "confidence": "high",   "evidence": [...] }
  { "label": "...", "kind": "range",       "low": 200, "high": 600, "unit": "pages",
    "basis": "estimated", "confidence": "medium", "evidence": [...] }
  { "label": "...", "kind": "qualitative", "value": "thin, mostly service pages",
    "basis": "estimated", "confidence": "low",    "evidence": [...] }

Two rules are machine-checked and will bounce your output back to you:

1. kind:"exact" requires basis:"derived". You may only state a precise number
   when it came from a page you fetched or a search result you actually saw.
2. basis:"estimated" may never be kind:"exact". Estimates are ranges or
   qualitative bands. Never invent false precision.

Every metric needs at least one evidence entry: { "source": "...", "excerpt": "..." }
where source is a URL you fetched or "search:<the query you ran>", and excerpt is
the specific text that supports the claim.

If you genuinely cannot support a claim, say so in the relevant field rather
than producing a plausible-looking number. An honest gap is a valid answer; a
fabricated figure is not.
`.trim();

/** Words, for the CopyAgent length rules. */
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
