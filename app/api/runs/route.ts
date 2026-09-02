import { listRuns } from "../../../lib/db/runs";
import { hasApiKey } from "../../../lib/run-context";
import { recordedDomains } from "../../../fixtures/index";
import { resolveModel } from "../../../lib/provider/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json({
    runs: listRuns(25),
    mode: hasApiKey() ? "live" : "replay",
    model: resolveModel(),
    recordedDomains: recordedDomains(),
  });
}
