import { Console } from "../components/console";
import { recordedDomains } from "../fixtures/index";
import { listRuns } from "../lib/db/runs";
import { resolveModel } from "../lib/provider/live";
import { hasApiKey } from "../lib/run-context";

export const dynamic = "force-dynamic";

/**
 * Reads the run list on the server so the console has history on first paint
 * rather than flashing empty and filling in.
 */
export default function Page() {
  return (
    <Console
      initialRuns={listRuns(25)}
      mode={hasApiKey() ? "live" : "replay"}
      model={resolveModel()}
      recorded={recordedDomains()}
    />
  );
}
