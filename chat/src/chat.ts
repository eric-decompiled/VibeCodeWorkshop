import "./styles.css";
import type { MessageView } from "../shared/types.ts";
import { connectSse, getOrCreateUserId, handleOf, postJson } from "./shared.ts";

const userId = getOrCreateUserId();
const handle = handleOf(userId);

const meEl = document.getElementById("me")!;
const feed = document.getElementById("feed")!;
const status = document.getElementById("status-bar")!;
const composer = document.getElementById("composer") as HTMLFormElement;
const input = document.getElementById("text") as HTMLInputElement;
meEl.textContent = handle;

let palette: ReadonlyArray<string> = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const nodes = new Map<string, HTMLElement>();

function render(msg: MessageView) {
  const mine = msg.userId === userId;
  let el = nodes.get(msg.id);
  if (!el) {
    el = document.createElement("div");
    el.className = "msg";
    el.innerHTML = `
      <div class="hd">
        <b></b>
        <span class="right"><span class="ts"></span><button type="button" class="del" title="delete">×</button></span>
      </div>
      <div class="body"></div>
      <div class="rx"></div>`;
    nodes.set(msg.id, el);
    feed.appendChild(el);
    el.querySelector<HTMLButtonElement>(".del")!.addEventListener("click", () => deleteMine(msg.id));
  }
  el.classList.toggle("mine", mine);
  el.querySelector("b")!.textContent = "@" + msg.handle + (mine ? " (you)" : "");
  el.querySelector<HTMLSpanElement>(".ts")!.textContent = new Date(msg.ts).toLocaleTimeString();
  (el.querySelector<HTMLButtonElement>(".del")!).style.display = mine ? "" : "none";
  el.querySelector<HTMLDivElement>(".body")!.textContent = msg.text;
  renderReactions(el, msg.id, msg.reactions ?? {}, msg.myReaction);
  feed.scrollTop = feed.scrollHeight;
}

function renderReactions(el: HTMLElement, msgId: string, counts: Record<string, number>, mine: string | undefined) {
  const rx = el.querySelector<HTMLDivElement>(".rx")!;
  rx.innerHTML = "";
  for (const emoji of palette) {
    const count = counts[emoji] ?? 0;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = `${emoji}${count ? `<span class="count">${count}</span>` : ""}`;
    if (mine === emoji) btn.classList.add("active");
    btn.addEventListener("click", () => react(msgId, emoji));
    rx.appendChild(btn);
  }
}

function removeMessage(msgId: string) {
  const el = nodes.get(msgId);
  if (el) { el.remove(); nodes.delete(msgId); }
}

async function react(msgId: string, emoji: string) {
  await postJson("/api/react", { userId, msgId, emoji });
}

async function deleteMine(msgId: string) {
  if (!confirm("delete this message?")) return;
  const r = await postJson<{ ok: boolean }>("/api/delete", { userId, msgId });
  if (!r.ok) status.textContent = "delete failed: " + ((r.data as { error?: string }).error ?? r.status);
}

composer.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  const r = await postJson<{ id: string }>("/api/send", { userId, text });
  if (!r.ok) status.textContent = "send failed: " + ((r.data as { error?: string }).error ?? r.status);
});

connectSse("/api/events?uid=" + encodeURIComponent(userId), {
  onStatusChange: (s) => { status.textContent = s; },
  onSnapshot: (data) => {
    if (Array.isArray(data.palette)) palette = data.palette;
    feed.innerHTML = "";
    nodes.clear();
    for (const m of data.messages) render(m);
    status.textContent = "connected";
  },
  onMessage: (msg) => render(msg),
  onReaction: ({ msgId, reactions, myReaction }) => {
    const el = nodes.get(msgId);
    if (el) renderReactions(el, msgId, reactions, myReaction);
  },
  onDelete: (msgId) => removeMessage(msgId),
});
