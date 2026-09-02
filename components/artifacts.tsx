"use client";

import { useEffect, useMemo, useState } from "react";
import { SCORING_WEIGHTS, type ScoringComponent } from "../config/scoring";
import type { Touch } from "../lib/agents/copy";
import { formatMetric, type Metric } from "../lib/evidence";
import type { RunArtifacts } from "../lib/orchestrator";

const TABS = ["Dossier", "Competitive", "Leakage", "Outreach", "CRM"] as const;
type Tab = (typeof TABS)[number];

const IMPACT_STYLE: Record<string, string> = {
  high: "border-state-err/50 text-state-err",
  medium: "border-state-warn/50 text-state-warn",
  low: "border-ink-400 text-fg-faint",
};

const COMPONENT_LABELS: Record<ScoringComponent, string> = {
  fit: "ICP fit",
  painSeverity: "Pain severity",
  timingSignals: "Timing signals",
  reachability: "Reachability",
};

/**
 * Domains have no natural break points, so a narrow column snaps them
 * mid-word ("acmedent / al.com"). Offering the browser a break before the TLD
 * makes the wrap read as deliberate.
 */
function BreakableDomain({ domain }: { domain: string }) {
  const split = domain.lastIndexOf(".");
  if (split <= 0) return <>{domain}</>;
  return (
    <>
      {domain.slice(0, split)}
      <wbr />
      {domain.slice(split)}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-8 text-center text-2xs text-fg-faint">{children}</p>;
}

function Badge({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`border px-1.5 py-0.5 font-mono text-2xs uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}

/**
 * A metric always renders with its provenance. That is the whole point of it.
 *
 * `clamp` keeps a long qualitative value from turning a narrow table column
 * into a one-word-per-line ribbon; the full text stays in the title.
 */
function MetricCell({ metric, clamp = false }: { metric: Metric; clamp?: boolean }) {
  const provenance = metric.evidence.map((e) => `${e.source}\n${e.excerpt}`).join("\n\n");
  return (
    <div title={clamp ? `${formatMetric(metric)}\n\n${provenance}` : undefined}>
      <span
        className={`${metric.basis === "estimated" ? "text-fg-dim" : "text-fg"} ${
          clamp ? "line-clamp-3" : ""
        }`}
      >
        {formatMetric(metric)}
      </span>
      <span
        className={`font-mono text-2xs ${clamp ? "mt-0.5 block" : "ml-1.5"} ${
          metric.basis === "estimated" ? "text-state-warn" : "text-accent-dim"
        }`}
        title={provenance}
      >
        {metric.basis === "estimated" ? `est/${metric.confidence}` : "derived"}
      </span>
    </div>
  );
}

function Dossier({ artifacts }: { artifacts: RunArtifacts }) {
  const { recce, scoring, score, tier } = artifacts;
  if (!recce) return <Empty>No prospect profile. The recce agent did not complete.</Empty>;

  return (
    <div className="space-y-4 p-4">
      <div className="panel p-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="label">ICP fit</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-medium text-accent">{score ?? "--"}</span>
              <span className="font-mono text-xs text-fg-faint">/100</span>
            </div>
          </div>
          <div className="text-right">
            <div className="label">Tier</div>
            <div className="mt-1 font-mono text-3xl font-medium text-fg">{tier ?? "-"}</div>
          </div>
        </div>

        {scoring && (
          <div className="mt-5 space-y-2.5">
            {(Object.keys(COMPONENT_LABELS) as ScoringComponent[]).map((key) => {
              const component = scoring.components[key];
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between font-mono text-2xs">
                    <span className="text-fg-dim">
                      {COMPONENT_LABELS[key]}
                      <span className="ml-1.5 text-fg-faint">
                        w{SCORING_WEIGHTS[key].toFixed(2)}
                      </span>
                    </span>
                    <span className="text-fg">{component.score}</span>
                  </div>
                  <div className="mt-1 h-1 w-full bg-ink-600">
                    <div className="h-1 bg-accent" style={{ width: `${component.score}%` }} />
                  </div>
                  <p className="mt-1.5 text-2xs leading-relaxed text-fg-faint">{component.rationale}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {scoring && (
        <div className="panel p-4">
          <div className="label">Rationale</div>
          <p className="mt-2 text-xs leading-relaxed text-fg-dim">{scoring.rationale}</p>
          <p className="mt-2 font-mono text-2xs text-fg-faint">
            confidence: {scoring.confidence}
          </p>
        </div>
      )}

      <div className="panel p-4">
        <div className="label">{recce.companyName}</div>
        <p className="mt-2 text-xs leading-relaxed text-fg-dim">{recce.positioning}</p>
        <p className="mt-3 text-xs leading-relaxed text-fg-dim">{recce.summary}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 font-mono text-2xs">
          <div>
            <div className="label">Target market</div>
            <p className="mt-1 font-sans text-2xs text-fg-dim">{recce.targetMarket}</p>
          </div>
          <div>
            <div className="label">Pricing on site</div>
            <p className="mt-1 font-sans text-2xs text-fg-dim">
              {recce.pricingSignals.disclosed ? "Yes" : "No"}. {recce.pricingSignals.notes}
            </p>
          </div>
          <div>
            <div className="label">CTA density</div>
            <div className="mt-1 text-2xs">
              <MetricCell metric={recce.ctaDensity} />
            </div>
          </div>
          <div>
            <div className="label">Tech stack</div>
            <p className="mt-1 text-2xs text-fg-dim">
              {recce.techStack.length ? recce.techStack.join(", ") : "none detected"}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="label">Services</div>
          <ul className="mt-1.5 space-y-1">
            {recce.services.map((service) => (
              <li key={service.name} className="text-2xs text-fg-dim">
                <span className="text-fg">{service.name}.</span> {service.description}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4">
          <div className="label">Pages read</div>
          <ul className="mt-1.5 space-y-0.5 font-mono text-2xs text-fg-faint">
            {recce.pagesRead.map((page) => (
              <li key={page.url} className="truncate">
                {page.url}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Competitive({ artifacts }: { artifacts: RunArtifacts }) {
  const { competitorMap, visibility } = artifacts;
  if (!competitorMap) return <Empty>No competitive set. That agent did not complete.</Empty>;

  return (
    <div className="space-y-4 p-4">
      <div className="panel">
        <div className="panel-header">
          <span className="label">Competitive set</span>
        </div>
        <div className="divide-y divide-ink-500">
          {competitorMap.competitors.map((competitor) => (
            <div key={competitor.domain} className="p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-fg">{competitor.name}</span>
                <Badge className="border-ink-400 text-fg-faint">{competitor.overlapType}</Badge>
              </div>
              <div className="mt-0.5 font-mono text-2xs text-fg-faint">{competitor.domain}</div>
              <p className="mt-1.5 text-2xs text-fg-dim">{competitor.positioningOneLiner}</p>
              <p className="mt-1 text-2xs leading-relaxed text-fg-faint">{competitor.whyTheyCompete}</p>
            </div>
          ))}
        </div>
      </div>

      {visibility ? (
        <div className="panel">
          <div className="panel-header">
            <span className="label">Organic visibility</span>
            <span className="font-mono text-2xs text-state-warn">every figure labelled</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-2xs">
              <thead>
                <tr className="border-b border-ink-500 text-left">
                  <th className="px-3 py-2 font-mono font-normal text-fg-faint">Domain</th>
                  <th className="px-3 py-2 font-mono font-normal text-fg-faint">Indexed</th>
                  <th className="px-3 py-2 font-mono font-normal text-fg-faint">Coverage</th>
                  <th className="px-3 py-2 font-mono font-normal text-fg-faint">Trajectory</th>
                </tr>
              </thead>
              <tbody>
                {visibility.entries.map((entry) => (
                  <tr
                    key={entry.domain}
                    className={`border-b border-ink-600 align-top ${
                      entry.isProspect ? "bg-accent-soft/40" : ""
                    }`}
                  >
                    <td className="px-3 py-2 font-mono text-fg">
                      <div>
                        <BreakableDomain domain={entry.domain} />
                      </div>
                      {entry.isProspect && <span className="text-accent-dim">prospect</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <MetricCell metric={entry.indexedContentVolume} clamp />
                    </td>
                    <td className="w-[46%] px-3 py-2 text-fg-dim">
                      <MetricCell metric={entry.topicalCoverage} clamp />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          entry.rankingTrajectory.direction === "rising"
                            ? "text-state-err"
                            : entry.rankingTrajectory.direction === "declining"
                              ? "text-accent"
                              : "text-fg-dim"
                        }
                      >
                        {entry.rankingTrajectory.direction}
                      </span>
                      <span className="ml-1.5 font-mono text-fg-faint">
                        {entry.rankingTrajectory.confidence}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink-500 p-3">
            <div className="label">Methodology</div>
            <p className="mt-1.5 text-2xs leading-relaxed text-fg-faint">{visibility.methodology}</p>
            <div className="label mt-3">Caveats</div>
            <ul className="mt-1.5 space-y-1">
              {visibility.caveats.map((caveat, index) => (
                <li key={index} className="text-2xs leading-relaxed text-fg-faint">
                  - {caveat}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <Empty>Organic visibility was not produced for this run.</Empty>
      )}
    </div>
  );
}

function Leakage({ artifacts }: { artifacts: RunArtifacts }) {
  const { leakage } = artifacts;
  if (!leakage) return <Empty>No leakage findings. That agent did not complete.</Empty>;

  return (
    <div className="space-y-4 p-4">
      <div className="panel">
        <div className="panel-header">
          <span className="label">Conversion leakage</span>
          <span className="font-mono text-2xs text-fg-faint">
            {leakage.conversionLeakage.length} findings
          </span>
        </div>
        <div className="divide-y divide-ink-500">
          {leakage.conversionLeakage.map((finding) => (
            <div key={finding.title} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-fg">{finding.title}</span>
                <Badge className={IMPACT_STYLE[finding.impact] ?? ""}>{finding.impact}</Badge>
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-fg-dim">{finding.detail}</p>
              <p className="mt-2 text-2xs leading-relaxed text-accent-dim">Fix: {finding.fix}</p>
              <details className="mt-2">
                <summary className="cursor-pointer font-mono text-2xs text-fg-faint">
                  evidence ({finding.evidence.length})
                </summary>
                <ul className="mt-1.5 space-y-1.5">
                  {finding.evidence.map((item, index) => (
                    <li key={index} className="border-l border-ink-400 pl-2 text-2xs text-fg-faint">
                      <div className="font-mono">{item.source}</div>
                      <div className="mt-0.5 italic">{item.excerpt}</div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="label">Competitor leakage</span>
          <span className="font-mono text-2xs text-fg-faint">
            {leakage.competitorLeakage.length} findings
          </span>
        </div>
        <div className="divide-y divide-ink-500">
          {leakage.competitorLeakage.map((finding) => (
            <div key={finding.title} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-medium text-fg">{finding.title}</span>
                <Badge className={IMPACT_STYLE[finding.impact] ?? ""}>{finding.impact}</Badge>
              </div>
              <div className="mt-1 font-mono text-2xs text-fg-faint">
                {finding.queryTheme} · owned by {finding.ownedBy.join(", ")}
              </div>
              <p className="mt-1.5 text-2xs leading-relaxed text-fg-dim">{finding.detail}</p>
              <p className="mt-2 text-2xs leading-relaxed text-accent-dim">Fix: {finding.fix}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Outreach({
  artifacts,
  runId,
  onPushed,
}: {
  artifacts: RunArtifacts;
  runId: string | null;
  onPushed: (payload: unknown) => void;
}) {
  const [touches, setTouches] = useState<Touch[]>(artifacts.copy?.touches ?? []);
  const [pushing, setPushing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTouches(artifacts.copy?.touches ?? []);
  }, [artifacts.copy]);

  if (!artifacts.copy) return <Empty>No sequence. The copy agent did not complete.</Empty>;

  async function push() {
    if (!runId) return;
    setPushing(true);
    setError(null);
    try {
      const response = await fetch("/api/crm/push", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ runId, touches }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error: unknown }).error)
            : "Push failed.";
        setError(message);
        return;
      }
      onPushed(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPushing(false);
    }
  }

  function edit(index: number, change: Partial<Touch>) {
    setTouches((current) =>
      current.map((touch, i) => (i === index ? { ...touch, ...change } : touch)),
    );
  }

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="label">4-touch sequence</span>
        <button className="btn-primary" onClick={push} disabled={pushing || !runId}>
          {pushing ? "pushing..." : "push to CRM"}
        </button>
      </div>

      {error && (
        <div className="border border-state-err/50 px-3 py-2 text-2xs text-state-err">{error}</div>
      )}

      {touches.map((touch, index) => (
        <div key={index} className="panel">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xs text-accent">Day {touch.day}</span>
              <span className="font-mono text-2xs text-fg-faint">{touch.channel}</span>
            </div>
            <span className="font-mono text-2xs text-fg-faint">
              {touch.body.trim().split(/\s+/).filter(Boolean).length}w
            </span>
          </div>
          <div className="space-y-2 p-3">
            {touch.channel === "email" && (
              <div>
                <div className="label mb-1">Subject ({(touch.subject ?? "").length}/45)</div>
                <input
                  className="field"
                  value={touch.subject ?? ""}
                  onChange={(event) => edit(index, { subject: event.target.value })}
                />
              </div>
            )}
            <div>
              <div className="label mb-1">Body</div>
              <textarea
                className="field min-h-[130px] resize-y leading-relaxed"
                value={touch.body}
                onChange={(event) => edit(index, { body: event.target.value })}
              />
            </div>
            <div className="border-l-2 border-accent-dim pl-2">
              <div className="label">Cites finding</div>
              <div className="mt-0.5 text-2xs text-fg-dim">{touch.referencedFinding}</div>
            </div>
          </div>
        </div>
      ))}

      <div className="panel p-3">
        <div className="label">Sequence notes</div>
        <p className="mt-1.5 text-2xs leading-relaxed text-fg-faint">
          {artifacts.copy.sequenceNotes}
        </p>
      </div>
    </div>
  );
}

function Crm({ payload }: { payload: unknown }) {
  if (!payload) {
    return (
      <Empty>
        Nothing written yet. Push the sequence from the Outreach tab and the exact payloads appear
        here, with HubSpot property names.
      </Empty>
    );
  }

  const sections = Object.entries(payload as Record<string, unknown>);

  return (
    <div className="space-y-3 p-4">
      <p className="text-2xs leading-relaxed text-fg-faint">
        These are the objects MockCRM wrote. Property names are HubSpot&apos;s exactly, so a real
        adapter posts this same JSON to the CRM v3 API without any caller changing.
      </p>
      {sections.map(([key, value]) => (
        <div key={key} className="panel">
          <div className="panel-header">
            <span className="label">{key}</span>
          </div>
          <pre className="trace-line max-h-72 overflow-auto bg-ink-900 px-3 py-2 font-mono text-2xs text-fg-dim">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}

function asTab(value: string | null): Tab | null {
  return TABS.find((name) => name.toLowerCase() === value?.toLowerCase()) ?? null;
}

export function ArtifactsPanel({
  artifacts,
  runId,
  initialTab = null,
  savedCrm = null,
}: {
  artifacts: RunArtifacts | null;
  runId: string | null;
  initialTab?: string | null;
  /** What this run previously wrote, so reopening it is not a blank tab. */
  savedCrm?: unknown;
}) {
  const [tab, setTab] = useState<Tab>(() => asTab(initialTab) ?? "Dossier");
  const [crmPayload, setCrmPayload] = useState<unknown>(savedCrm);

  useEffect(() => {
    setCrmPayload(savedCrm);
  }, [runId, savedCrm]);

  // ?tab= is read after mount, so honour it when it lands.
  useEffect(() => {
    const requested = asTab(initialTab);
    if (requested) setTab(requested);
  }, [initialTab]);

  const counts = useMemo(() => {
    if (!artifacts) return {} as Partial<Record<Tab, number>>;
    return {
      Competitive: artifacts.competitorMap?.competitors.length,
      Leakage: artifacts.leakage
        ? artifacts.leakage.conversionLeakage.length + artifacts.leakage.competitorLeakage.length
        : undefined,
      Outreach: artifacts.copy?.touches.length,
    } as Partial<Record<Tab, number>>;
  }, [artifacts]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 border-b border-ink-500">
        {TABS.map((name) => (
          <button
            key={name}
            className={`tab ${
              tab === name
                ? "border-accent text-fg"
                : "border-transparent text-fg-faint hover:text-fg-dim"
            }`}
            onClick={() => setTab(name)}
          >
            {name}
            {counts[name] !== undefined && (
              <span className="ml-1.5 text-fg-faint">{counts[name]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {!artifacts ? (
          <Empty>Run an analysis and the dossier, competitive table, findings and sequence land here.</Empty>
        ) : tab === "Dossier" ? (
          <Dossier artifacts={artifacts} />
        ) : tab === "Competitive" ? (
          <Competitive artifacts={artifacts} />
        ) : tab === "Leakage" ? (
          <Leakage artifacts={artifacts} />
        ) : tab === "Outreach" ? (
          <Outreach artifacts={artifacts} runId={runId} onPushed={setCrmPayload} />
        ) : (
          <Crm payload={crmPayload} />
        )}
      </div>
    </div>
  );
}
