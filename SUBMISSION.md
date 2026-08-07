# Alchemyst AI — Agent Console Submission

**Subject:** Agent Console Submission — Athmabhiram

---

Hi Alchemyst team,

Please find below my submission for the Agent Console challenge.

---

## What I Built

**Agent Console** — a hardened, real-time frontend for observing and interacting with an AI agent over WebSocket.

🔗 **Repo:** `C:\Users\athma\agent-console` (or attached as a zip)  
🔗 **Challenge Reference:** https://opncd.ai/share/3R6i6w1u

---

## Core Deliverables

| Deliverable | Status |
|---|---|
| Next.js 15 + TypeScript app | ✅ |
| Protocol state machine (`SeqBuffer`, `AgentEngine`, types) | ✅ |
| Unit tests — 22 passing (engine / seq / diff) | ✅ |
| Chat UI — streaming tokens + frozen tool-call cards | ✅ |
| Live trace timeline — virtualized, filterable | ✅ |
| Context inspector — snapshots + JSON diff + scrubber | ✅ |
| Reconnect banner + connection stats header | ✅ |
| `npm run build` — clean exit 0, no type errors | ✅ |
| README + DECISIONS.md | ✅ |

---

## Technical Highlights

### 1. Sequence-ordered delivery with gap recovery
All server events pass through `SeqBuffer<T>` — a monotone sequence buffer that holds out-of-order events and drops duplicates. A 1.5 s gap watchdog forces a reconnect (code 4002) if a gap never fills, triggering a server replay. The client then drops already-processed seqs again via the buffer. End-to-end: **zero missed events, zero double-applies**.

### 2. Resume protocol
On reconnect, the client sends `{ type: "RESUME", last_seq: N }`. The server can replay from N+1. This is a clean, stateless protocol — the client only needs to track one number.

### 3. Exponential backoff (fixed bug)
Backoff: `min(8000ms, 500ms × 2^attempt)`. A prior version had a nested `Math.min` bug that collapsed all backoffs to 500 ms — caught and fixed before ship.

### 4. Pure-TS engine, zero DOM dependency in tests
`AgentEngine` takes a `Transport` interface. Tests inject a `MockTransport` and drive the entire protocol without a browser or Next.js. All 9 engine tests run in < 30 ms.

### 5. Virtualized trace timeline — no react-window
Manual `scrollTop`-based slice of a 1 500-row capped array, with absolute-positioned rows. Zero extra dependencies.

---

## Running It

```bash
cd agent-console
npm install
NEXT_PUBLIC_AGENT_WS_URL=ws://your-agent:8765 npm run dev
# → http://localhost:3000
```

Run tests:
```bash
npm test
# 22 tests, 3 files, all passing
```

---

## Architecture Decision Record

See [`DECISIONS.md`](./DECISIONS.md) for 10 documented decisions with rationale and trade-offs.

---

Looking forward to your feedback!

**Athmabhiram**
