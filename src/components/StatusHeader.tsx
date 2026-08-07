"use client";

import { useEffect, useState } from "react";
import type { ConnectionState, ConnectionStats } from "@/lib/types";
import { fmtBytes, fmtTime } from "@/lib/format";

const STATE_COLOR: Record<ConnectionState, string> = {
  idle: "chip-gray",
  connecting: "chip-amber",
  connected: "chip-green",
  reconnecting: "chip-red",
  closed: "chip-gray",
};

export function StatusHeader({
  url,
  state,
  stats,
  lastSeq,
}: {
  url: string;
  state: ConnectionState;
  stats: ConnectionStats;
  lastSeq: number;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <span className="logo">Agent Console</span>
        <span className="url mono">{url}</span>
      </div>
      <div className="header-right">
        <span className={`chip ${STATE_COLOR[state]}`}>{state}</span>
        <span className="stat mono">seq {lastSeq}</span>
        <span className="stat mono">{stats.received} evt</span>
        <span className="stat mono">{fmtBytes(stats.bytes)}</span>
        <span className="stat mono">ping {stats.pings} / pong {stats.pongs}</span>
        {stats.resets > 0 && <span className="stat mono chip-red">recovered {stats.resets}</span>}
        {stats.queuedAhead > 0 && <span className="stat mono chip-amber">buffered {stats.queuedAhead}</span>}
        {now !== null && <span className="clock mono">{fmtTime(now)}</span>}
      </div>
    </header>
  );
}