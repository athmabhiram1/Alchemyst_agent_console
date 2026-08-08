# Submission Email — Alchemyst AI (Agent Console Task)

> **Send from:** athmabhiram@gmail.com
> **To:** anuran@getalchemystai.com
> **Cc:** vedanta@getalchemystai.com, khushi@getalchemystai.com
> **Subject:** Alchemyst Full-Stack AI Intern — Agent Console Submission — Athmabhiram

---

Hi Alchemyst team,

I've completed the **Agent Console** selection task and would like to submit my work for the Full-Stack AI Intern role.

**GitHub repository:** https://github.com/athmabhiram1/Alchemyst_agent_console.git

## What I built

A hardened, real-time WebSocket console for observing and interacting with an AI agent, built with **Next.js 15 + React 19 + TypeScript (strict)**:

- **Streaming chat** — tokens render progressively with a cursor, plus a composer to talk to the agent.
- **Frozen tool-call cards** — a tool call freezes mid-stream into an expandable, immutable card showing `args` + `result`.
- **Live trace timeline** — virtualized, filterable event log of every `TOKEN`, `TOOL_CALL`, `CONTEXT_SNAPSHOT`, `PING`/`PONG`, etc.
- **Context inspector** — snapshot scrubber with a JSON tree and a client-side diff-vs-previous view.

The protocol layer is a pure-TypeScript `AgentEngine` (22 passing unit tests) that handles **strict sequence ordering, deduplication, and gap recovery**. When the connection drops, it reconnects with exponential backoff and sends `RESUME last_seq` so the server replays the tail — streaming continues with **zero lost and zero duplicated tokens**.

To prove it survives real-world flakiness, I shipped a **chaos-testing mock server** that force-drops connections, reorders and duplicates events, and injects malformed payloads. Screenshots and a 2-minute reproduction guide are in the repo (`README.md`, `DEMO.md`, `docs/screenshots/`).

`npm run build` and `npm run test` both pass cleanly.

## About me

I'm a 3rd-year B.Tech (AI & ML) student at BMS Institute of Technology, Bengaluru. I'm available full-time and can start immediately. Happy to walk you through the code and the chaos-recovery flow live.

Thank you for your time — I look forward to your feedback.

Best regards,
**Athmabhiram S J**
athmabhiram@gmail.com | +91 8618166656
Bengaluru, India

---
## Checklist before sending

1. Push the latest code to the GitHub repo (done).
2. Verify the repo link opens publicly.
3. Attach `agent-console-alchemyst-submission.zip` (optional, but recommended as a backup).
4. Send from **athmabhiram@gmail.com**.
5. Optional: record the video from `VIDEO_SCRIPT.md` and add it as a second email or a YouTube/Drive link.
