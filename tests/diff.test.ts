import { describe, expect, it } from "vitest";
import { diffJson, isEqual } from "../src/lib/diff";
import type { JsonValue } from "../src/lib/types";

describe("isEqual", () => {
  it("compares primitives", () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual(1, 2)).toBe(false);
    expect(isEqual("a", "a")).toBe(true);
    expect(isEqual(null, null)).toBe(true);
    expect(isEqual(null, 0)).toBe(false);
  });

  it("compares nested objects and arrays deeply", () => {
    const a: JsonValue = { x: { y: [1, 2, { z: "q" }] }, n: 1 };
    expect(isEqual(a, JSON.parse(JSON.stringify(a)))).toBe(true);
    expect(isEqual(a, { x: { y: [1, 2, { z: "r" }] }, n: 1 })).toBe(false);
    expect(isEqual([1, 2], [1, 2])).toBe(true);
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
  });
});

describe("diffJson", () => {
  it("marks identical subtrees as same", () => {
    const d = diffJson({ a: 1 }, { a: 1 });
    expect(d.type).toBe("same");
  });

  it("reports scalar changes with both values", () => {
    const d = diffJson({ a: 1 }, { a: 2 });
    expect(d.type).toBe("changed");
    const child = d.children!.find((c) => c.key === "a")!;
    expect(child.type).toBe("changed");
    expect(child.oldVal).toBe(1);
    expect(child.newVal).toBe(2);
  });

  it("reports added and removed keys", () => {
    const d = diffJson({ a: 1 }, { b: 2 });
    const keys = d.children!.map((c) => `${c.key}:${c.type}`).sort();
    expect(keys).toEqual(["a:removed", "b:added"]);
  });

  it("handles arrays by index", () => {
    const d = diffJson([1, 2], [1, 3, 4]);
    const byIndex = d.children!.map((c) => ({ idx: c.key, type: c.type }));
    expect(byIndex).toEqual([
      { idx: "[0]", type: "same" },
      { idx: "[1]", type: "changed" },
      { idx: "[2]", type: "added" },
    ]);
  });

  it("detects only the changed branch in a deep tree", () => {
    const prev: JsonValue = { a: { b: { c: { d: 1 } } }, keep: [1, 2, 3] };
    const next: JsonValue = { a: { b: { c: { d: 2 } } }, keep: [1, 2, 3] };
    const d = diffJson(prev, next);
    const a = d.children!.find((c) => c.key === "a")!;
    const b = a.children!.find((c) => c.key === "b")!;
    const c = b.children!.find((c) => c.key === "c")!;
    expect(c.children!.find((x) => x.key === "d")!.oldVal).toBe(1);
    expect(c.children!.find((x) => x.key === "d")!.newVal).toBe(2);
    expect(d.children!.find((x) => x.key === "keep")!.type).toBe("same");
  });
});
