import { describe, expect, it } from "vitest";
import { SeqBuffer } from "../src/lib/seqBuffer";

interface Ev {
  type: string;
  seq: number;
}

const ev = (seq: number, type = "E"): Ev => ({ seq, type });

describe("SeqBuffer", () => {
  it("returns events in arrival order when in sequence", () => {
    const b = new SeqBuffer<Ev>();
    expect(b.feed(ev(1))).toEqual([ev(1)]);
    expect(b.feed(ev(2))).toEqual([ev(2)]);
    expect(b.lastProcessed).toBe(2);
  });

  it("buffers out-of-order events and drains in order once the gap fills", () => {
    const b = new SeqBuffer<Ev>();
    b.feed(ev(1));
    expect(b.feed(ev(3))).toEqual([]);
    expect(b.queuedCount).toBe(1);
    const drained = b.feed(ev(2));
    expect(drained).toEqual([ev(2), ev(3)]);
    expect(b.lastProcessed).toBe(3);
    expect(b.queuedCount).toBe(0);
  });

  it("drains a long chain in one batch", () => {
    const b = new SeqBuffer<Ev>();
    b.feed(ev(1));
    b.feed(ev(4));
    b.feed(ev(3));
    const drained = b.feed(ev(2));
    expect(drained.map((e) => e.seq)).toEqual([2, 3, 4]);
  });

  it("drops duplicates of already-processed sequences", () => {
    const b = new SeqBuffer<Ev>();
    b.feed(ev(1));
    b.feed(ev(2));
    expect(b.feed(ev(1))).toEqual([]);
    expect(b.feed(ev(2))).toEqual([]);
  });

  it("drops duplicates that are already buffered", () => {
    const b = new SeqBuffer<Ev>();
    b.feed(ev(1));
    b.feed(ev(3));
    b.feed(ev(3));
    expect(b.queuedCount).toBe(1);
    expect(b.feed(ev(2)).map((e) => e.seq)).toEqual([2, 3]);
  });

  it("detects gaps via hasGap and supports RESUME reset", () => {
    const b = new SeqBuffer<Ev>();
    b.feed(ev(1));
    b.feed(ev(2));
    expect(b.hasGap(5)).toBe(true);
    expect(b.hasGap(2)).toBe(false);
    b.setNext(5);
    expect(b.lastProcessed).toBe(4);
    expect(b.feed(ev(6))).toEqual([]);
    expect(b.feed(ev(5)).map((e) => e.seq)).toEqual([5, 6]);
  });
});
