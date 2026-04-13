import "./styles.css";
import type { MessageView } from "../shared/types.ts";
import { connectSse, getOrCreateUserId, postJson } from "./shared.ts";

const userId = getOrCreateUserId();
const adminBase = location.pathname.replace(/\/$/, "");

const feed = document.getElementById("feed-admin")!;
const flog = document.getElementById("flog")!;
const status = document.getElementById("status")!;

const nodes = new Map<string, HTMLElement>();
const store = new Map<string, MessageView>();

function format(msg: MessageView): string {
  const rx = Object.entries(msg.reactions ?? {})
    .map(([e, n]) => `${e}\u00d7${n}`)
    .join(" ");
  const lines = [
    `[workshop-chat] @${msg.handle} (msg ${msg.id.slice(0, 8)}):`,
    `> ${msg.text}`,
  ];
  if (rx) lines.push(`reactions: ${rx}`);
  return lines.join("\n");
}

function render(msg: MessageView) {
  store.set(msg.id, msg);
  let el = nodes.get(msg.id);
  if (!el) {
    el = document.createElement("div");
    el.className = "msg";
    el.innerHTML = `
      <div class="hd"><b></b><span class="ts"></span></div>
      <div class="body"></div>
      <div class="rx"></div>
      <div class="actions">
        <button type="button" class="fwd">forward</button>
        <button type="button" class="del danger">delete</button>
      </div>`;
    nodes.set(msg.id, el);
    feed.appendChild(el);
    el.querySelector<HTMLButtonElement>(".fwd")!.addEventListener("click", (ev) =>
      forward(msg.id, ev.currentTarget as HTMLButtonElement),
    );
    el.querySelector<HTMLButtonElement>(".del")!.addEventListener("click", () => adminDelete(msg.id));
  }
  el.querySelector("b")!.textContent = "@" + msg.handle;
  el.querySelector<HTMLSpanElement>(".ts")!.textContent = new Date(msg.ts).toLocaleTimeString();
  el.querySelector<HTMLDivElement>(".body")!.textContent = msg.text;
  renderReactions(el, msg.reactions ?? {});
  feed.scrollTop = feed.scrollHeight;
}

function renderReactions(el: HTMLElement, counts: Record<string, number>) {
  const rx = el.querySelector<HTMLDivElement>(".rx")!;
  rx.innerHTML = "";
  for (const [emoji, count] of Object.entries(counts)) {
    if (!count) continue;
    const s = document.createElement("span");
    s.className = "static";
    s.textContent = `${emoji} ${count}`;
    rx.appendChild(s);
  }
}

function removeMessage(msgId: string) {
  const el = nodes.get(msgId);
  if (el) { el.remove(); nodes.delete(msgId); }
  store.delete(msgId);
}

async function adminDelete(msgId: string) {
  if (!confirm("delete this message for everyone?")) return;
  const r = await postJson<{ ok: boolean }>(adminBase + "/delete", { msgId });
  if (!r.ok) status.textContent = "delete failed: " + ((r.data as { error?: string }).error ?? r.status);
}

async function forward(msgId: string, btn: HTMLButtonElement) {
  const msg = store.get(msgId);
  if (!msg) return;
  const block = format(msg);
  let copied = false;
  try { await navigator.clipboard.writeText(block); copied = true; } catch { /* http clipboard may be blocked */ }
  appendForwarded(block, copied);
  await postJson(adminBase + "/log", { block });
  btn.classList.add("sent");
  btn.textContent = copied ? "copied ✓" : "sent ✓";
  setTimeout(() => { btn.classList.remove("sent"); btn.textContent = "forward"; }, 2500);
}

function appendForwarded(block: string, copied: boolean) {
  const entry = document.createElement("div");
  entry.className = "fentry";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = new Date().toLocaleTimeString() + (copied ? " — clipboard + stdout" : " — stdout");
  const pre = document.createElement("pre");
  pre.className = "block";
  pre.textContent = block;
  entry.appendChild(meta);
  entry.appendChild(pre);
  flog.appendChild(entry);
  flog.scrollTop = flog.scrollHeight;
}

connectSse(adminBase + "/events?uid=" + encodeURIComponent(userId), {
  onStatusChange: (s) => { status.textContent = s; },
  onSnapshot: (data) => {
    feed.innerHTML = "";
    nodes.clear();
    store.clear();
    for (const m of data.messages) render(m);
    status.textContent = "connected";
  },
  onMessage: (msg) => render(msg),
  onReaction: ({ msgId, reactions }) => {
    const msg = store.get(msgId);
    if (msg) store.set(msgId, { ...msg, reactions });
    const el = nodes.get(msgId);
    if (el) renderReactions(el, reactions);
  },
  onDelete: (msgId) => removeMessage(msgId),
});
