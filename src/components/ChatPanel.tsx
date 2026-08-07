"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatEntry, ConnectionState } from "@/lib/types";
import { ToolCard } from "./ToolCard";

export function ChatPanel({
  entries,
  state,
  onSend,
}: {
  entries: readonly ChatEntry[];
  state: ConnectionState;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, entries.length]);

  const submit = () => {
    if (!draft.trim() || state !== "connected") return;
    onSend(draft);
    setDraft("");
  };

  const connected = state === "connected";

  return (
    <section className="panel chat-panel">
      <div className="panel-title">Conversation</div>
      <div className="chat-scroll" ref={scroller}>
        {entries.length === 0 && (
          <div className="chat-empty">
            Type a message to start the agent. Watch tokens stream in, tool calls
            freeze mid-stream, and chaos recovery on the right.
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={`msg ${e.role === "user" ? "msg-user" : "msg-agent"}`}>
            {e.role === "user" ? (
              <div className="bubble bubble-user">{e.text}</div>
            ) : (
              <div className="bubble bubble-agent">
                {e.text ? (
                  <div className="msg-text">{e.text}</div>
                ) : (
                  <div className="msg-text dim">(no text yet)</div>
                )}
                {e.tools.map((t) => (
                  <ToolCard key={t.call_id} tool={t} />
                ))}
                {e.status === "streaming" && <span className="cursor" />}
                {e.status === "waiting_tool" && (
                  <span className="chip chip-amber">agent paused — tool call in flight</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="composer">
        <textarea
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" && !ev.shiftKey) {
              ev.preventDefault();
              submit();
            }
          }}
          placeholder={connected ? "Ask the agent…" : "Waiting for connection…"}
          disabled={!connected}
          rows={2}
        />
        <button className="btn" onClick={submit} disabled={!connected || !draft.trim()}>
          Send
        </button>
      </div>
    </section>
  );
}