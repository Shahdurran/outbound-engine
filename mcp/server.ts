#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { runTool, TOOL_REGISTRY } from "../lib/tools/registry";

/**
 * The adapter layer, exposed over MCP.
 *
 * This is the same TOOL_REGISTRY the in-process sub-agents use - same Zod
 * shapes, same handlers, same SQLite. Nothing is reimplemented for MCP; the
 * registry is simply adapted a second way. That is what makes the README's
 * "swap the adapter layer for MCP servers" claim something you can check by
 * running `npm run mcp` and pointing a client at it.
 *
 * Run standalone:      npm run mcp
 * From Claude Code:    claude mcp add outbound-engine -- npx tsx mcp/server.ts
 */

const server = new McpServer({
  name: "outbound-engine",
  version: "0.8.0",
});

for (const tool of TOOL_REGISTRY) {
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: tool.shape,
    },
    async (args: unknown) => {
      const result = await runTool(tool.name, args);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result.content, null, 2),
          },
        ],
        isError: result.isError ?? false,
      };
    },
  );
}

async function main(): Promise<void> {
  // stdout is the MCP transport. Anything that prints there corrupts the
  // protocol, so every diagnostic in this process goes to stderr.
  process.stderr.write(
    `outbound-engine MCP server ready with ${TOOL_REGISTRY.length} tools: ` +
      `${TOOL_REGISTRY.map((tool) => tool.name).join(", ")}\n`,
  );
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  process.stderr.write(`MCP server failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
