export type ServerEventType =
  | "TOKEN"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "CONTEXT_SNAPSHOT"
  | "PING"
  | "STREAM_END"
  | "ERROR";

export interface BaseEvent {
  type: ServerEventType;
  seq: number;
  ts: number;
}

export interface TokenEvent extends BaseEvent {
  type: "TOKEN";
  text: string;
  stream_id: string;
}

export interface ToolCallEvent extends BaseEvent {
  type: "TOOL_CALL";
  call_id: string;
  tool_name: string;
  args: JsonValue;
  stream_id: string;
}

export interface ToolResultEvent extends BaseEvent {
  type: "TOOL_RESULT";
  call_id: string;
  result: JsonValue;
  stream_id: string;
}

export interface ContextSnapshotEvent extends BaseEvent {
  type: "CONTEXT_SNAPSHOT";
  context_id: string;
  data: JsonValue;
}

export interface PingEvent extends BaseEvent {
  type: "PING";
  challenge: string;
}

export interface StreamEndEvent extends BaseEvent {
  type: "STREAM_END";
  stream_id: string;
}

export interface ServerErrorEvent extends BaseEvent {
  type: "ERROR";
  code: string;
  message: string;
  stream_id?: string;
}

export type ServerEvent =
  | TokenEvent
  | ToolCallEvent
  | ToolResultEvent
  | ContextSnapshotEvent
  | PingEvent
  | StreamEndEvent
  | ServerErrorEvent;

export type ClientMessage =
  | { type: "USER_MESSAGE"; content: string }
  | { type: "PONG"; echo: string }
  | { type: "RESUME"; last_seq: number }
  | { type: "TOOL_ACK"; call_id: string };

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "closed";

export interface ConnectionStats {
  received: number;
  bytes: number;
  pings: number;
  pongs: number;
  resets: number;
  sent: number;
  queuedAhead: number;
}

export interface ToolInstance {
  call_id: string;
  tool_name: string;
  args: JsonValue;
  result?: JsonValue;
  state: "pending" | "done" | "failed";
  seq: number;
  stream_id: string;
}

export interface ChatEntry {
  id: string;
  role: "user" | "agent";
  text: string;
  streamId?: string;
  status: "streaming" | "waiting_tool" | "complete";
  tools: ToolInstance[];
}

export type TraceKind =
  | "TOKEN"
  | "TOOL_CALL"
  | "TOOL_RESULT"
  | "CONTEXT_SNAPSHOT"
  | "PING"
  | "PONG"
  | "STREAM_END"
  | "ERROR"
  | "RESUME"
  | "RECONNECT";

export interface TraceRow {
  id: string;
  kind: TraceKind;
  seq: number;
  time: number;
  detail?: string;
  callId?: string;
  streamId?: string;
}

export interface TokenGroup {
  id: string;
  streamId: string;
  firstSeq: number;
  lastSeq: number;
  count: number;
  startTime: number;
  endTime: number;
  text: string;
}