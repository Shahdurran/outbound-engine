"use client";

import { useCallback, useEffect, useState } from "react";
import type { RunRow } from "../lib/db/runs";
import type { RunArtifacts } from "../lib/orchestrator";
import type { RunMode, TraceEvent } from "../lib/trace";
import { ArtifactsPanel } from "./artifacts";
import { initialState, reduceEvent, replayTrace, type ConsoleState } from "./state";
import { TracePanel } from "./trace";

type RecordedTarget = { domain: string; label: string; icp: string };

type Props = {
  initialRuns: RunRow[];
  mode: RunMode;
  model: string;
  recorded: RecordedTarget[];
};

/**
 * Parses an SSE body. EventSource is not usable here because the run is a POST
 * with a JSON body, so the framing is handled by hand: split on blank lines,
 * read the `event:` and `data:` fields.
 */
async function* readSse(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const chunk = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");

      let event = "message";
      const dataLines: string[] = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;

      try {
        yield { event, data: JSON.parse(dataLines.join("\n")) };
      } catch {
        // A partial frame at the tail of the stream; skip it.
      }
    }
  }
}

function statusColor(status: string): string {
  if (status === "complete") return "text-accent";
  if (status === "degraded") return "text-state-warn";
  if (status === "failed") return "text-state-err";
  if (status === "running") return "text-state-run";
  return "text-fg-faint";
}

