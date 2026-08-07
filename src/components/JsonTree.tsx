"use client";

import { useState } from "react";
import type { JsonValue } from "@/lib/types";
import type { DiffNode } from "@/lib/diff";
import { pretty } from "@/lib/format";

const MAX_VISIBLE = 60;

export function JsonTree({ data, rootName = "root" }: { data: JsonValue; rootName?: string }) {
  return (
    <div className="json-tree">
      <JsonNode name={rootName} value={data} depth={0} />
    </div>
  );
}

function JsonNode({
  name,
  value,
  depth,
}: {
  name: string;
  value: JsonValue;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [showAll, setShowAll] = useState(false);

  if (value === null || typeof value !== "object") {
    return (
      <div className="jt-row">
        <span className="jt-key">{name}</span>
        <span className="jt-val">{pretty(value)}</span>
      </div>
    );
  }

  const arr = Array.isArray(value);
  const entries: [string, JsonValue][] = arr
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);
  const visible = showAll ? entries : entries.slice(0, MAX_VISIBLE);

  return (
    <div className="jt-node">
      <button className="jt-toggle" onClick={() => setOpen(!open)}>
        <span className="jt-caret">{open ? "▾" : "▸"}</span>
        <span className="jt-key">{name}</span>
        <span className="jt-meta mono">
          {arr ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div className="jt-children">
          {visible.map(([k, v]) => (
            <JsonNode key={k} name={k} value={v} depth={depth + 1} />
          ))}
          {!showAll && entries.length > MAX_VISIBLE && (
            <button className="jt-more" onClick={() => setShowAll(true)}>
              … show {entries.length - MAX_VISIBLE} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function DiffTree({ node }: { node: DiffNode }) {
  const [open, setOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  if (node.type === "same") return null;

  const children = node.children ?? [];
  const visible = showAll ? children : children.slice(0, MAX_VISIBLE);

  return (
    <div className="jt-node">
      <button className="jt-toggle" onClick={() => setOpen(!open)}>
        <span className="jt-caret">{open ? "▾" : "▸"}</span>
        <span className="jt-key">{node.key || "root"}</span>
        <span className={`diff-badge ${node.type}`}>{node.type}</span>
        {children.length > 0 && <span className="jt-meta mono">({children.length})</span>}
      </button>
      {open && (
        <div className="jt-children">
          {node.oldVal !== undefined && node.newVal === undefined && (
            <div className="jt-row diff-removed">
              <span className="jt-key">value</span>
              <span className="jt-val">{pretty(node.oldVal)}</span>
            </div>
          )}
          {node.newVal !== undefined && node.oldVal === undefined && (
            <div className="jt-row diff-added">
              <span className="jt-key">value</span>
              <span className="jt-val">{pretty(node.newVal)}</span>
            </div>
          )}
          {node.oldVal !== undefined && node.newVal !== undefined && (
            <div className="jt-row">
              <span className="jt-key">value</span>
              <span className="jt-val diff-removed">{pretty(node.oldVal)}</span>
              <span className="jt-arrow">→</span>
              <span className="jt-val diff-added">{pretty(node.newVal)}</span>
            </div>
          )}
          {visible.map((c) => (
            <DiffTree key={`${c.key}-${c.type}`} node={c} />
          ))}
          {!showAll && children.length > MAX_VISIBLE && (
            <button className="jt-more" onClick={() => setShowAll(true)}>
              … show {children.length - MAX_VISIBLE} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}