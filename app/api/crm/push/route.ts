import { ensureSeeded } from "../../../../lib/bootstrap";
import { pushRunToCrm, type TouchInput } from "../../../../lib/crm-push";
import { getRun } from "../../../../lib/db/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Touches arrive from the client because the Outreach tab lets you edit the
 * copy before pushing - the agent drafts, a human approves, which is the only
 * sane shape for outbound that actually sends.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { runId?: unknown; touches?: unknown };
  try {
    body = (await request.json()) as { runId?: unknown; touches?: unknown };
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  await ensureSeeded();

  const runId = typeof body.runId === "string" ? body.runId : "";
  if (!getRun(runId)) {
    return Response.json({ error: `No run ${runId}` }, { status: 404 });
  }

  const overrides = Array.isArray(body.touches) ? (body.touches as TouchInput[]) : undefined;

  try {
    return Response.json(await pushRunToCrm(runId, overrides));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    );
  }
}
