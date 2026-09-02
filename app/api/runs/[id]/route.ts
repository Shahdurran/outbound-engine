import { loadArtifacts } from "../../../../lib/artifacts";
import { getCrmWrites, getRun, getSteps, getTrace } from "../../../../lib/db/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A completed run reopens from here. The persisted trace events replay into
 * the same console component the live stream feeds, so a run from last week
 * looks exactly like one finishing now.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const run = getRun(id);

  if (!run) {
    return Response.json({ error: `No run ${id}` }, { status: 404 });
  }

  return Response.json({
    run,
    steps: getSteps(id),
    trace: getTrace(id),
    artifacts: loadArtifacts(id),
    crm: getCrmWrites(id),
  });
}
