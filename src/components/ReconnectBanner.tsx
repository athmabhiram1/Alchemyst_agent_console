"use client";

import type { ConnectionState } from "@/lib/types";

export function ReconnectBanner({
  state,
  attempt,
  resumeFrom,
  onReconnect,
}: {
  state: ConnectionState;
  attempt: number;
  resumeFrom: number;
  onReconnect: () => void;
}) {
  // Show during active reconnect attempts
  if (state === "reconnecting") {
    return (
      <div className="banner banner-reconnecting">
        <span>
          Connection lost — reconnecting (attempt {attempt})
          {resumeFrom > 0 && (
            <span className="mono"> · will resume from seq {resumeFrom}</span>
          )}
        </span>
        <button className="btn-small" onClick={onReconnect}>
          retry now
        </button>
      </div>
    );
  }

  // Show when engine gave up after hitting the max attempts
  if (state === "closed" && attempt > 0) {
    return (
      <div className="banner banner-closed">
        <span>
          Server unreachable — gave up after {attempt} attempt{attempt !== 1 ? "s" : ""}.
          <span className="banner-hint"> Start the agent then click retry.</span>
        </span>
        <button className="btn-small" onClick={onReconnect}>
          retry
        </button>
      </div>
    );
  }

  return null;
}