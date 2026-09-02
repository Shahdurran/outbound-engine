import { Console } from "../components/console";
import { recordedDomains } from "../fixtures/index";
import { ensureSeeded } from "../lib/bootstrap";
import { listRuns } from "../lib/db/runs";
import { resolveModel } from "../lib/provider/live";
import { hasApiKey } from "../lib/run-context";

export const dynamic = "force-dynamic";

/**
 * Seeds on first request, then reads the run list on the server so the console
 * has history on first paint rather than flashing empty and filling in.
 */
export default async function Page() {
  await ensureSeeded();

  return (
    <Console
      initialRuns={listRuns(25)}
      mode={hasApiKey() ? "live" : "replay"}
      model={resolveModel()}
      recorded={recordedDomains()}
    />
  );
}
