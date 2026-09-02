import type Anthropic from "@anthropic-ai/sdk";
import { z, type ZodRawShape } from "zod";
import { fetchPage, normalizeUrl } from "./fetch-page";
import { getCrm } from "../integrations/crm";
import { getCalendar } from "../integrations/calendar";
import { SCORING_WEIGHTS, tierFor, weightedTotal, type ScoringComponent } from "../../config/scoring";

/**
 * One definition per tool, three consumers:
 *
 *   - the in-process sub-agents, via toAnthropicTools()
 *   - the stdio MCP server in mcp/server.ts
 *   - the headless Agent SDK runner, which reaches them through that MCP server
 *
 * Defining a tool once and adapting it outward is the whole reason the
 * "swap the adapter layer for MCP servers" claim in the README is checkable
 * rather than aspirational.
 */

export type ToolResult = {
  /** What goes back to the model. */
  content: unknown;
  /** One line for the trace console. */
  summary: string;
  /** Whether this was served from the SQLite page cache. */
  cached?: boolean;
  isError?: boolean;
};

export type ToolSpec<Shape extends ZodRawShape = ZodRawShape> = {
  name: string;
  description: string;
  shape: Shape;
  handler: (args: z.infer<z.ZodObject<Shape>>) => Promise<ToolResult>;
};

function defineTool<Shape extends ZodRawShape>(spec: ToolSpec<Shape>): ToolSpec<Shape> {
  return spec;
}

// ---------------------------------------------------------------------------
// Research tools
// ---------------------------------------------------------------------------

const fetchPageTool = defineTool({
  name: "fetch_page",
  description:
    "Fetch a web page and return its readable text plus deterministic structural signals " +
    "(CTA count, form fields, social proof markers, pricing mentions, tech fingerprints). " +
    "Results are cached, so fetching the same URL twice is free. Use this for anything you " +
    "want to quote as evidence - only text you actually fetched counts as derived.",
  shape: {
    url: z.string().describe("Absolute URL, or a bare domain like acmedental.com"),
  },
  handler: async ({ url }) => {
    const page = await fetchPage(url);
    if (page.error) {
      return {
        content: { url: page.url, error: page.error },
        summary: `${page.url} failed: ${page.error}`,
        isError: true,
      };
    }
    return {
      content: {
        url: page.url,
        status: page.status,
        title: page.title,
        description: page.description,
        signals: page.signals,
        internalLinks: page.internalLinks.slice(0, 25),
        text: page.text,
      },
      summary: `${page.url} ${page.status} ${page.signals.wordCount}w ${page.signals.ctaCount} CTAs`,
      cached: page.cached,
    };
  },
});

const listSitePagesTool = defineTool({
  name: "list_site_pages",
  description:
    "Fetch a homepage and return the internal links found on it, so you can choose which " +
    "sub-pages are worth reading. Cheaper than guessing URLs and 404ing.",
  shape: {
    domain: z.string().describe("Bare domain or homepage URL"),
    limit: z.number().int().min(1).max(25).optional().describe("Max links to return, default 15"),
  },
  handler: async ({ domain, limit }) => {
    const page = await fetchPage(domain);
    if (page.error) {
      return {
        content: { domain, error: page.error },
        summary: `${domain} unreachable: ${page.error}`,
        isError: true,
      };
    }
    const links = page.internalLinks.slice(0, limit ?? 15);
    return {
      content: { homepage: page.url, title: page.title, links },
      summary: `${links.length} internal links on ${page.url}`,
      cached: page.cached,
    };
  },
});

const scoreProspectTool = defineTool({
  name: "score_prospect",
  description:
    "Apply the tunable scoring weights in config/scoring.ts to four component scores (0-100 " +
    "each) and return the weighted total plus tier. The arithmetic is done in code, not by " +
    "the model, so the breakdown always reconciles with the headline number.",
  shape: {
    fit: z.number().min(0).max(100),
    painSeverity: z.number().min(0).max(100),
    timingSignals: z.number().min(0).max(100),
    reachability: z.number().min(0).max(100),
  },
  handler: async (components) => {
    const total = weightedTotal(components as Record<ScoringComponent, number>);
    const tier = tierFor(total);
    return {
      content: { total, tier, weights: SCORING_WEIGHTS, components },
      summary: `score ${total} tier ${tier}`,
    };
  },
});

// ---------------------------------------------------------------------------
// CRM + calendar tools. The sub-agents do not call these; the orchestrator and
// the MCP server do. Exposing them over MCP is what lets an external Claude
// Code session drive the same CRM surface the app writes to.
// ---------------------------------------------------------------------------

