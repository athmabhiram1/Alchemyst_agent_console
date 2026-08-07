// Mock agent server that speaks the protocol the client expects.
// Not part of the deliverable — used to smoke-test the Agent Console client
// against a live socket with injected chaos (reorder, duplicates, drops,
// forced disconnect + RESUME replay, malformed payloads).
//
// Session model:
//   * A connection that sends RESUME is a reconnecting client -> we keep the
//     shared log and replay anything after its last_seq so the stream resumes
//     exactly where it stopped (SeqBuffer dedups the overlap).
//   * A connection that sends its first message WITHOUT a RESUME is a fresh
//     page/session -> we reset the shared state so its sequence restarts at 1.
//   * Heartbeats only start after a session is classified, so seq numbering
//     stays contiguous for the one active client.
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 8765);

const state = { seq: 0, ctxCounter: 0, msg: 0, log: [] };

function resetState() {
  state.seq = 0;
  state.ctxCounter = 0;
  state.msg = 0;
  state.log = [];
}

const wss = new WebSocketServer({ port: PORT });

function ev(type, extra = {}) {
  const e = { type, seq: ++state.seq, ts: Date.now(), ...extra };
  state.log.push(e);
  return e;
}

function sendRaw(ws, payload) {
  if (ws.readyState === ws.OPEN) ws.send(payload);
}

// Deliver events one-by-one with a small delay so tokens visibly stream in.
// Occasionally shuffle a pair and duplicate one event to force the client's
// sequence buffer (dedup + reorder) to actually do work.
function emitDeliver(ws, events) {
  if (events.length >= 3 && Math.random() < 0.6) {
    const a = 1 + Math.floor(Math.random() * (events.length - 2));
    [events[a], events[a + 1]] = [events[a + 1], events[a]];
  }
  if (events.length >= 4 && Math.random() < 0.4) {
    const k = Math.floor(Math.random() * (events.length - 1));
    sendRaw(ws, JSON.stringify(events[k])); // duplicate, same seq -> dropped client-side
  }
  events.forEach((e, i) => setTimeout(() => sendRaw(ws, JSON.stringify(e)), 60 * (i + 1)));
}

function buildReply(userText) {
  const n = ++state.ctxCounter;
  const call_id = `call_${Math.random().toString(16).slice(2, 10)}`;
  const streamId = "s" + n;
  const first = ev("CONTEXT_SNAPSHOT", {
    context_id: `ctx_${n}`,
    data: {
      user: userText,
      recent_turns: state.msg,
      memory: { last_intent: "analysis", tokens_reserved: 2000 },
      knowledge: ["web", "docs", "repos"],
    },
  });
  const chunks = ["Let me reason about that step by step. ", "First, I will ", "gather evidence, ", "then act."];
  const events = [first];
  chunks.forEach((c) => events.push(ev("TOKEN", { stream_id: streamId, text: c })));
  events.push(ev("TOOL_CALL", { stream_id: streamId, call_id, tool_name: "knowledge_search", args: { q: userText, top_k: 5 } }));
  events.push(ev("TOOL_RESULT", { stream_id: streamId, call_id, result: { hits: 5, top: ["OpenAgents", "LangGraph", "CrewAI", "AutoGen", "A2A"] } }));
  events.push(ev("TOKEN", { stream_id: streamId, text: " Based on that, the agent should stay simple, deterministic and observable. " }));
  events.push(ev("STREAM_END", { stream_id: streamId }));
  return events;
}

function replay(ws, lastSeq) {
  const missed = state.log.filter((e) => e.seq > lastSeq);
  if (!missed.length) return;
  console.log(`[replay] resending ${missed.length} event(s) after seq ${lastSeq}`);
  missed.forEach((e, i) => setTimeout(() => sendRaw(ws, JSON.stringify(e)), 60 * (i + 1)));
}

wss.on("connection", (ws) => {
  console.log("[+] client connected");
  let resumed = false;
  let heartbeat = null;

  const startHeartbeat = () => {
    if (heartbeat) return;
    heartbeat = setInterval(() => {
      sendRaw(ws, JSON.stringify(ev("PING", { challenge: Math.random().toString(36).slice(2, 8) })));
    }, 2000);
  };

  ws.on("message", (raw) => {
    let m;
    try {
      m = JSON.parse(String(raw));
    } catch {
      return;
    }
    console.log("[<-]", m.type, JSON.stringify(m).slice(0, 90));

    if (m.type === "RESUME") {
      resumed = true;
      console.log("[RESUME] client resumes from last_seq =", m.last_seq);
      startHeartbeat();
      replay(ws, m.last_seq);
      return;
    }

    if (m.type === "USER_MESSAGE") {
      // A first-message that is NOT a RESUME means a fresh client/session.
      if (!resumed && state.seq > 0) {
        console.log("[fresh] resetting shared session for new client");
        resetState();
      }
      resumed = true; // lock this connection to the (possibly reset) session
      startHeartbeat();

      state.msg += 1;
      const events = buildReply(m.content || "");
      // occasionally inject a malformed payload and shuffle/duplicate
      if (state.msg % 4 === 0) sendRaw(ws, "{this is not json");
      emitDeliver(ws, events);
      // every 3rd message, drop the connection so the client must reconnect + RESUME
      if (state.msg % 3 === 0) {
        console.log("[chaos] forcing disconnect");
        setTimeout(() => ws.close(4001, "chaos-injected-close"), 120);
      }
      return;
    }

    // PONG etc.: ignore.
  });

  ws.on("close", (code, reason) => {
    if (heartbeat) clearInterval(heartbeat);
    console.log("[client closed]", code, String(reason));
  });
});

wss.on("listening", () => {
  console.log("mock agent ws listening on ws://localhost:" + PORT);
});