# Submission Email — Alchemyst Agent Console

**Subject:** Agent Console Selection Task — Submission (Athmabhiram)

---

Hi Alchemyst team,

Please find my submission for the **Agent Console** selection task.

**GitHub repository:** `<paste your repo URL here>`

## Project summary

I built a hardened, real-time WebSocket console for observing and interacting with an AI agent. It streams tokens progressively, freezes tool calls into immutable expandable cards, shows a live trace timeline, and inspects the agent's context window with a client-side JSON diff.

The protocol engine (pure TypeScript, 22 passing unit tests) handles **strict sequence ordering, deduplication, and gap recovery**. On connection loss it reconnects automatically with exponential backoff and sends `RESUME last_seq` so the server replays the tail of the stream — **streaming continues seamlessly with no duplicated tokens**.

To prove it, I included a **chaos-testing mock server** that force-drops connections every third message, reorders and duplicates events, and injects malformed payloads. Screenshots and a 2-minute demo guide are in **README.md**, **DEMO.md**, and `docs/screenshots/`.

`npm run build` and `npm run test` both pass.

Thank you for your time — I'm happy to walk through it live.

Best regards,
Athmabhiram