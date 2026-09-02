import { describe, expect, it } from "vitest";
import { buildCopyOutputSchema } from "../lib/agents/copy";

/**
 * The brief's copy constraints live in the schema, so breaking one has to be a
 * test failure rather than something a reviewer notices in the output.
 */

const FINDINGS = ["Contact form asks for nine fields", "Invisalign cost owned by a competitor"];
const schema = buildCopyOutputSchema(FINDINGS);

function touch(overrides: Record<string, unknown> = {}) {
  return {
    day: 0,
    channel: "email",
    subject: "Your form asks for nine things",
    body: "Your appointment form asks for nine required fields before anyone calls back. Cut it to three and you keep the people who currently give up.",
    referencedFinding: FINDINGS[0],
    ...overrides,
  };
}

function sequence(first: Record<string, unknown> = {}) {
  return {
    touches: [
      touch(first),
      touch({ day: 3, subject: "A competitor owns the cost query", referencedFinding: FINDINGS[1] }),
      touch({ day: 7, channel: "linkedin", subject: undefined, referencedFinding: FINDINGS[0] }),
      touch({ day: 12, subject: "Closing the loop", referencedFinding: FINDINGS[1] }),
    ],
    sequenceNotes: "Leads with the form, escalates to the competitive threat.",
  };
}

describe("copy sequence schema", () => {
  it("accepts a compliant four-touch sequence", () => {
    expect(schema.safeParse(sequence()).success).toBe(true);
  });

  it("rejects a subject line over 45 characters", () => {
    const result = schema.safeParse(
      sequence({ subject: "This subject line is considerably too long to pass" }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects em-dashes", () => {
    const result = schema.safeParse(
      sequence({ body: "Your form asks for nine fields — that is eight too many." }),
    );
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("em-dash");
  });

  it("rejects the banned opener", () => {
    const result = schema.safeParse(
      sequence({ body: "I hope this email finds you well. Your form asks for nine fields." }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a body over 120 words", () => {
    const result = schema.safeParse(sequence({ body: `${"word ".repeat(130)}form` }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("limit is 120");
  });

  it("rejects a finding reference that no agent produced", () => {
    const result = schema.safeParse(sequence({ referencedFinding: "Something nobody found" }));
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("is not one of the findings");
  });

  it("rejects a sequence that cites the same finding four times", () => {
    const single = {
      touches: [
        touch(),
        touch({ day: 3 }),
        touch({ day: 7, channel: "linkedin", subject: undefined }),
        touch({ day: 12 }),
      ],
      sequenceNotes: "All one note.",
    };
    const result = schema.safeParse(single);
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("cites only one finding");
  });
});
