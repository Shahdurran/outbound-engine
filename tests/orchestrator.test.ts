import { describe, expect, it } from "vitest";
import { acmeDental } from "../fixtures/acmedental";
import type { AgentName } from "../lib/agents/names";
import { runPipeline } from "../lib/orchestrator";
import { collectEvents, FinalsOnlyProvider } from "./helpers";

/**
 * Error isolation is the property that separates a pipeline from a chain of
 * function calls, so it gets its own test at the graph level.
 */

async function run(failOn: AgentName[]) {
  const provider = new FinalsOnlyProvider(acmeDental, failOn);
  const { emit, events } = collectEvents();

  const result = await runPipeline({
    runId: "test_run",
    domain: acmeDental.domain,
    icp: acmeDental.icp,
    ctx: { runId: "test_run", provider },
    emit,
    persist: false,
  });

  return { result, events };
}

describe("orchestrator", () => {
  it("completes a clean run and scores it from the component weights", async () => {
    const { result } = await run([]);

    expect(result.status).toBe("complete");
    expect(result.failures).toEqual([]);
    expect(result.artifacts.recce).not.toBeNull();
    expect(result.artifacts.copy?.touches).toHaveLength(4);

    // 82*.35 + 78*.3 + 55*.2 + 88*.15 = 76.3 -> 76
    expect(result.artifacts.score).toBe(76);
    expect(result.artifacts.tier).toBe("A");
  });

  it("degrades rather than dying when a middle agent fails", async () => {
    const { result } = await run(["OrganicVisibilityAgent"]);

    expect(result.status).toBe("degraded");
    expect(result.failures.map((failure) => failure.agent)).toEqual(["OrganicVisibilityAgent"]);

    // Everything downstream that could still run, did.
    expect(result.artifacts.leakage).not.toBeNull();
    expect(result.artifacts.scoring).not.toBeNull();
    expect(result.artifacts.copy).not.toBeNull();
    expect(result.artifacts.visibility).toBeNull();
  });

  it("caps a degraded run below tier A rather than scoring it as if complete", async () => {
    const { result } = await run(["OrganicVisibilityAgent"]);

    expect(result.artifacts.score).toBe(74);
    expect(result.artifacts.tier).toBe("B");
  });

  it("skips dependent agents with an explicit reason instead of feeding them nulls", async () => {
    const { result, events } = await run(["CompetitorMapAgent"]);

    expect(result.status).toBe("degraded");

    const skipped = result.failures.filter((failure) => failure.message.startsWith("skipped:"));
    expect(skipped.map((failure) => failure.agent).sort()).toEqual([
      "CopyAgent",
      "LeakageAgent",
      "OrganicVisibilityAgent",
    ]);

    // Scoring only depends on the recce, so it still runs on a thin run.
    expect(result.artifacts.scoring).not.toBeNull();
    expect(events.some((event) => event.type === "run_done")).toBe(true);
  });

  it("fails the whole run when the recce produces nothing to hand on", async () => {
    const { result } = await run(["RecceAgent"]);

    expect(result.status).toBe("failed");
    expect(result.artifacts.recce).toBeNull();
    expect(result.failures).toHaveLength(6);
  });
});
