#!/usr/bin/env node
import { query, type AgentDefinition, type Options } from "@anthropic-ai/claude-agent-sdk";
import { competitorMapSpec } from "../lib/agents/competitor-map";
import { buildCopySpec } from "../lib/agents/copy";
import { leakageSpec } from "../lib/agents/leakage";
import { organicVisibilitySpec } from "../lib/agents/organic-visibility";
import { recceSpec } from "../lib/agents/recce";
import { scoringSpec } from "../lib/agents/scoring";
import { normalizeDomain } from "../lib/run-context";
import { resolveModel } from "../lib/provider/live";

/**
 * The same six sub-agents, running on the Claude Agent SDK instead of raw
 * Messages calls, with the adapter layer replaced by the MCP server.
 *
 * This is the point the README's "Path to Claude Code / Agent SDK" section
 * makes, shipped rather than described. Compare it with agent-sdk/run.ts:
 *
 *                          run.ts                     sdk-run.ts
 *   orchestration          lib/orchestrator.ts        Agent SDK harness
 *   sub-agents             AgentSpec + runtime.ts     AgentDefinition
 *   tools                  in-process registry        mcp/server.ts over stdio
 *   system prompts         ---------------- identical ----------------
 *   output contracts       ---------------- identical ----------------
 *
 * The prompts and contracts are literally the same objects, imported from the
 * same files. Only the harness and the transport change.
 *
 *   npm run agent:sdk -- acmedental.com
 *
 * Needs credentials: this path always calls the API, so there is no replay.
 */

const SERVER = "outbound-engine";

/** MCP tools arrive namespaced as mcp__<server>__<tool>. */
function mcpTool(name: string): string {
  return `mcp__${SERVER}__${name}`;
}

function toAgentDefinition(spec: {
  description: string;
  systemPrompt: string;
  toolNames: readonly string[];
}): AgentDefinition {
  return {
    description: spec.description,
    prompt: spec.systemPrompt,
    // Each sub-agent gets exactly the tools its AgentSpec declared, no more.
    // The isolation the in-process version gets from a fresh message array,
    // this version gets from the harness plus a narrowed tool list.
    tools: [...spec.toolNames.map(mcpTool), "WebSearch"],
    model: "inherit",
  };
}

async function main(): Promise<void> {
  const [rawDomain, rawIcp] = process.argv.slice(2);

  if (!rawDomain) {
    console.error("Usage: npm run agent:sdk -- <domain> [icp description]");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY?.trim() && !process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) {
    console.error(
      "The Agent SDK path always calls the API. Set ANTHROPIC_API_KEY, or run\n" +
        "`npm run agent -- <domain>` for the replayable in-process pipeline.",
    );
    process.exit(1);
  }

  const domain = normalizeDomain(rawDomain);
  const icp = rawIcp?.trim() ?? "not specified";

  // CopyAgent's schema is normally built per-run from the finding titles the
  // LeakageAgent produced. Here the harness owns the handoff, so the copy
  // sub-agent is given the rule in prose and the orchestrator prompt tells it
  // to quote real titles.
  const copySpec = buildCopySpec([]);

  const agents: Record<string, AgentDefinition> = {
    recce: toAgentDefinition(recceSpec),
    "competitor-map": toAgentDefinition(competitorMapSpec),
    "organic-visibility": toAgentDefinition(organicVisibilitySpec),
    leakage: toAgentDefinition(leakageSpec),
    scoring: toAgentDefinition(scoringSpec),
    copy: toAgentDefinition(copySpec),
  };

  const options: Options = {
    model: resolveModel(),
    agents,
    mcpServers: {
      [SERVER]: {
        type: "stdio",
        command: "npx",
        args: ["tsx", "mcp/server.ts"],
      },
    },
    allowedTools: [
      mcpTool("fetch_page"),
      mcpTool("list_site_pages"),
      mcpTool("score_prospect"),
      mcpTool("crm_upsert_company"),
      mcpTool("crm_create_deal"),
      mcpTool("crm_log_activity"),
      mcpTool("propose_meeting_slots"),
      "WebSearch",
      "Task",
    ],
    permissionMode: "acceptEdits",
    maxTurns: 60,
  };

  const prompt = `
Run the Outbound Engine pipeline for ${domain}. Our ICP: ${icp}.

Delegate to the sub-agents in this order, passing each one only the previous
agent's structured output. Do not summarise or paraphrase between steps; hand
over the JSON object itself.

  1. recce                 - read their site
  2. competitor-map        - who they compete with
  3. organic-visibility    - footprint, prospect vs competitors
  4. leakage               - conversion and competitor leakage
  5. scoring               - ICP fit, then call score_prospect for the weighting
  6. copy                  - the four-touch sequence

Rules that carry across every step:
  - Every number is derived from fetched evidence or labelled as an estimate
    with a confidence level. No invented metrics.
  - Each copy touch must quote one leakage finding title exactly as the
    leakage agent wrote it.

When the sequence is written, call crm_upsert_company, crm_create_deal and
crm_log_activity to record the prospect, then propose_meeting_slots for the
review call. Finish with a short report: score, tier, the findings, and the
four subject lines.
`.trim();

  console.log(`Running ${domain} through the Agent SDK harness with the ${SERVER} MCP server.\n`);

  for await (const message of query({ prompt, options })) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "text" && block.text.trim()) {
          console.log(block.text);
        } else if (block.type === "tool_use") {
          console.log(`  -> ${block.name}`);
        }
      }
    } else if (message.type === "result") {
      console.log("");
      console.log(
        `${message.subtype} in ${message.duration_ms}ms, cost $${message.total_cost_usd?.toFixed(4) ?? "n/a"}`,
      );
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
