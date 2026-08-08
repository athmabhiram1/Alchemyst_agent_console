# Video Script — Agent Console Demo (3–4 minutes)

Record with a screen recorder (OBS, Loom, or QuickTime). Show the browser at `http://localhost:3000`. Optional: a small window or corner-cam of you talking.

## Setup (30 s, can be cut)
- Terminal 1: `npm run dev`
- Terminal 2: `node mock-agent/server.js`
- Browser open to http://localhost:3000 — header shows **connected**.

> "Hi, I'm Athmabhiram. This is my Agent Console submission — a real-time console for observing and talking to an AI agent, built to survive a flaky network."

---

## Scene 1 — Streaming chat (40 s)
Send: `Hello agent`

> "Watch the reply stream in token-by-token. Every event carries a sequence number, and the engine renders them strictly in order."

Show the header stats ticking (seq / evt / bytes).

---

## Scene 2 — Tool call card (40 s)
Send: `Explain reconnect logic`

> "A tool call just froze mid-stream into a card — `knowledge_search` with its arguments. When the tool resolves, the card flips to done and shows the result. The card is immutable once complete."

---

## Scene 3 — Trace + context inspector (30 s)
Click the Agent Trace panel; filter by kind. Open the Context Inspector, expand the JSON, toggle **diff vs previous**.

> "Every message produces a context snapshot. I can scrub through them and diff any two snapshots client-side."

---

## Scene 4 — Chaos recovery (the money shot, 50 s)
Send a third message, e.g. `Trigger another response`. The mock server force-drops the connection mid-stream.

> "Now watch the important part. The connection just died mid-reply — the header flips to reconnecting, and the amber banner appears."

Point at the mock server terminal:

> "On reconnect the client sends `RESUME last_seq` and the server replays the missed events. The reply continues streaming to completion, exactly once — no lost tokens, no duplicates."

Show the banner disappear and the header return to **connected**.

---

## Close (15 s)
> "`npm run build` and 22 unit tests pass. The repo, chaos server, and demo guide are all in the GitHub link. Thanks for watching — happy to walk through the code live."

---

## Recording tips
- If you're nervous, record the screen first, then voice-over after.
- Re-record just Scene 4 if the chaos timing looks off; it's the strongest proof.
- Keep it under 4 minutes. No need for fancy editing.
- Upload to a private/unlisted **YouTube** or **Google Drive** link and add one line to the email: *"Demo video: <link>"* (or attach the file).
