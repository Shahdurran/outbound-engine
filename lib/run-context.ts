import { randomUUID } from "node:crypto";
import { findRecording, recordedDomains } from "../fixtures/index";
import { LiveProvider, resolveModel } from "./provider/live";
import { ReplayProvider } from "./provider/replay";
import type { Provider } from "./provider/types";
import { primePageCache } from "./tools/fetch-page";

/**
 * Chooses live or replay, and explains itself when it cannot run.
 *
 * The rule is simple: an API key means live, no key means replay. Replay only
 * works for domains we have a recording of, and when it does not, the answer
 * is an honest error telling the operator their two options - not a silently
 * invented run.
 */

export function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export type ProviderResolution =
  | { ok: true; provider: Provider }
  | { ok: false; message: string; recordedDomains: { domain: string; label: string }[] };

export function resolveProvider(
  domain: string,
  options: { replaySpeed?: number } = {},
): ProviderResolution {
  if (hasApiKey()) {
    return { ok: true, provider: new LiveProvider() };
  }

  const recording = findRecording(domain);
  if (!recording) {
    return {
      ok: false,
      message:
        `No ANTHROPIC_API_KEY is set, so this instance is in replay mode, and there is no ` +
        `recorded run for "${domain}". Either set an API key to run the agents live, or pick ` +
        `one of the recorded domains below.`,
      recordedDomains: recordedDomains().map(({ domain: d, label }) => ({ domain: d, label })),
    };
  }

  // Replayed tool calls execute for real against pages captured at record
  // time, so the trace shows genuine fetch results with no network access.
  for (const page of recording.pages) {
    primePageCache(page.url, page.html);
  }

  return {
    ok: true,
    provider: new ReplayProvider(recording, resolveModel(), options.replaySpeed),
  };
}

export function newRunId(): string {
  return `run_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function normalizeDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}
