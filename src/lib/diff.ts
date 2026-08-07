import type { JsonValue } from "./types";

export type DiffNodeType = "same" | "added" | "removed" | "changed";

export interface DiffNode {
  key: string;
  type: DiffNodeType;
  oldVal?: JsonValue;
  newVal?: JsonValue;
  children?: DiffNode[];
}

const MAX_DEPTH = 32;

export function isContainer(v: JsonValue): v is JsonValue[] | { [k: string]: JsonValue } {
  return v !== null && typeof v === "object";
}

export function isEqual(a: JsonValue, b: JsonValue): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== typeof b) return false;
  if (typeof a === "object" && typeof b === "object") {
    const aArr = Array.isArray(a);
    const bArr = Array.isArray(b);
    if (aArr !== bArr) return false;
    if (aArr && bArr) {
      const A = a as unknown[];
      const B = b as unknown[];
      if (A.length !== B.length) return false;
      for (let i = 0; i < A.length; i++) if (!isEqual(A[i] as JsonValue, B[i] as JsonValue)) return false;
      return true;
    }
    const A = a as Record<string, JsonValue>;
    const B = b as Record<string, JsonValue>;
    const keys = Object.keys(A);
    if (keys.length !== Object.keys(B).length) return false;
    for (const k of keys) {
      if (!(k in B)) return false;
      if (!isEqual(A[k], B[k])) return false;
    }
    return true;
  }
  return String(a) === String(b);
}

export function diffJson(prev: JsonValue, next: JsonValue, depth = 0): DiffNode {
  if (isEqual(prev, next)) {
    return { key: "", type: "same" };
  }
  if (depth >= MAX_DEPTH || !isContainer(prev) || !isContainer(next)) {
    return { key: "", type: "changed", oldVal: prev, newVal: next };
  }
  if (Array.isArray(prev) && Array.isArray(next)) {
    const maxLen = Math.max(prev.length, next.length);
    const children: DiffNode[] = [];
    for (let i = 0; i < maxLen; i++) {
      const p = i < prev.length ? (prev[i] as JsonValue) : undefined;
      const n = i < next.length ? (next[i] as JsonValue) : undefined;
      if (p === undefined) children.push({ key: `[${i}]`, type: "added", newVal: n });
      else if (n === undefined) children.push({ key: `[${i}]`, type: "removed", oldVal: p });
      else children.push(rekey(diffJson(p, n, depth + 1), `[${i}]`));
    }
    return { key: "", type: "changed", children };
  }
  const prevObj = prev as Record<string, JsonValue>;
  const nextObj = next as Record<string, JsonValue>;
  const keys = new Set<string>([...Object.keys(prevObj), ...Object.keys(nextObj)]);
  const children: DiffNode[] = [];
  for (const k of keys) {
    const hasP = k in prevObj;
    const hasN = k in nextObj;
    if (!hasP) children.push({ key: k, type: "added", newVal: nextObj[k] });
    else if (!hasN) children.push({ key: k, type: "removed", oldVal: prevObj[k] });
    else children.push(rekey(diffJson(prevObj[k], nextObj[k], depth + 1), k));
  }
  return { key: "", type: "changed", children };
}

function rekey(node: DiffNode, key: string): DiffNode {
  return { ...node, key };
}