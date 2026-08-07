"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AgentEngine, type EngineSnapshot } from "@/lib/engine";
import type { ClientMessage } from "@/lib/types";
import type { Transport } from "@/lib/engine";

export class BrowserWsTransport implements Transport {
  private ws: WebSocket;

  onOpen: (() => void) | null = null;
  onMessage: ((data: string) => void) | null = null;
  onClose: ((code: number, reason: string) => void) | null = null;
  onError: (() => void) | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onopen = () => this.onOpen?.();
    this.ws.onmessage = (e) => {
      const data = typeof e.data === "string" ? e.data : String(e.data);
      this.onMessage?.(data);
    };
    this.ws.onclose = (e) => this.onClose?.(e.code, e.reason);
    this.ws.onerror = () => this.onError?.();
  }

  get readyState(): number {
    return this.ws.readyState;
  }

  send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  sendRaw(payload: string): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    }
  }

  close(code = 1000): void {
    try {
      this.ws.close(code);
    } catch {
      /* noop */
    }
  }
}

export interface AgentControls {
  snap: EngineSnapshot | null;
  send: (text: string) => void;
  reconnect: () => void;
}

export function useAgent(url: string): AgentControls {
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const engineRef = useRef<AgentEngine | null>(null);

  useEffect(() => {
    const engine = new AgentEngine(() => new BrowserWsTransport(url), {
      notify: () => setSnap(engine.snapshot()),
    });
    engineRef.current = engine;
    engine.connect();
    return () => {
      engine.disconnect();
      engineRef.current = null;
    };
  }, [url]);

  const send = useCallback((text: string) => {
    engineRef.current?.sendUserMessage(text);
  }, []);

  const reconnect = useCallback(() => {
    engineRef.current?.reconnect();
  }, []);

  return { snap, send, reconnect };
}