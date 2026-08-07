import type {
  ChatEntry,
  ClientMessage,
  ConnectionState,
  ConnectionStats,
  ContextSnapshotEvent,
  ServerEvent,
  ToolInstance,
  TokenGroup,
  TraceRow,
} from "./types";
import { SeqBuffer } from "./seqBuffer";

export interface Transport {
  readonly readyState: number;
  send(msg: ClientMessage): void;
  sendRaw(payload: string): void;
  close(code?: number): void;
  onOpen: (() => void) | null;
  onMessage: ((data: string) => void) | null;
  onClose: ((code: number, reason: string) => void) | null;
  onError: (() => void) | null;
}

export interface EngineSnapshot {
  chat: readonly ChatEntry[];
  trace: readonly TraceRow[];
  groups: readonly TokenGroup[];
  contexts: Readonly<Record<string, ContextSnapshotEvent[]>>;
  state: ConnectionState;
  resuming: boolean;
  reconnectAttempt: number;
  lastProcessedSeq: number;
  stats: ConnectionStats;
}

export interface EngineOptions {
  notify: () => void;
  maxTraceRows?: number;
  gapRecoveryMs?: number;
  maxBackoffMs?: number;
  baseBackoffMs?: number;
  keepMessageLimit?: number;
  /** Stop retrying after this many consecutive failures. Default: 8. Set 0 to retry forever. */
  maxReconnectAttempts?: number;
}

const TRACE_CAP = 1500;

export class AgentEngine {
  private transport: Transport | null = null;
  private buffer = new SeqBuffer<ServerEvent>();
  private chat: ChatEntry[] = [];
  private trace: TraceRow[] = [];
  private groups: TokenGroup[] = [];
  private contexts: Record<string, ContextSnapshotEvent[]> = {};
  private state: ConnectionState = "idle";
  private resuming = false;
  private reconnectAttempt = 0;
  private latestSeenSeq = 0;
  private gapTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private suppressReconnect = false;
  private tokenBuffers = new Map<
    string,
    { text: string; firstSeq: number; lastSeq: number; start: number }
  >();
  private openTools = new Map<string, ToolInstance>();
  private stats: ConnectionStats = {
    received: 0,
    bytes: 0,
    pings: 0,
    pongs: 0,
    resets: 0,
    sent: 0,
    queuedAhead: 0,
  };

  constructor(
    private readonly transportFactory: () => Transport,
    private readonly opts: EngineOptions,
  ) {}

  connect(): void {
    if (this.transport) {
      this.suppressReconnect = true;
      try {
        this.transport.close(1000);
      } catch {
        /* noop */
      } finally {
        this.suppressReconnect = false;
      }
      this.transport = null;
    }
    this.setState("connecting");
    const t = this.transportFactory();
    this.transport = t;
    t.onOpen = () => this.handleOpen();
    t.onMessage = (data: string) => this.handleRaw(data);
    t.onClose = (code: number, reason: string) => this.handleClose(code, reason);
    t.onError = () => {
      this.pushTrace("ERROR", 0, "Transport error");
    };
  }

  sendUserMessage(content: string): void {
    const text = content.trim();
    if (!text) return;
    this.chat.push({
      id: `user-${this.stats.sent}-${Date.now()}`,
      role: "user",
      text,
      status: "complete",
      tools: [],
    });
    this.send({ type: "USER_MESSAGE", content: text });
  }

  ackTool(callId: string): void {
    this.send({ type: "TOOL_ACK", call_id: callId });
  }

  /** Manual reconnect — resets the attempt counter so the give-up limit starts fresh. */
  reconnect(): void {
    this.reconnectAttempt = 0;
    this.clearTimers();
    this.connect();
  }

  disconnect(): void {
    this.disposed = true;
    this.clearTimers();
    if (this.transport) {
      try {
        this.transport.close(1000);
      } catch {
        /* noop */
      }
      this.transport = null;
    }
    this.setState("closed");
  }

  snapshot(): EngineSnapshot {
    // Return copies of the mutable collections so consumer components that key
    // on array/object identity (e.g. TraceTimeline's useMemo over `rows`) see a
    // fresh reference on every notify. React cannot observe in-place mutation,
    // so sharing the live arrays would freeze derived views after the first render.
    const contexts: Record<string, ContextSnapshotEvent[]> = {};
    for (const [id, list] of Object.entries(this.contexts)) contexts[id] = list.slice();
    return {
      chat: this.chat.slice(),
      trace: this.trace.slice(),
      groups: this.groups.slice(),
      contexts,
      state: this.state,
      resuming: this.resuming,
      reconnectAttempt: this.reconnectAttempt,
      lastProcessedSeq: this.buffer.lastProcessed,
      stats: { ...this.stats, queuedAhead: this.buffer.queuedCount },
    };
  }

