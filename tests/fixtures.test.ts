import { describe, expect, it } from "vitest";
import { RECORDED_RUNS } from "../fixtures/index";
import type { RecordedRun } from "../fixtures/types";
import { AGENT_NAMES, type AgentName } from "../lib/agents/names";
import { CompetitorMapOutputSchema } from "../lib/agents/competitor-map";
import { buildCopyOutputSchema } from "../lib/agents/copy";
import { findingTitles, LeakageOutputSchema } from "../lib/agents/leakage";
import { OrganicVisibilityOutputSchema } from "../lib/agents/organic-visibility";
import { RecceOutputSchema } from "../lib/agents/recce";
import { ScoringOutputSchema } from "../lib/agents/scoring";

/**
 * TypeScript checks a fixture's *shape* against the agent output types, but it
 * cannot check the runtime refinements - the evidence rules, the copy rules.
 * This suite parses every recorded output through the real Zod schemas, so a
 * fixture that would be rejected at demo time is rejected at test time.
 */

function finalOf(recording: RecordedRun, agent: AgentName): unknown {
  const turn = recording.agents[agent].find((candidate) => candidate.final !== undefined);
  expect(turn, `${recording.domain}/${agent} has no recorded final answer`).toBeDefined();
  return turn?.final;
}

describe.each(RECORDED_RUNS.map((recording) => [recording.domain, recording] as const))(
  "fixture %s",
  (_domain, recording) => {
    it("records a turn sequence for all six agents", () => {
      for (const agent of AGENT_NAMES) {
        expect(recording.agents[agent].length).toBeGreaterThan(0);
      }
    });

    it("satisfies every agent's real output schema, refinements included", () => {
      expect(RecceOutputSchema.safeParse(finalOf(recording, "RecceAgent")).success).toBe(true);
      expect(
        CompetitorMapOutputSchema.safeParse(finalOf(recording, "CompetitorMapAgent")).success,
      ).toBe(true);
      expect(
        OrganicVisibilityOutputSchema.safeParse(finalOf(recording, "OrganicVisibilityAgent")).success,
      ).toBe(true);
      expect(LeakageOutputSchema.safeParse(finalOf(recording, "LeakageAgent")).success).toBe(true);
      expect(ScoringOutputSchema.safeParse(finalOf(recording, "ScoringAgent")).success).toBe(true);
    });

    it("writes copy that cites findings this run actually produced", () => {
      const leakage = LeakageOutputSchema.parse(finalOf(recording, "LeakageAgent"));
      const schema = buildCopyOutputSchema(findingTitles(leakage));
      const result = schema.safeParse(finalOf(recording, "CopyAgent"));

      if (!result.success) {
        throw new Error(
          `Recorded copy violates the sequence rules:\n${result.error.issues
            .map((issue) => `  - ${issue.message}`)
            .join("\n")}`,
        );
      }
      expect(result.success).toBe(true);
    });

    it("only asks for tools that exist in the registry", async () => {
      const { getTool } = await import("../lib/tools/registry");
      for (const agent of AGENT_NAMES) {
        for (const turn of recording.agents[agent]) {
          for (const call of turn.toolCalls ?? []) {
            expect(getTool(call.name), `unknown tool ${call.name} in ${agent}`).toBeDefined();
          }
        }
      }
    });

    it("primes every page its recorded tool calls will fetch", () => {
      const primed = new Set(
        recording.pages.map((page) => page.url.replace(/\/$/, "").toLowerCase()),
      );

      for (const agent of AGENT_NAMES) {
        for (const turn of recording.agents[agent]) {
          for (const call of turn.toolCalls ?? []) {
            const args = call.input as { url?: string; domain?: string };
            const target = args.url ?? args.domain;
            if (!target) continue;
            const normalized = (target.startsWith("http") ? target : `https://${target}`)
              .replace(/\/$/, "")
              .toLowerCase();
            expect(
              primed.has(normalized),
              `${agent} fetches ${target}, which is not in the recorded pages - replay would hit the network`,
            ).toBe(true);
          }
        }
      }
    });
  },
);
