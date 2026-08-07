# DECISIONS.md — Agent Console

Engineering decisions behind the Agent Console, recorded as **Context → Decision → Consequence**.

---

## 1. Sequence buffering for all server events

**Context:** WebSockets deliver in order over a single live connection, but during a reconnect + replay the server sends a mix of already-processed and new events. A client that applies events as they arrive can double-render tokens and corrupt ordering.

**Decision:** Every server event passes through a `SeqBuffer<T>` before being applied. Out-of-order events are held in a `Map<seq, event>` and drained strictly by sequence; duplicates (`seq` already processed or buffered) are dropped. A 1.5 s gap watchdog forces a reconnect (code 4002) if a gap never fills, so the client never stalls silently on a missed event.

**Consequence:** Correct ordering and zero duplicate application under chaos, at the cost of holding out-of-order events for up to 1.5 s. One monotone-sequence assumption is now a hard protocol contract.

---

## 2. Client-driven reconnect + resume

**Context:** When a socket drops mid-stream, the client must recover the exact continuation. The server can't reliably know what each client has already seen unless the client tells it.

**Decision:** Reconnect is entirely client-driven with exponential backoff. On a successful reconnection after prior traffic, the client sends `{ type: "RESUME", last_seq: N }`; the server replays events `> N`, and the client's `SeqBuffer` drops the overlap. The client only tracks one number (`lastProcessedSeq`). If the server ignores `RESUME`, the client degrades gracefully to a cold reconnect.

**Consequence:** A stateless, simple client contract and clean observer semantics — at the price of requiring the server to keep a (bounded) replay log.

---

## 3. Tool cards become immutable after completion

**Decision:** A tool call freezes the response mid-stream into a card showing `args`. On `TOOL_RESULT`, the card records and displays the `result`, flips to `done`, and is never mutated again — the response stream must not resume through it.

**Consequence:** Obvious, auditable tool boundaries in the UI (users can see exactly what ran, when). The trade-off is that retries or late-updating tools cannot revise a finished card without re-rendering the stream.

---

## 4. Bounded traces

**Context:** The trace timeline can grow unboundedly over a long session (every token, ping, tool call, snapshot).

**Decision:** The trace is capped at 1,500 rows (configurable via `EngineOptions.maxTraceRows`), evicting oldest-first, and rendered with a manual viewport-based virtualization (absolute-positioned rows inside a fixed-height sentinel) with no third-party virtualization library.

**Consequence:** Bounded memory and smooth rendering even in very long sessions; only the newest events are kept, which matches an operational "tail the live stream" mental model.

---

## 5. Client-side JSON diffing

**Decision:** Context diffs run in the browser with a hand-written recursive `diffJson` (DFS, positional arrays) — no server support, no Myers/LCS library.

**Consequence:** Zero network round-trips for an interactive scrubber and instant "diff vs previous" feedback. Positional array comparison is not perfectly minimal (a mid-array insert reads as `changed` at later indices), which is acceptable for small agent-context objects.

---

## 6. Ignoring malformed payloads instead of crashing

**Decision:** In `handleRaw`, anything that fails `JSON.parse`, is a non-object, or lacks `seq`/`type` is recorded in the trace as an `ERROR` event and skipped — the engine stays alive and processes the next valid event.

**Consequence:** Resilience to a noisy/compromised server (which the chaos mock deliberately exercises) without a try/catch cascade or a UI crash. The only cost is a trace marker so the incident is still visible to an operator.

---

## 7. Exponential backoff

**Context:** A flapping server must not trigger a reconnect storm, but a transient blip should recover fast.

**Decision:** `backoff = min(8000, 500 × 2^(attempt−1))` → 500 ms, 1 s, 2 s, 4 s, 8 s, then capped. Both the base and cap (plus a give-up attempt limit) are configurable through `EngineOptions` for tests. A prior nested-`Math.min` bug that collapsed all backoffs to the base was caught and fixed before ship.

**Consequence:** Responsive first retry, bounded thundering-herd risk, and a deterministic, testable schedule.

---

## 8. What was intentionally left out

**Decision (non-goals for this task):** No human-in-the-loop tool approval (tool calls are auto-`TOOL_ACK`ed by the engine — the console observes, it doesn't execute). No server-side persistence of the replay log (the demo mock keeps an in-memory log). No auth, TLS, or multi-user session isolation. No external component/virtualization libraries. No `react-window`, no CSS-in-JS, no RSC streaming.

**Consequence:** A lean, dependency-free, audit-focused console that fully meets the brief. These exclusions are the primary candidates for future work (see README → Future improvements).

---

## Supporting decisions

- **State machine outside React:** `AgentEngine` is pure TS behind a `Transport` interface — fully unit-testable in Node (all 9 engine tests run in <30 ms). React consumes immutable snapshots.
- **Immutable snapshots:** `snapshot()` returns copies of the mutable collections so React's `useMemo`/derivations observe every update (an earlier in-place-mutation bug froze the trace timeline; fixed by copying in `snapshot()`).
- **`"use client"` everywhere:** the page is a live WebSocket console, so there is nothing meaningful to server-render; this also eliminates hydration mismatches from `Date.now()` / `WebSocket`.
- **Single flat `globals.css`:** token-driven with BEM-adjacent names — lowest-friction for a small app, at the cost of manual class-collision management.