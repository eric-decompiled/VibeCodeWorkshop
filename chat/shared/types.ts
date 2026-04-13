export const EMOJI_PALETTE = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;
export type Emoji = (typeof EMOJI_PALETTE)[number];

export const MAX_TEXT = 500;
export const MAX_HISTORY = 500;

export interface Message {
  readonly id: string;
  readonly userId: string;
  readonly text: string;
  readonly ts: number;
}

export interface MessageView {
  readonly id: string;
  readonly userId: string;
  readonly handle: string;
  readonly text: string;
  readonly ts: number;
  readonly reactions: Readonly<Record<string, number>>;
  readonly myReaction?: string;
}

export type ChatEvent =
  | { readonly kind: "message"; readonly message: Message; readonly reactions: Readonly<Record<string, number>> }
  | { readonly kind: "reaction"; readonly msgId: string; readonly reactions: Readonly<Record<string, number>>; readonly reactors: Readonly<Record<string, string>> }
  | { readonly kind: "delete"; readonly msgId: string };

export interface SnapshotPayload {
  readonly palette: ReadonlyArray<string>;
  readonly messages: ReadonlyArray<MessageView>;
}

export function shortHandle(userId: string): string {
  return userId.replace(/-/g, "").slice(0, 6);
}
