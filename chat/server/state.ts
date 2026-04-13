import { Effect, Ref, PubSub, pipe } from "effect";
import { randomUUID } from "node:crypto";
import {
  EMOJI_PALETTE,
  MAX_HISTORY,
  MAX_TEXT,
  shortHandle,
  type ChatEvent,
  type Emoji,
  type Message,
  type MessageView,
} from "../shared/types.ts";

const EMOJI_SET: ReadonlySet<string> = new Set(EMOJI_PALETTE);

export class SendError {
  readonly _tag = "SendError";
  constructor(readonly reason: "empty" | "too_long") {}
}
export class UnknownMessage {
  readonly _tag = "UnknownMessage";
}
export class BadEmoji {
  readonly _tag = "BadEmoji";
}
export class NotOwner {
  readonly _tag = "NotOwner";
}

type ReactionMap = ReadonlyMap<string, ReadonlyMap<string, Emoji>>;

function reactionCounts(map: ReactionMap, msgId: string): Record<string, number> {
  const inner = map.get(msgId);
  if (!inner) return {};
  const out: Record<string, number> = {};
  for (const emoji of inner.values()) {
    out[emoji] = (out[emoji] ?? 0) + 1;
  }
  return out;
}

function reactorsFor(map: ReactionMap, msgId: string): Record<string, string> {
  const inner = map.get(msgId);
  if (!inner) return {};
  return Object.fromEntries(inner);
}

function viewOf(msg: Message, reactions: ReactionMap, userId: string | null): MessageView {
  const inner = reactions.get(msg.id);
  const base: MessageView = {
    id: msg.id,
    userId: msg.userId,
    handle: shortHandle(msg.userId),
    text: msg.text,
    ts: msg.ts,
    reactions: reactionCounts(reactions, msg.id),
  };
  const mine = userId ? inner?.get(userId) : undefined;
  return mine ? { ...base, myReaction: mine } : base;
}

export class ChatState {
  private constructor(
    readonly messages: Ref.Ref<ReadonlyArray<Message>>,
    readonly reactions: Ref.Ref<ReactionMap>,
    readonly events: PubSub.PubSub<ChatEvent>,
  ) {}

  static readonly make = Effect.gen(function* () {
    const messages = yield* Ref.make<ReadonlyArray<Message>>([]);
    const reactions = yield* Ref.make<ReactionMap>(new Map());
    const events = yield* PubSub.unbounded<ChatEvent>();
    return new ChatState(messages, reactions, events);
  });

  snapshot = (userId: string | null) =>
    Effect.gen(this, function* () {
      const msgs = yield* Ref.get(this.messages);
      const rx = yield* Ref.get(this.reactions);
      return msgs.map((m) => viewOf(m, rx, userId));
    });

  viewOf = (msg: Message, userId: string | null) =>
    pipe(
      Ref.get(this.reactions),
      Effect.map((rx) => viewOf(msg, rx, userId)),
    );

  send = (userId: string, rawText: string) =>
    Effect.gen(this, function* () {
      const text = rawText.trim().slice(0, MAX_TEXT);
      if (!text) return yield* Effect.fail(new SendError("empty"));
      const msg: Message = { id: randomUUID(), userId, text, ts: Date.now() };
      yield* Ref.update(this.messages, (prev) => {
        const next = [...prev, msg];
        if (next.length <= MAX_HISTORY) return next;
        return next.slice(next.length - MAX_HISTORY);
      });
      const pruned = yield* Ref.get(this.messages);
      const keep = new Set(pruned.map((m) => m.id));
      yield* Ref.update(this.reactions, (rx) => {
        if (rx.size === keep.size + 0) return rx;
        const next = new Map(rx);
        for (const id of next.keys()) if (!keep.has(id)) next.delete(id);
        return next;
      });
      yield* PubSub.publish(this.events, {
        kind: "message",
        message: msg,
        reactions: {},
      });
      return msg;
    });

  react = (userId: string, msgId: string, emoji: string) =>
    Effect.gen(this, function* () {
      if (!EMOJI_SET.has(emoji)) return yield* Effect.fail(new BadEmoji());
      const msgs = yield* Ref.get(this.messages);
      if (!msgs.some((m) => m.id === msgId)) return yield* Effect.fail(new UnknownMessage());
      yield* Ref.update(this.reactions, (rx) => {
        const next = new Map(rx);
        const inner = new Map(next.get(msgId) ?? new Map<string, Emoji>());
        if (inner.get(userId) === emoji) inner.delete(userId);
        else inner.set(userId, emoji as Emoji);
        if (inner.size === 0) next.delete(msgId);
        else next.set(msgId, inner);
        return next;
      });
      const rx = yield* Ref.get(this.reactions);
      yield* PubSub.publish(this.events, {
        kind: "reaction",
        msgId,
        reactions: reactionCounts(rx, msgId),
        reactors: reactorsFor(rx, msgId),
      });
    });

  deleteByOwner = (userId: string, msgId: string) =>
    Effect.gen(this, function* () {
      const msgs = yield* Ref.get(this.messages);
      const target = msgs.find((m) => m.id === msgId);
      if (!target) return yield* Effect.fail(new UnknownMessage());
      if (target.userId !== userId) return yield* Effect.fail(new NotOwner());
      yield* this.deleteInternal(msgId);
    });

  deleteAsAdmin = (msgId: string) =>
    Effect.gen(this, function* () {
      const msgs = yield* Ref.get(this.messages);
      if (!msgs.some((m) => m.id === msgId)) return yield* Effect.fail(new UnknownMessage());
      yield* this.deleteInternal(msgId);
    });

  private deleteInternal = (msgId: string) =>
    Effect.gen(this, function* () {
      yield* Ref.update(this.messages, (prev) => prev.filter((m) => m.id !== msgId));
      yield* Ref.update(this.reactions, (rx) => {
        if (!rx.has(msgId)) return rx;
        const next = new Map(rx);
        next.delete(msgId);
        return next;
      });
      yield* PubSub.publish(this.events, { kind: "delete", msgId });
    });
}
