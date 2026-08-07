"use client";

import { useAgent } from "@/hooks/useAgent";
import { StatusHeader } from "@/components/StatusHeader";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { ChatPanel } from "@/components/ChatPanel";
import { TraceTimeline } from "@/components/TraceTimeline";
import { ContextInspector } from "@/components/ContextInspector";

const DEFAULT_WS = "ws://localhost:8765";

export default function Home() {
  const url =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_AGENT_WS_URL ?? DEFAULT_WS)
      : DEFAULT_WS;
  const { snap, send, reconnect } = useAgent(url);

  return (
    <div className="app">
      <StatusHeader
        url={url}
        state={snap?.state ?? "idle"}
        stats={
          snap?.stats ?? { received: 0, bytes: 0, pings: 0, pongs: 0, resets: 0, sent: 0, queuedAhead: 0 }
        }
        lastSeq={snap?.lastProcessedSeq ?? 0}
      />
      <ReconnectBanner
        state={snap?.state ?? "idle"}
        attempt={snap?.reconnectAttempt ?? 0}
        resumeFrom={snap?.lastProcessedSeq ?? 0}
        onReconnect={reconnect}
      />
      <main className="main">
        <ChatPanel entries={snap?.chat ?? []} state={snap?.state ?? "idle"} onSend={send} />
        <div className="side">
          <TraceTimeline rows={snap?.trace ?? []} />
          <ContextInspector contexts={snap?.contexts ?? {}} />
        </div>
      </main>
    </div>
  );
}