  private setState(s: ConnectionState): void {
    this.state = s;
    this.opts.notify();
  }

  private notify(): void {
    this.opts.notify();
  }

  private send(msg: ClientMessage): void {
    if (this.transport && this.transport.readyState === 1) {
      this.transport.send(msg);
      this.stats.sent += 1;
    }
  }

  private handleOpen(): void {
    this.reconnectAttempt = 0;
    const last = this.buffer.lastProcessed;
    this.resuming = last > 0;
    this.setState("connected");
    if (this.resuming) {
      this.pushTrace("RESUME", last, `Resuming after reconnect (last processed seq ${last})`);
      this.send({ type: "RESUME", last_seq: last });
    }
  }

  private handleClose(code: number, reason: string): void {
    if (this.disposed || this.suppressReconnect) return;
    this.clearGapTimer();
    this.reconnectAttempt += 1;
    this.pushTrace("RECONNECT", 0, `Connection lost (${code}${reason ? `: ${reason}` : ""})`);

    const maxAttempts = this.opts.maxReconnectAttempts ?? 8;
    if (maxAttempts > 0 && this.reconnectAttempt >= maxAttempts) {
      this.pushTrace(
        "ERROR",
        0,
        `Gave up after ${this.reconnectAttempt} attempts — click "reconnect" to retry`,
      );
      this.setState("closed");
      return;
    }

    this.setState("reconnecting");
    const base = this.opts.baseBackoffMs ?? 500;
    const max = this.opts.maxBackoffMs ?? 8000;
    const backoff = Math.min(max, base * 2 ** (this.reconnectAttempt - 1));
    this.reconnectTimer = setTimeout(() => {
      if (!this.disposed) this.connect();
    }, backoff);
  }

  private handleRaw(data: string): void {
    this.stats.received += 1;
    this.stats.bytes += data.length;
    let raw: unknown;
    try {
      raw = JSON.parse(data);
    } catch {
      this.pushTrace("ERROR", 0, "Malformed JSON payload");
      this.notify();
      return;
    }
    if (typeof raw !== "object" || raw === null) {
      this.pushTrace("ERROR", 0, "Non-object payload");
      this.notify();
      return;
    }
    const ev = raw as Partial<ServerEvent>;
    if (typeof ev.seq !== "number" || typeof ev.type !== "string") {
      this.pushTrace("ERROR", 0, "Invalid event envelope (missing seq/type)");
      this.notify();
      return;
    }
    const parsed = ev as ServerEvent;
    const event: ServerEvent =
      typeof parsed.ts === "number" ? parsed : { ...parsed, ts: Date.now() };
    this.latestSeenSeq = Math.max(this.latestSeenSeq, event.seq);
    if (event.type === "PING") {
      this.stats.pings += 1;
      const echo = typeof event.challenge === "string" ? event.challenge : "";
      this.send({ type: "PONG", echo });
      this.stats.pongs += 1;
      this.pushTrace("PONG", event.seq, echo === "" ? "(empty echo)" : `echo=${echo}`);
    }
    const batch = this.buffer.feed(event);
    for (const e of batch) this.apply(e);
    this.armGapWatchdog();
    this.notify();
  }

  private armGapWatchdog(): void {
    this.clearGapTimer();
    if (this.state !== "connected") return;
    const seen = this.latestSeenSeq;
    const processed = this.buffer.lastProcessed;
    if (seen <= processed) return;
    const delay = this.opts.gapRecoveryMs ?? 1500;
    this.gapTimer = setTimeout(() => {
      if (this.disposed || this.state !== "connected") return;
      if (this.latestSeenSeq > this.buffer.lastProcessed) {
        this.stats.resets += 1;
        this.pushTrace(
          "ERROR",
          0,
          `Sequence gap: saw ${this.latestSeenSeq}, processed ${this.buffer.lastProcessed} — forcing reconnect for replay`,
        );
        try {
          this.transport?.close(4002);
        } catch {
          /* noop */
        }
      }
    }, delay);
  }

  private clearGapTimer(): void {
    if (this.gapTimer) {
      clearTimeout(this.gapTimer);
      this.gapTimer = null;
    }
  }

