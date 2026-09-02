import { loadArtifacts } from "../../../../lib/artifacts";
import { ensureSeeded } from "../../../../lib/bootstrap";
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
  // Every read path seeds. On a serverless host each request can land on a
  // different instance with its own empty /tmp, so a page rendered by a seeded
  // instance could hand the browser a run id that the instance answering the
  // fetch had never heard of.
  await ensureSeeded();

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
