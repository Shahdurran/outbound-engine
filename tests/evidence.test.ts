import { describe, expect, it } from "vitest";
import { MetricSchema } from "../lib/evidence";

/**
 * The no-fabricated-metrics rule is the load-bearing claim of this project, so
 * it gets tested rather than asserted in a README.
 */

const evidence = [{ source: "https://example.com", excerpt: "9 required fields on the form." }];

describe("MetricSchema", () => {
  it("accepts an exact number that is derived from evidence", () => {
    const result = MetricSchema.safeParse({
      label: "Form fields",
      kind: "exact",
      value: 9,
      basis: "derived",
      confidence: "high",
      evidence,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an exact number labelled as an estimate", () => {
    const result = MetricSchema.safeParse({
      label: "Monthly organic sessions",
      kind: "exact",
      value: 12400,
      basis: "estimated",
      confidence: "medium",
      evidence,
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message).join(" ")).toContain(
      "An exact number must be",
    );
  });

  it("accepts the same claim expressed honestly as a range", () => {
    const result = MetricSchema.safeParse({
      label: "Monthly organic sessions",
      kind: "range",
      low: 5000,
      high: 20000,
      unit: "sessions",
      basis: "estimated",
      confidence: "low",
      evidence,
    });
    expect(result.success).toBe(true);
  });

  it("rejects any metric with no evidence at all", () => {
    const result = MetricSchema.safeParse({
      label: "Indexed pages",
      kind: "range",
      low: 10,
      high: 50,
      unit: "pages",
      basis: "estimated",
      confidence: "low",
      evidence: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inverted range", () => {
    const result = MetricSchema.safeParse({
      label: "Indexed pages",
      kind: "range",
      low: 500,
      high: 50,
      unit: "pages",
      basis: "estimated",
      confidence: "low",
      evidence,
    });
    expect(result.success).toBe(false);
  });
});