export function Console({ initialRuns, mode, model, recorded }: Props) {
  const [domain, setDomain] = useState("");
  const [icp, setIcp] = useState("");
  const [runs, setRuns] = useState<RunRow[]>(initialRuns);
  const [state, setState] = useState<ConsoleState>(() => initialState(mode, model));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialTab, setInitialTab] = useState<string | null>(null);
  const [savedCrm, setSavedCrm] = useState<unknown>(null);

  const refreshRuns = useCallback(async () => {
    try {
      const response = await fetch("/api/runs");
      if (!response.ok) return;
      const payload = (await response.json()) as { runs: RunRow[] };
      setRuns(payload.runs);
    } catch {
      // The list is a convenience; a failed refresh is not worth surfacing.
    }
  }, []);

  const start = useCallback(
    async (targetDomain: string, targetIcp: string) => {
      if (!targetDomain.trim() || busy) return;

      setBusy(true);
      setError(null);
      setSavedCrm(null);
      setState(initialState(mode, model));

      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ domain: targetDomain, icp: targetIcp }),
        });

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          setError(payload?.error ?? `Run failed to start (${response.status}).`);
          return;
        }

        for await (const { event, data } of readSse(response.body)) {
          if (event === "trace") {
            setState((current) => reduceEvent(current, data as TraceEvent));
          } else if (event === "result") {
            const result = data as { artifacts: RunArtifacts; failures: ConsoleState["failures"] };
            setState((current) => ({
              ...current,
              artifacts: result.artifacts,
              failures: result.failures,
            }));
            void refreshRuns();
          } else if (event === "fatal") {
            setError((data as { message: string }).message);
          }
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    },
    [busy, mode, model, refreshRuns],
  );

  const openRun = useCallback(
    async (id: string) => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(`/api/runs/${id}`);
        if (!response.ok) {
          setError(`Could not open run ${id}.`);
          return;
        }
        const payload = (await response.json()) as {
          run: RunRow;
          trace: TraceEvent[];
          artifacts: RunArtifacts;
          crm: unknown;
        };
        setSavedCrm(payload.crm ?? null);
        setState({
          ...replayTrace(payload.trace, payload.run.mode, payload.run.model),
          artifacts: payload.artifacts,
          status: payload.run.status,
        });
        setDomain(payload.run.domain);
        setIcp(payload.run.icp ?? "");

        // A run is a thing you send someone, so give it a URL.
        window.history.replaceState(null, "", `?run=${encodeURIComponent(id)}`);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // Open whatever ?run= and ?tab= point at, so a link lands on the same view
  // the sender was looking at.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam) setInitialTab(tabParam);

    const runParam = params.get("run");
    if (runParam) void openRun(runParam);
  }, [openRun]);

  const emptyHint =
    mode === "replay"
      ? "This instance has no ANTHROPIC_API_KEY, so it is in replay mode: recorded runs stream back with their original tool calls and timings, and the tool calls really execute against cached pages. Pick a recorded target on the left, or set a key to run any domain live."
      : "Enter a domain and the six sub-agents run in sequence. Each one is its own model call with its own tools and a strict JSON contract; nothing is shared between them except the typed output object.";

  return (
    <div className="grid h-screen grid-cols-1 grid-rows-[auto_1fr] lg:grid-cols-[300px_1fr_440px] lg:grid-rows-1">
      {/* Left: input + history */}
      <aside className="flex flex-col overflow-y-auto border-b border-ink-500 lg:border-b-0 lg:border-r">
        <div className="border-b border-ink-500 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <h1 className="font-mono text-sm font-medium tracking-tight text-fg">Outbound Engine</h1>
            <span className="font-mono text-2xs text-fg-faint">v0.8</span>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-fg-faint">
            Company signal to CRM-ready action, with the evidence kept open.
          </p>
        </div>

        <div className="space-y-3 border-b border-ink-500 p-4">
          <div>
            <label className="label mb-1 block">Company domain</label>
            <input
              className="field"
              placeholder="acmedental.com"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void start(domain, icp);
              }}
            />
          </div>
          <div>
            <label className="label mb-1 block">ICP description (optional)</label>
            <textarea
              className="field min-h-[64px] resize-y"
              placeholder="Who should buy, and why now?"
              value={icp}
              onChange={(event) => setIcp(event.target.value)}
            />
          </div>
          <button
            className="btn-primary w-full"
            disabled={busy || !domain.trim()}
            onClick={() => void start(domain, icp)}
          >
            {busy ? "running..." : "run agent"}
          </button>

          {error && (
            <div className="border border-state-err/50 px-2.5 py-2 text-2xs leading-relaxed text-state-err">
              {error}
            </div>
          )}
        </div>

        {mode === "replay" && recorded.length > 0 && (
          <div className="border-b border-ink-500 p-4">
            <div className="label">Recorded targets</div>
            <p className="mt-1 text-2xs leading-relaxed text-fg-faint">
              No API key set, so these are the domains this instance can replay.
            </p>
            <div className="mt-2 space-y-1.5">
              {recorded.map((target) => (
                <button
                  key={target.domain}
                  className="w-full border border-ink-400 px-2.5 py-1.5 text-left transition-colors hover:border-accent/60"
                  onClick={() => {
                    setDomain(target.domain);
                    setIcp(target.icp);
                    void start(target.domain, target.icp);
                  }}
                  disabled={busy}
                >
                  <div className="font-mono text-2xs text-fg">{target.domain}</div>
                  <div className="text-2xs text-fg-faint">{target.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 p-4">
          <div className="flex items-center justify-between">
            <span className="label">Past runs</span>
            <button className="font-mono text-2xs text-fg-faint hover:text-fg" onClick={() => void refreshRuns()}>
              refresh
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {runs.length === 0 && <p className="text-2xs text-fg-faint">No runs yet.</p>}
            {runs.map((run) => (
              <button
                key={run.id}
                className={`w-full border px-2.5 py-1.5 text-left transition-colors ${
                  state.runId === run.id
                    ? "border-accent/60 bg-ink-700"
                    : "border-ink-600 hover:border-ink-400"
                }`}
                onClick={() => void openRun(run.id)}
                disabled={busy}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-2xs text-fg">{run.domain}</span>
                  <span className={`font-mono text-2xs ${statusColor(run.status)}`}>
                    {run.status}
                  </span>
                </div>
                <div className="mt-0.5 flex items-baseline justify-between font-mono text-2xs text-fg-faint">
                  <span>
                    {run.score !== null ? `${run.score}/100 ${run.tier ?? ""}` : "no score"}
                  </span>
                  <span>{run.mode}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-ink-500 px-4 py-2.5 font-mono text-2xs text-fg-faint">
          <div className="flex justify-between">
            <span>mode</span>
            <span className={mode === "live" ? "text-accent" : "text-state-warn"}>{mode}</span>
          </div>
          <div className="mt-0.5 flex justify-between">
            <span>model</span>
            <span className="truncate pl-2">{model}</span>
          </div>
        </div>
      </aside>

      {/* Centre: the trace */}
      <main className="min-h-0 overflow-hidden border-b border-ink-500 lg:border-b-0 lg:border-r">
        <TracePanel
          cards={state.cards}
          status={
            state.status === "idle"
              ? "idle"
              : `${state.status}${state.durationMs ? ` · ${(state.durationMs / 1000).toFixed(1)}s` : ""}${
                  state.usage.costUsd ? ` · $${state.usage.costUsd.toFixed(4)}` : ""
                }`
          }
          emptyHint={emptyHint}
        />
      </main>

      {/* Right: artifacts */}
      <section className="min-h-0 overflow-hidden">
        <ArtifactsPanel
          artifacts={state.artifacts}
          runId={state.runId}
          initialTab={initialTab}
          savedCrm={savedCrm}
        />
      </section>
    </div>
  );
}
