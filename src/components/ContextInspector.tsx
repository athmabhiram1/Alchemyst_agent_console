"use client";

import { useMemo, useState } from "react";
import type { ContextSnapshotEvent, JsonValue } from "@/lib/types";
import { diffJson } from "@/lib/diff";
import { fmtBytes, fmtTime } from "@/lib/format";
import { DiffTree, JsonTree } from "./JsonTree";

export function ContextInspector({
  contexts,
}: {
  contexts: Readonly<Record<string, ContextSnapshotEvent[]>>;
}) {
  const ids = Object.keys(contexts);
  if (ids.length === 0) {
    return (
      <section className="panel ctx-panel">
        <div className="panel-title">Context Inspector</div>
        <div className="ctx-empty">No context snapshots received yet.</div>
      </section>
    );
  }
  return (
    <section className="panel ctx-panel">
      <div className="panel-title">Context Inspector</div>
      <div className="ctx-list">
        {ids.map((id) => (
          <ContextCard key={id} id={id} snaps={contexts[id]} />
        ))}
      </div>
    </section>
  );
}

function ContextCard({ id, snaps }: { id: string; snaps: readonly ContextSnapshotEvent[] }) {
  const [compare, setCompare] = useState(snaps.length > 1);
  const [scrub, setScrub] = useState(snaps.length - 1);
  const [base, setBase] = useState(Math.max(0, snaps.length - 2));

  const idx = Math.min(scrub, snaps.length - 1);
  const snap = snaps[idx];
  const baseSnap = snaps[Math.min(base, idx - 1 >= 0 ? idx - 1 : 0)] ?? snaps[0];
  const diff = useMemo(() => {
    if (!compare || idx === 0 || snaps.length < 2) return null;
    return diffJson(baseSnap.data, snap.data);
  }, [compare, idx, baseSnap, snap, snaps]);

  const size = useMemo(() => JSON.stringify(snap.data).length, [snap]);

  return (
    <div className="ctx-card">
      <div className="ctx-head">
        <span className="ctx-id mono">{id}</span>
        <span className="chip chip-gray">{snaps.length} snapshots</span>
        <span className="stat mono">{fmtBytes(size)}</span>
      </div>
      <div className="ctx-controls">
        <label className="ctx-check">
          <input
            type="checkbox"
            checked={compare}
            onChange={(ev) => setCompare(ev.target.checked)}
          />
          diff vs previous
        </label>
        <div className="ctx-scrub">
          <span className="mono">snapshot {idx + 1}/{snaps.length}</span>
          <input
            type="range"
            min={0}
            max={snaps.length - 1}
            value={idx}
            onChange={(ev) => setScrub(Number(ev.target.value))}
          />
          {compare && idx > 0 && (
            <span className="mono dim">
              base #{base + 1} @ {fmtTime(baseSnap.ts)}
            </span>
          )}
        </div>
      </div>
      <div className="ctx-body">
        {compare && diff ? (
          <DiffTree node={diff} />
        ) : (
          <JsonTree data={snap.data as JsonValue} rootName="snapshot" />
        )}
      </div>
    </div>
  );
}