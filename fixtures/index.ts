import type { RecordedRun } from "./types";
import { acmeDental } from "./acmedental";

/**
 * Recorded runs available to replay mode. The UI offers these as one-click
 * demo targets when no API key is configured.
 *
 * Adding another is a single file: capture the pages and the six agents' turns
 * in the shape of ./types.ts, then list it here. See the README section
 * "Recording a new fixture".
 */
export const RECORDED_RUNS: RecordedRun[] = [acmeDental];

export function findRecording(domain: string): RecordedRun | undefined {
  const needle = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return RECORDED_RUNS.find((run) => run.domain === needle);
}

export function recordedDomains(): { domain: string; label: string; icp: string }[] {
  return RECORDED_RUNS.map((run) => ({ domain: run.domain, label: run.label, icp: run.icp }));
}
