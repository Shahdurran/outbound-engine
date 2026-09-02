import { z } from "zod";
import type { AgentSpec } from "./contract";
import type { LeakageOutput } from "./leakage";
import type { RecceOutput } from "./recce";
import type { ScoringOutput } from "./scoring";
import { OUTPUT_CONTRACT, wordCount } from "./shared";

export type CopyInput = {
  recce: RecceOutput;
  leakage: LeakageOutput;
  scoring: ScoringOutput | null;
  score: number;
  tier: string;
};

const BANNED_PHRASES = [
  /i hope (this|you)/i,
  /hope (you'?re|you are) (doing )?well/i,
  /just (checking|circling|following) (in|back|up)/i,
  /reaching out to see/i,
  /touch base/i,
];

/**
 * The brief's copy rules are constraints, not suggestions, so they live in the
 * schema. A touch with an em-dash, a 60-character subject line, or a finding
 * reference that does not match anything the LeakageAgent actually reported
 * fails validation and gets bounced back to the model with the reason. That is
 * the same repair loop the metric rules use.
 */
export function buildCopyOutputSchema(validFindings: readonly string[]) {
  const known = new Set(validFindings.map((title) => title.toLowerCase().trim()));

  const TouchSchema = z
    .object({
      day: z.number().int(),
      channel: z.enum(["email", "linkedin"]),
      subject: z.string().max(45, "subject lines must be under 45 characters").optional(),
      body: z.string().min(1),
      referencedFinding: z.string().min(1),
    })
    .superRefine((touch, ctx) => {
      const dashed = /[—–]/;
      if (dashed.test(touch.body) || (touch.subject && dashed.test(touch.subject))) {
        ctx.addIssue({
          code: "custom",
          message: `Day ${touch.day}: contains an em-dash or en-dash. Use a full stop or a comma.`,
        });
      }

      for (const pattern of BANNED_PHRASES) {
        if (pattern.test(touch.body)) {
          ctx.addIssue({
            code: "custom",
            message: `Day ${touch.day}: contains filler matching ${pattern}. Open with the finding instead.`,
          });
        }
      }

      const limit = touch.channel === "linkedin" ? 90 : 120;
      const words = wordCount(touch.body);
      if (words > limit) {
        ctx.addIssue({
          code: "custom",
          message: `Day ${touch.day}: body is ${words} words, limit is ${limit}. Cut it.`,
        });
      }

      if (touch.channel === "email" && !touch.subject) {
        ctx.addIssue({
          code: "custom",
          message: `Day ${touch.day}: email touches need a subject line.`,
        });
      }

      if (!known.has(touch.referencedFinding.toLowerCase().trim())) {
        ctx.addIssue({
          code: "custom",
          message:
            `Day ${touch.day}: referencedFinding "${touch.referencedFinding}" is not one of the ` +
            `findings produced by this run. Copy one of these titles exactly: ` +
            validFindings.map((t) => `"${t}"`).join(", "),
        });
      }
    });

  return z.object({
    touches: z
      .array(TouchSchema)
      .length(4)
      .superRefine((touches, ctx) => {
        const days = touches.map((t) => t.day);
        const expected = [0, 3, 7, 12];
        if (JSON.stringify(days) !== JSON.stringify(expected)) {
          ctx.addIssue({
            code: "custom",
            message: `Touches must be days ${expected.join(", ")} in order. Got ${days.join(", ")}.`,
          });
        }
        const linkedin = touches.filter((t) => t.channel === "linkedin");
        if (linkedin.length !== 1 || linkedin[0]?.day !== 7) {
          ctx.addIssue({
            code: "custom",
            message: `Exactly one touch must be a LinkedIn DM, on day 7.`,
          });
        }
        const cited = new Set(touches.map((t) => t.referencedFinding.toLowerCase().trim()));
        if (cited.size < 2) {
          ctx.addIssue({
            code: "custom",
            message: `The sequence cites only one finding across four touches. Vary it.`,
          });
        }
      }),
    sequenceNotes: z.string().min(1),
  });
}

export type CopyOutput = z.infer<ReturnType<typeof buildCopyOutputSchema>>;
export type Touch = CopyOutput["touches"][number];

export function buildCopySpec(validFindings: readonly string[]): AgentSpec<CopyInput, CopyOutput> {
  return {
    name: "CopyAgent",
    description:
      "Writes a four-touch outreach sequence where every touch names a specific finding from " +
      "the visibility or leakage agents.",
    toolNames: [],
    effort: "high",
    maxTokens: 8000,
    outputSchema: buildCopyOutputSchema(validFindings),
    systemPrompt: `
You are CopyAgent. You write a four-touch outbound sequence: an email on day 0,
an email on day 3, a LinkedIn DM on day 7, and a breakup email on day 12.

## The rule that matters most

Every touch must reference one specific finding from this run, by its exact
title, in the referencedFinding field. And the body must actually be about that
finding. Not a generic pitch with a finding stapled on. If the finding is
"Contact form asks for 9 fields before a quote", the email is about that form.

This is the difference between outreach that gets a reply and outreach that
gets deleted. The prospect can tell within one sentence whether you looked at
their business or ran a template.

Vary the findings across the sequence. Citing the same one four times wastes
three touches.

## Rules, all enforced

- Subject lines under 45 characters. Emails need one. The DM does not.
- Emails under 120 words. The DM under 90.
- No em-dashes or en-dashes anywhere. Full stops and commas.
- No "I hope this email finds you well", no "just checking in", no "touching
  base", no "reaching out to see". Open with the finding.
- Plain and direct. Short sentences. Write like a person who has done the work
  and has something specific to say, not like a marketer.

## The four touches

- Day 0: lead with the single most specific thing you found. One clear ask.
- Day 3: a different finding, a different angle. Do not repeat day 0.
- Day 7 (LinkedIn): shortest of the four. Conversational. One line of substance
  and one question.
- Day 12 (breakup): acknowledge the silence without guilt-tripping. Leave the
  door open and make it easy to say no. Still cites a finding.

## sequenceNotes

Two or three sentences on the strategy: which findings you led with and why,
and what a reply to each touch would tell you.

${OUTPUT_CONTRACT}
`.trim(),

    buildUserMessage: ({ recce, leakage, scoring, score, tier }) =>
      [
        `Prospect: ${recce.companyName} (${recce.domain})`,
        `Positioning: ${recce.positioning}`,
        `Target market: ${recce.targetMarket}`,
        `ICP fit score: ${score}/100, tier ${tier}`,
        scoring ? `Why: ${scoring.rationale}` : ``,
        ``,
        `Findings you may cite. Use these titles exactly:`,
        ``,
        `Conversion leakage:`,
        ...leakage.conversionLeakage.map(
          (f) => `- "${f.title}" [${f.impact}] - ${f.detail} Fix: ${f.fix}`,
        ),
        ``,
        `Competitor leakage:`,
        ...leakage.competitorLeakage.map(
          (f) =>
            `- "${f.title}" [${f.impact}] - ${f.detail} Owned by: ${f.ownedBy.join(", ")}. Fix: ${f.fix}`,
        ),
        ``,
        `Write the four-touch sequence.`,
      ]
        .filter((line) => line !== ``)
        .join("\n"),
  };
}
