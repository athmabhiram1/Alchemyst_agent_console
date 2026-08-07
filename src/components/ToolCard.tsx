"use client";

import { useState } from "react";
import type { ToolInstance } from "@/lib/types";
import { pretty } from "@/lib/format";

export function ToolCard({ tool }: { tool: ToolInstance }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`tool-card ${tool.state === "pending" ? "tool-pending" : ""}`}>
      <div className="tool-head" onClick={() => setOpen(!open)}>
        <span className="tool-icon">⚒</span>
        <span className="tool-name mono">{tool.tool_name}</span>
        <span className="tool-id mono">{tool.call_id.slice(0, 12)}</span>
        <span className={`chip ${tool.state === "pending" ? "chip-amber" : "chip-green"}`}>
          {tool.state === "pending" ? "awaiting result" : "done"}
        </span>
        <span className="tool-chev">{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div className="tool-body">
          <div className="tool-block">
            <span className="tool-label">args</span>
            <pre className="json mono">{JSON.stringify(tool.args, null, 2)}</pre>
          </div>
          {tool.state === "done" && (
            <div className="tool-block">
              <span className="tool-label">result</span>
              <pre className="json mono">{pretty(tool.result)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}