const crmUpsertCompanyTool = defineTool({
  name: "crm_upsert_company",
  description:
    "Create or update a company record. Properties use HubSpot's naming exactly, so the " +
    "MockCRM payload is the payload a real HubSpot adapter would send.",
  shape: {
    domain: z.string(),
    name: z.string(),
    industry: z.string().optional(),
    description: z.string().optional(),
    runId: z.string().optional(),
  },
  handler: async (args) => {
    const record = await getCrm().upsertCompany({
      domain: args.domain,
      name: args.name,
      industry: args.industry,
      description: args.description,
      runId: args.runId ?? null,
    });
    return {
      content: record,
      summary: `company ${record.id} (${record.properties.domain})`,
    };
  },
});

const crmCreateDealTool = defineTool({
  name: "crm_create_deal",
  description: "Create a deal against a company, using HubSpot deal property names.",
  shape: {
    companyId: z.string(),
    dealName: z.string(),
    amount: z.number().optional(),
    dealStage: z.string().optional(),
    runId: z.string().optional(),
  },
  handler: async (args) => {
    const record = await getCrm().createDeal({
      companyId: args.companyId,
      dealName: args.dealName,
      amount: args.amount,
      dealStage: args.dealStage,
      runId: args.runId ?? null,
    });
    return { content: record, summary: `deal ${record.id} ${record.properties.dealname}` };
  },
});

const crmLogActivityTool = defineTool({
  name: "crm_log_activity",
  description: "Log a timeline activity (email sent, note, call) against a CRM object.",
  shape: {
    objectType: z.enum(["company", "contact", "deal"]),
    objectId: z.string(),
    activityType: z.string(),
    body: z.string(),
    runId: z.string().optional(),
  },
  handler: async (args) => {
    const record = await getCrm().logActivity({
      objectType: args.objectType,
      objectId: args.objectId,
      activityType: args.activityType,
      body: args.body,
      runId: args.runId ?? null,
    });
    return { content: record, summary: `activity ${record.id} ${args.activityType}` };
  },
});

const proposeMeetingSlotsTool = defineTool({
  name: "propose_meeting_slots",
  description:
    "Propose three meeting slots and return a booking link for a call to review the analysis.",
  shape: {
    domain: z.string(),
    runId: z.string().optional(),
  },
  handler: async (args) => {
    const booking = await getCalendar().proposeSlots({
      domain: args.domain,
      runId: args.runId ?? null,
    });
    return { content: booking, summary: `3 slots, ${booking.bookingUrl}` };
  },
});

export const TOOL_REGISTRY = [
  fetchPageTool,
  listSitePagesTool,
  scoreProspectTool,
  crmUpsertCompanyTool,
  crmCreateDealTool,
  crmLogActivityTool,
  proposeMeetingSlotsTool,
] as const;

export type ToolName = (typeof TOOL_REGISTRY)[number]["name"];

const BY_NAME = new Map<string, ToolSpec>(
  TOOL_REGISTRY.map((tool) => [tool.name, tool as unknown as ToolSpec]),
);

export function getTool(name: string): ToolSpec | undefined {
  return BY_NAME.get(name);
}

/** JSON Schema for a tool, from the same Zod shape that validates its args. */
export function jsonSchemaFor(tool: ToolSpec): Anthropic.Tool.InputSchema {
  const schema = z.toJSONSchema(z.object(tool.shape), { target: "draft-7", io: "input" });
  // The API rejects an unexpected $schema key on the tool input schema.
  const { $schema: _discard, ...rest } = schema as Record<string, unknown>;
  return rest as Anthropic.Tool.InputSchema;
}

/** Adapter 1: Anthropic Messages API tool definitions. */
export function toAnthropicTools(names: readonly string[]): Anthropic.Tool[] {
  return names.map((name) => {
    const tool = BY_NAME.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    return {
      name: tool.name,
      description: tool.description,
      input_schema: jsonSchemaFor(tool),
    };
  });
}

/** Execute a tool by name with unvalidated args from the model. */
export async function runTool(name: string, rawArgs: unknown): Promise<ToolResult> {
  const tool = BY_NAME.get(name);
  if (!tool) {
    return { content: { error: `Unknown tool ${name}` }, summary: `unknown tool ${name}`, isError: true };
  }
  const parsed = z.object(tool.shape).safeParse(rawArgs);
  if (!parsed.success) {
    return {
      content: { error: "Invalid arguments", issues: parsed.error.issues },
      summary: `${name} bad args`,
      isError: true,
    };
  }
  try {
    return await tool.handler(parsed.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { content: { error: message }, summary: `${name} threw: ${message}`, isError: true };
  }
}

export { normalizeUrl };
