import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentEngine } from "../src/lib/engine";
import type { ClientMessage, ServerEvent, Transport } from "../src/lib/types";

class FakeTransport implements Transport {
  readyState = 0;
  onOpen: (() => void) | null = null;
  onMessage: ((data: string) => void) | null = null;
  onClose: ((code: number, reason: string) => void) | null = null;
  onError: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  open(): void {
    this.readyState = 1;
    this.onOpen?.();
  }

  emit(data: string): void {
    this.onMessage?.(data);
  }

  send(msg: ClientMessage): void {
    this.sent.push(JSON.stringify(msg));
  }

  sendRaw(payload: string): void {
    this.sent.push(payload);
  }

  close(code = 1000): void {
    this.readyState = 3;
    this.closed = true;
    this.onClose?.(code, "");
  }
}

function emitJson(t: FakeTransport, e: Partial<ServerEvent> & { seq: number }): void {
  t.emit(JSON.stringify({ ts: Date.now(), ...e }));
}

function engine(opts?: ConstructorParameters<typeof AgentEngine>[1]) {
  const transports: FakeTransport[] = [];
  const notify = vi.fn();
  const eng = new AgentEngine(
    () => {
      const t = new FakeTransport();
      transports.push(t);
      return t;
    },
    { notify, ...opts },
  );
  eng.connect();
  return { eng, transports, notify };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AgentEngine ordered assembly", () => {
  it("assembles a token stream into chat and a token group", () => {
    const { eng, transports } = engine();
    transports[0].open();
    emitJson(transports[0], { type: "TOKEN", seq: 1, text: "Hel", stream_id: "s1" });
    emitJson(transports[0], { type: "TOKEN", seq: 2, text: "lo", stream_id: "s1" });
    emitJson(transports[0], { type: "STREAM_END", seq: 3, stream_id: "s1" });
    const snap = eng.snapshot();
    expect(snap.chat[0].text).toBe("Hello");
    expect(snap.chat[0].status).toBe("complete");
    expect(snap.groups[0].count).toBe(5);
    expect(snap.lastProcessedSeq).toBe(3);
  });

  it("resolves tool calls and acks them", () => {
    const { eng, transports } = engine();
    transports[0].open();
    emitJson(transports[0], { type: "TOOL_CALL", seq: 1, call_id: "c1", tool_name: "search", args: { q: "x" }, stream_id: "s1" });
    emitJson(transports[0], { type: "TOOL_RESULT", seq: 2, call_id: "c1", result: { n: 3 }, stream_id: "s1" });
    emitJson(transports[0], { type: "STREAM_END", seq: 3, stream_id: "s1" });
    const sent = transports[0].sent.map((s) => JSON.parse(s) as ClientMessage);
    expect(sent.some((m) => m.type === "TOOL_ACK" && m.call_id === "c1")).toBe(true);
    const snap = eng.snapshot();
    expect(snap.chat[0].tools[0].state).toBe("done");
    expect(snap.chat[0].tools[0].result).toEqual({ n: 3 });
    expect(snap.chat[0].status).toBe("complete");
  });

  it("processes out-of-order events in sequence order", () => {
    const { transports, eng } = engine();
    transports[0].open();
    emitJson(transports[0], { type: "TOOL_RESULT", seq: 2, call_id: "c1", result: "r", stream_id: "s1" });
    emitJson(transports[0], { type: "TOOL_CALL", seq: 1, call_id: "c1", tool_name: "t", args: {}, stream_id: "s1" });
    const snap = eng.snapshot();
    expect(snap.chat[0].tools[0].state).toBe("done");
    expect(snap.trace[0].kind).toBe("TOOL_CALL");
    expect(snap.trace[1].kind).toBe("TOOL_RESULT");
  });

it("drops duplicated events and does not double text", () => {
    const { transports, eng } = build();
    const payload = JSON.stringify({ type: "TOKEN", seq: 1, text: "ab", stream_id: "s1", ts: Date.now() });
    transports[0].emit(payload);
    transports[0].emit(payload);
    emitJson(transports[0], { type: "STREAM_END", seq: 2, stream_id: "s1" });
    const snap = eng.snapshot();
    expect(snap.chat[0].text).toBe("ab");
  });
});

function build() {
  const { eng, transports, notify } = engine();
  transports[0].open();
  return { eng, transports, notify };
}

describe("AgentEngine resilience", () => {
  it("survives malformed JSON and invalid envelopes without throwing", () => {
    const { transports, eng } = build();
    transports[0].emit("{not json");
    transports[0].emit("[1,2]");
    transports[0].emit("{}");
    transports[0].emit("null");
    emitJson(transports[0], { type: "TOKEN", seq: 1, text: "a", stream_id: "s1" });
    const snap = eng.snapshot();
    expect(snap.chat[0].text).toBe("a");
    expect(snap.trace.some((t) => t.kind === "ERROR")).toBe(true);
  });

  it("answers PING with PONG even when it arrives late/out-of-band", () => {
    const { transports, eng } = build();
    emitJson(transports[0], { type: "PING", seq: 4, challenge: "abc" });
    const sent = transports[0].sent.map((s) => JSON.parse(s) as ClientMessage);
    expect(sent.some((m) => m.type === "PONG" && m.echo === "abc")).toBe(true);
    expect(transports[0].sent.length).toBe(1);
    void eng;
  });

  it("reconnects with backoff and sends RESUME from last processed seq", () => {
    const { eng, transports } = engine();
    transports[0].open();
    emitJson(transports[0], { type: "TOKEN", seq: 1, text: "x", stream_id: "s1" });
    emitJson(transports[0], { type: "TOKEN", seq: 2, text: "y", stream_id: "s1" });
    transports[0].close(4000);
    expect(eng.snapshot().state).toBe("reconnecting");
    vi.advanceTimersByTime(1000);
    expect(transports.length).toBe(2);
    transports[1].open();
    const resume = transports[1].sent.map((s) => JSON.parse(s) as ClientMessage).find((m) => m.type === "RESUME");
    expect(resume).toEqual({ type: "RESUME", last_seq: 2 });
    expect(eng.snapshot().chat[0].text).toBe("xy");
  });

  it("forces a reconnect when a sequence gap persists (watchdog)", () => {
    const { eng, transports } = engine({ gapRecoveryMs: 100 });
    transports[0].open();
    emitJson(transports[0], { type: "TOKEN", seq: 1, text: "a", stream_id: "s1" });
    emitJson(transports[0], { type: "TOKEN", seq: 4, text: "d", stream_id: "s1" });
    expect(eng.snapshot().stats.queuedAhead).toBe(1);
    vi.advanceTimersByTime(200);
    expect(eng.snapshot().stats.resets).toBe(1);
    expect(transports[0].closed).toBe(true);
  });

  it("reconnects and replays, deduplicating replayed events", () => {
    const { eng, transports } = engine();
    transports[0].open();
    emitJson(transports[0], { type: "TOKEN", seq: 1, text: "a", stream_id: "s1" });
    transports[0].close(4000);
    vi.advanceTimersByTime(600);
    transports[1].open();
    emitJson(transports[1], { type: "TOKEN", seq: 1, text: "a", stream_id: "s1" }); // replay, must drop
    emitJson(transports[1], { type: "TOKEN", seq: 2, text: "b", stream_id: "s1" });
    emitJson(transports[1], { type: "STREAM_END", seq: 3, stream_id: "s1" });
    expect(eng.snapshot().chat[0].text).toBe("ab");
    expect(eng.snapshot().groups.length).toBe(1);
    expect(eng.snapshot().groups[0].count).toBe(2);
  });
});