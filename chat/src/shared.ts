import { shortHandle, type MessageView } from "../shared/types.ts";

const STORAGE_KEY = "chat.userId";
const ID_RE = /^[\w-]{8,64}$/;

export function getOrCreateUserId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing && ID_RE.test(existing)) return existing;
  const fresh = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, fresh);
  return fresh;
}

export function handleOf(userId: string): string {
  return shortHandle(userId);
}

export async function postJson<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T | { error?: string } }> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T | { error?: string };
  return { ok: res.ok, status: res.status, data };
}

export type EventHandlers = {
  onSnapshot?: (data: { palette: ReadonlyArray<string>; messages: ReadonlyArray<MessageView> }) => void;
  onMessage?: (msg: MessageView) => void;
  onReaction?: (data: { msgId: string; reactions: Record<string, number>; myReaction?: string }) => void;
  onDelete?: (msgId: string) => void;
  onStatusChange?: (s: "connecting" | "connected" | "reconnecting") => void;
};

export function connectSse(url: string, h: EventHandlers): EventSource {
  h.onStatusChange?.("connecting");
  const es = new EventSource(url);
  es.addEventListener("snapshot", (e) => h.onSnapshot?.(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("message", (e) => h.onMessage?.(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("reaction", (e) => h.onReaction?.(JSON.parse((e as MessageEvent).data)));
  es.addEventListener("delete", (e) => {
    const { msgId } = JSON.parse((e as MessageEvent).data) as { msgId: string };
    h.onDelete?.(msgId);
  });
  es.addEventListener("open", () => h.onStatusChange?.("connected"));
  es.addEventListener("error", () => h.onStatusChange?.("reconnecting"));
  return es;
}
