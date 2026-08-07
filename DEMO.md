# DEMO — Agent Console in under 2 minutes

This guide reproduces the full demo (streaming chat, tool cards, context inspection, and chaos-driven reconnect/resume) with zero setup beyond `npm install`.

## Terminal 1 — App

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Terminal 2 — Mock chaos server

```bash
node mock-agent/server.js
# → mock agent ws listening on ws://localhost:8765
```

No other configuration needed — the app defaults to `ws://localhost:8765`.

## Browser

1. Open **http://localhost:3000**.
2. The header shows **connected**.
3. Send three messages, one at a time (wait for each reply to finish):

   ```
   Hello agent
   Explain reconnect logic
   Trigger another response
   ```

## What you should see

### Message 1 & 2
- Tokens **stream in progressively** (each reply is delivered at 60 ms intervals) with a blinking cursor.
- A **tool call card** appears mid-stream and freezes: `knowledge_search` with its `args`.
- The card flips to **done** and shows the **result** when the tool resolves.
- The **Agent Trace** timeline fills with `CONTEXT_SNAPSHOT`, `TOKEN`, `TOOL_CALL`, `TOOL_RESULT`, `STREAM_END`, `PING`/`PONG` rows (filterable by kind).
- The **Context Inspector** shows a new snapshot per message (`ctx_1`, `ctx_2`, …) — expand the JSON tree and try the **diff vs previous** toggle.

### Message 3 (the chaos turn)
The mock server **force-drops the connection 120 ms after the message is sent**, mid-stream. Watch:

- The header flips to **reconnecting** and an amber **reconnect banner** appears ("Connection lost — reconnecting (attempt 1) · will resume from seq N").
- Within ~0.5 s the client reconnects automatically and sends **`RESUME last_seq = N`** (visible in the mock server's terminal as `[<-] RESUME`).
- The server **replays the missed events** (terminal shows `[replay] resending … event(s)`), and the third reply **continues streaming to completion**.
- The reply text is **exactly once** — no duplicated tokens — and the banner disappears as the header returns to **connected**.

### Optional checks
- Header stats tick up (`seq`, `evt`, `bytes`, `ping`/`pong`).
- To force the chaos close yourself, any **3rd, 6th, 9th…** message triggers it; every **4th** message also injects a raw non-JSON payload (client logs it in the trace and keeps going).
