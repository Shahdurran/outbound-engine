"use client";

import { useState } from "react";
import { AGENT_HEADLINES } from "../lib/agents/names";
import type { AgentCard, CardStatus, TraceLine } from "./state";

const STATUS_STYLE: Record<CardStatus, { dot: string; text: string; label: string }> = {
  queued: { dot: "bg-ink-400", text: "text-fg-faint", label: "queued" },
  running: { dot: "bg-state-run animate-pulse", text: "text-state-run", label: "running" },
  done: { dot: "bg-accent", text: "text-accent", label: "done" },
  error: { dot: "bg-state-err", text: "text-state-err", label: "failed" },
};

const TONE_CLASS: Record<TraceLine["tone"], string> = {
  muted: "text-fg-faint",
  normal: "text-fg-dim",
  accent: "text-accent",
  warn: "text-state-warn",
  error: "text-state-err",
};

function clockOf(ts: number): string {
  const date = new Date(ts);
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
    date.getMilliseconds(),
    3,
  )}`;
}

function AgentTrace({ card, index }: { card: AgentCard; index: number }) {
  const [showOutput, setShowOutput] = useState(false);
  const [showArgs, setShowArgs] = useState(false);
  const style = STATUS_STYLE[card.status];

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
          <span className="font-mono text-2xs text-fg-faint">{String(index + 1).padStart(2, "0")}</span>
          <span className="truncate font-mono text-xs font-medium text-fg">{card.name}</span>
          <span className="hidden truncate text-2xs text-fg-faint lg:inline">
            {AGENT_HEADLINES[card.name]}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono text-2xs">
          {card.retries.length > 0 && (
            <span
              className="text-state-warn"
              title={card.retries.flat().join("\n")}
            >
              {card.retries.length} repair
            </span>
          )}
          {card.usage && (
            <span className="text-fg-faint">
              {card.usage.inputTokens.toLocaleString()}in/{card.usage.outputTokens.toLocaleString()}out
            </span>
          )}
          {card.durationMs !== null && <span className="text-fg-dim">{card.durationMs}ms</span>}
          <span className={style.text}>{style.label}</span>
        </div>
      </div>

      {card.lines.length > 0 && (
        <div className="space-y-0.5 px-3 py-2 font-mono text-2xs leading-relaxed">
          {card.lines.map((line, lineIndex) => (
            <div key={lineIndex} className="trace-line flex gap-2.5">
              <span className="shrink-0 text-ink-400">{clockOf(line.ts)}</span>
              <span className={TONE_CLASS[line.tone]} style={{ paddingLeft: line.indent * 12 }}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
      )}

      {(card.toolCalls.length > 0 || card.output !== null) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-500 px-3 py-1.5">
          {card.toolCalls.length > 0 && (
            <button className="btn-ghost" onClick={() => setShowArgs((value) => !value)}>
              {showArgs ? "hide" : "show"} tool args ({card.toolCalls.length})
            </button>
          )}
          {card.output !== null && (
            <button className="btn-ghost" onClick={() => setShowOutput((value) => !value)}>
              {showOutput ? "hide" : "show"} json output
            </button>
          )}
        </div>
      )}

      {showArgs && card.toolCalls.length > 0 && (
        <div className="space-y-2 border-t border-ink-500 bg-ink-900 px-3 py-2">
          {card.toolCalls.map((call) => (
            <div key={call.callId} className="font-mono text-2xs">
              <div className="text-fg-dim">
                {call.tool}
                {call.cached && <span className="ml-2 text-accent-dim">cache hit</span>}
                {call.durationMs !== undefined && (
                  <span className="ml-2 text-fg-faint">{call.durationMs}ms</span>
                )}
              </div>
              <pre className="trace-line mt-1 text-fg-faint">{JSON.stringify(call.args, null, 2)}</pre>
            </div>
          ))}
        </div>
      )}

      {showOutput && card.output !== null && (
        <pre className="trace-line max-h-96 overflow-auto border-t border-ink-500 bg-ink-900 px-3 py-2 font-mono text-2xs text-fg-dim">
          {JSON.stringify(card.output, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function TracePanel({
  cards,
  status,
  emptyHint,
}: {
  cards: AgentCard[];
  status: string;
  emptyHint: string;
}) {
  const idle = status === "idle";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-ink-500 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <h2 className="font-mono text-2xs uppercase tracking-[0.14em] text-fg">Live agent trace</h2>
          <span className="text-2xs text-fg-faint">
            six isolated sub-agents, one typed handoff each
          </span>
        </div>
        <span className="label">{status}</span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {idle ? (
          <div className="mt-16 text-center">
            <p className="font-mono text-xs text-fg-dim">No run yet.</p>
            <p className="mx-auto mt-2 max-w-md text-2xs leading-relaxed text-fg-faint">{emptyHint}</p>
          </div>
        ) : (
          cards.map((card, index) => <AgentTrace key={card.name} card={card} index={index} />)
        )}
      </div>
    </div>
  );
}
