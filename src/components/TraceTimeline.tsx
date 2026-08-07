"use client";

import { useMemo, useState } from "react";
import type { TraceKind, TraceRow } from "@/lib/types";
import { fmtTime } from "@/lib/format";

const ROW_H = 24;
const KIND_COLOR: Record<TraceKind, string> = {
  TOKEN: "k-token",
  TOOL_CALL: "k-call",
  TOOL_RESULT: "k-result",
  CONTEXT_SNAPSHOT: "k-ctx",
  PING: "k-ping",
  PONG: "k-pong",
  STREAM_END: "k-end",
  ERROR: "k-err",
  RESUME: "k-resume",
  RECONNECT: "k-reconnect",
};

const DEFAULT_HIDDEN: TraceKind[] = ["TOKEN"];

export function TraceTimeline({ rows }: { rows: readonly TraceRow[] }) {
  const kinds = useMemo(() => Array.from(new Set(rows.map((r) => r.kind))), [rows]);
  const [hidden, setHidden] = useState<Set<TraceKind>>(new Set(DEFAULT_HIDDEN));
  const [viewport, setViewport] = useState({ top: 0, height: 400 });

  const visible = useMemo(
    () => rows.filter((r) => !hidden.has(r.kind)),
    [rows, hidden],
  );

  const start = Math.max(0, Math.floor(viewport.top / ROW_H) - 4);
  const end = Math.min(visible.length, Math.ceil((viewport.top + viewport.height) / ROW_H) + 4);
  const slice = visible.slice(start, end);

  const toggle = (k: TraceKind) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  return (
    <section className="panel trace-panel">
      <div className="panel-title-row">
        <span className="panel-title">Agent Trace</span>
        <span className="filters">
          {kinds.map((k) => (
            <button
              key={k}
              className={`filter-chip ${hidden.has(k) ? "off" : ""} ${KIND_COLOR[k]}`}
              onClick={() => toggle(k)}
            >
              {k}
            </button>
          ))}
        </span>
      </div>
      <div
        className="trace-scroll mono"
        onScroll={(ev) => {
          const el = ev.currentTarget;
          setViewport({ top: el.scrollTop, height: el.clientHeight });
        }}
      >
        <div style={{ height: visible.length * ROW_H, position: "relative" }}>
          {slice.map((r, i) => (
            <div
              key={r.id}
              className={`trace-row ${KIND_COLOR[r.kind]}`}
              style={{ position: "absolute", top: (start + i) * ROW_H, height: ROW_H }}
            >
              <span className="tr-seq">{String(r.seq).padStart(4, " ")}</span>
              <span className="tr-kind">{r.kind}</span>
              <span className="tr-time">{fmtTime(r.time)}</span>
              <span className="tr-detail">{r.detail ?? ""}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}