  private clearTimers(): void {
    this.clearGapTimer();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private pushTrace(kind: TraceRow["kind"], seq: number, detail?: string, extra?: Partial<TraceRow>): void {
    this.trace.push({
      id: `t-${this.trace.length}-${Date.now()}`,
      kind,
      seq,
      time: Date.now(),
      detail,
      ...extra,
    });
    if (this.trace.length > (this.opts.maxTraceRows ?? TRACE_CAP)) {
      this.trace.splice(0, this.trace.length - (this.opts.maxTraceRows ?? TRACE_CAP));
    }
  }

  private finalizeTokenGroup(streamId: string, endTime: number): void {
    const buf = this.tokenBuffers.get(streamId);
    if (!buf) return;
    this.groups.push({
      id: `g-${this.groups.length}-${streamId}`,
      streamId,
      firstSeq: buf.firstSeq,
      lastSeq: buf.lastSeq,
      count: buf.text.length,
      startTime: buf.start,
      endTime,
      text: buf.text,
    });
    this.tokenBuffers.delete(streamId);
  }

  private apply(e: ServerEvent): void {
    switch (e.type) {
      case "TOKEN": {
        const entry = this.entryFor(e.stream_id);
        let buf = this.tokenBuffers.get(e.stream_id);
        if (!buf) {
          buf = { text: "", firstSeq: e.seq, lastSeq: e.seq, start: now(e) };
          this.tokenBuffers.set(e.stream_id, buf);
        }
        buf.text += typeof e.text === "string" ? e.text : "";
        buf.lastSeq = e.seq;
        entry.text += typeof e.text === "string" ? e.text : "";
        entry.status = "streaming";
        this.pushTrace("TOKEN", e.seq, `${(typeof e.text === "string" ? e.text : "").length} chars`, {
          streamId: e.stream_id,
        });
        break;
      }
      case "TOOL_CALL": {
        const entry = this.entryFor(e.stream_id);
        entry.status = "waiting_tool";
        this.finalizeTokenGroup(e.stream_id, now(e));
        const inst: ToolInstance = {
          call_id: e.call_id,
          tool_name: e.tool_name,
          args: e.args,
          state: "pending",
          seq: e.seq,
          stream_id: e.stream_id,
        };
        entry.tools.push(inst);
        this.openTools.set(e.call_id, inst);
        this.pushTrace("TOOL_CALL", e.seq, `${e.tool_name} (${e.call_id})`, {
          callId: e.call_id,
          streamId: e.stream_id,
        });
        this.send({ type: "TOOL_ACK", call_id: e.call_id });
        break;
      }
      case "TOOL_RESULT": {
        const inst = this.openTools.get(e.call_id);
        if (inst) {
          inst.result = e.result;
          inst.state = "done";
          this.openTools.delete(e.call_id);
          const entry = this.chat.find((c) => c.streamId === e.stream_id);
          if (entry && !entry.tools.some((t) => t.state === "pending")) {
            entry.status = "streaming";
          }
        }
        this.pushTrace("TOOL_RESULT", e.seq, `${e.call_id} resolved`, {
          callId: e.call_id,
          streamId: e.stream_id,
        });
        break;
      }
      case "CONTEXT_SNAPSHOT": {
        const list = this.contexts[e.context_id] ?? [];
        list.push(e);
        this.contexts[e.context_id] = list;
        this.pushTrace("CONTEXT_SNAPSHOT", e.seq, `${e.context_id} (snapshot #${list.length})`, {
          streamId: e.context_id,
        });
        break;
      }
      case "STREAM_END": {
        this.finalizeTokenGroup(e.stream_id, now(e));
        const entry = this.chat.find((c) => c.streamId === e.stream_id);
        if (entry) {
          if (entry.tools.some((t) => t.state === "pending")) entry.status = "waiting_tool";
          else entry.status = "complete";
        }
        this.pushTrace("STREAM_END", e.seq, `stream ${e.stream_id} ended`, { streamId: e.stream_id });
        break;
      }
      case "ERROR": {
        const entry = this.chat.find((c) => c.streamId === e.stream_id);
        if (entry && entry.status === "streaming") {
          entry.text += `\n[error: ${e.message}]`;
          entry.status = "complete";
        }
        this.pushTrace("ERROR", e.seq, `${e.code}: ${e.message}`, { streamId: e.stream_id });
        break;
      }
      case "PING": {
        this.pushTrace("PING", e.seq, "heartbeat", { streamId: undefined });
        break;
      }
    }
  }

  private entryFor(streamId: string): ChatEntry {
    let entry = this.chat.find((c) => c.streamId === streamId);
    if (!entry) {
      entry = {
        id: `agent-${streamId}`,
        role: "agent",
        text: "",
        streamId,
        status: "streaming",
        tools: [],
      };
      this.chat.push(entry);
    }
    return entry;
  }
}

function now(e: { ts?: number }): number {
  return typeof e.ts === "number" ? e.ts : Date.now();
}
