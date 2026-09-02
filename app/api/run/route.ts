import { ensureSeeded } from "../../../lib/bootstrap";
import { createRun } from "../../../lib/db/runs";
import { runPipeline } from "../../../lib/orchestrator";
import { newRunId, normalizeDomain, resolveProvider } from "../../../lib/run-context";
import type { TraceEvent } from "../../../lib/trace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Streams the run as Server-Sent Events.
 *
 * The brief is explicit that this must never block for ninety seconds behind a
 * spinner, so the response headers go out before the first agent starts and
 * every trace event is flushed as it happens. The orchestrator emits; this
 * route only serializes.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { domain?: unknown; icp?: unknown };
  try {
    body = (await request.json()) as { domain?: unknown; icp?: unknown };
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const rawDomain = typeof body.domain === "string" ? body.domain : "";
  const domain = normalizeDomain(rawDomain);
  const icp = typeof body.icp === "string" && body.icp.trim() ? body.icp.trim() : null;

  if (!domain || !domain.includes(".")) {
    return Response.json({ error: "Provide a company domain, e.g. acmedental.com" }, { status: 400 });
  }

  await ensureSeeded();

  const resolution = resolveProvider(domain);
  if (!resolution.ok) {
    return Response.json(
      { error: resolution.message, recordedDomains: resolution.recordedDomains },
      { status: 409 },
    );
  }

  const runId = newRunId();
  createRun({ id: runId, domain, icp, mode: resolution.provider.mode, model: resolution.provider.model });

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      const send = (event: string, data: unknown): void => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Tell the client its run id immediately, so the UI can show the card
      // frame before any agent has produced anything.
      send("accepted", { runId, domain, mode: resolution.provider.mode, model: resolution.provider.model });

      try {
        const result = await runPipeline({
          runId,
          domain,
          icp,
          ctx: { runId, provider: resolution.provider },
          emit: (event: TraceEvent) => send("trace", event),
        });

        send("result", {
          runId: result.runId,
          status: result.status,
          durationMs: result.durationMs,
          usage: result.usage,
          artifacts: result.artifacts,
          failures: result.failures,
        });
      } catch (error) {
        send("fatal", {
          runId,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Nginx and friends will happily buffer an SSE stream into uselessness.
      "x-accel-buffering": "no",
    },
  });
}
