import { Effect, Exit, Fiber, Queue, PubSub, Schema, Cause, pipe } from "effect";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  EMOJI_PALETTE,
  type ChatEvent,
  type MessageView,
} from "../shared/types.ts";
import {
  BadEmoji,
  ChatState,
  NotOwner,
  SendError,
  UnknownMessage,
} from "./state.ts";

const USER_ID_RE = /^[\w-]{8,64}$/;
const UserId = Schema.String.pipe(Schema.pattern(USER_ID_RE));

const SendBody = Schema.Struct({
  userId: UserId,
  text: Schema.String.pipe(Schema.maxLength(2000)),
});
const ReactBody = Schema.Struct({
  userId: UserId,
  msgId: Schema.String,
  emoji: Schema.String,
});
const DeleteBody = Schema.Struct({
  userId: UserId,
  msgId: Schema.String,
});
const AdminDeleteBody = Schema.Struct({
  msgId: Schema.String,
});
const AdminLogBody = Schema.Struct({
  block: Schema.String.pipe(Schema.maxLength(10_000)),
});

type JsonResponse = { readonly status: number; readonly body: unknown };

function readBody(req: IncomingMessage, limit = 16_384): Effect.Effect<string, Error> {
  return Effect.async<string, Error>((resume) => {
    const chunks: Array<Buffer> = [];
    let size = 0;
    const onData = (c: Buffer) => {
      size += c.length;
      if (size > limit) {
        req.destroy();
        resume(Effect.fail(new Error("body too large")));
        return;
      }
      chunks.push(c);
    };
    const onEnd = () => resume(Effect.succeed(Buffer.concat(chunks).toString("utf8")));
    const onError = (e: Error) => resume(Effect.fail(e));
    req.on("data", onData);
    req.once("end", onEnd);
    req.once("error", onError);
    return Effect.sync(() => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    });
  });
}

function parseJson<A, I>(schema: Schema.Schema<A, I>, req: IncomingMessage) {
  return pipe(
    readBody(req),
    Effect.mapError(() => ({ status: 400, body: { error: "body too large" } } as JsonResponse)),
    Effect.flatMap((raw) =>
      Effect.try(() => JSON.parse(raw) as unknown).pipe(
        Effect.mapError(() => ({ status: 400, body: { error: "bad json" } } as JsonResponse)),
      ),
    ),
    Effect.flatMap((parsed) =>
      Schema.decodeUnknown(schema)(parsed).pipe(
        Effect.mapError(
          () => ({ status: 400, body: { error: "invalid body" } } as JsonResponse),
        ),
      ),
    ),
  );
}

function writeJson(res: ServerResponse, resp: JsonResponse) {
  const body = JSON.stringify(resp.body);
  res.writeHead(resp.status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function run(res: ServerResponse, eff: Effect.Effect<JsonResponse, JsonResponse>) {
  Effect.runPromiseExit(eff).then((exit) => {
    if (Exit.isSuccess(exit)) writeJson(res, exit.value);
    else {
      const failure = Cause.failureOption(exit.cause);
      if (failure._tag === "Some") writeJson(res, failure.value);
      else {
        console.error("handler defect", Cause.pretty(exit.cause));
        writeJson(res, { status: 500, body: { error: "server error" } });
      }
    }
  });
}

export interface Api {
  readonly adminToken: string;
  readonly handleSend: (req: IncomingMessage, res: ServerResponse) => void;
  readonly handleReact: (req: IncomingMessage, res: ServerResponse) => void;
  readonly handleDelete: (req: IncomingMessage, res: ServerResponse) => void;
  readonly handleAdminDelete: (req: IncomingMessage, res: ServerResponse) => void;
  readonly handleAdminLog: (req: IncomingMessage, res: ServerResponse) => void;
  readonly handleEvents: (
    req: IncomingMessage,
    res: ServerResponse,
    userId: string | null,
  ) => void;
}

function mapStateError(e: unknown): JsonResponse {
  if (e instanceof SendError) return { status: 400, body: { error: e.reason } };
  if (e instanceof UnknownMessage) return { status: 404, body: { error: "unknown msg" } };
  if (e instanceof BadEmoji) return { status: 400, body: { error: "bad emoji" } };
  if (e instanceof NotOwner) return { status: 403, body: { error: "not yours" } };
  return { status: 500, body: { error: "server error" } };
}

function sseWrite(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function toSsePayload(evt: ChatEvent, userId: string | null, state: ChatState) {
  return Effect.gen(function* () {
    switch (evt.kind) {
      case "message": {
        const view: MessageView = yield* state.viewOf(evt.message, userId);
        return { event: "message", data: view } as const;
      }
      case "reaction": {
        const mine = userId ? evt.reactors[userId] : undefined;
        const data = mine
          ? { msgId: evt.msgId, reactions: evt.reactions, myReaction: mine }
          : { msgId: evt.msgId, reactions: evt.reactions };
        return { event: "reaction", data } as const;
      }
      case "delete":
        return { event: "delete", data: { msgId: evt.msgId } } as const;
    }
  });
}

export function makeApi(state: ChatState, adminToken: string): Api {
  const handleSend = (req: IncomingMessage, res: ServerResponse) =>
    run(
      res,
      pipe(
        parseJson(SendBody, req),
        Effect.flatMap(({ userId, text }) =>
          state.send(userId, text).pipe(
            Effect.mapError(mapStateError),
            Effect.map((msg) => ({ status: 200, body: { ok: true, id: msg.id } } as JsonResponse)),
          ),
        ),
      ),
    );

  const handleReact = (req: IncomingMessage, res: ServerResponse) =>
    run(
      res,
      pipe(
        parseJson(ReactBody, req),
        Effect.flatMap(({ userId, msgId, emoji }) =>
          state.react(userId, msgId, emoji).pipe(
            Effect.mapError(mapStateError),
            Effect.as({ status: 200, body: { ok: true } } as JsonResponse),
          ),
        ),
      ),
    );

  const handleDelete = (req: IncomingMessage, res: ServerResponse) =>
    run(
      res,
      pipe(
        parseJson(DeleteBody, req),
        Effect.flatMap(({ userId, msgId }) =>
          state.deleteByOwner(userId, msgId).pipe(
            Effect.mapError(mapStateError),
            Effect.as({ status: 200, body: { ok: true } } as JsonResponse),
          ),
        ),
      ),
    );

  const handleAdminDelete = (req: IncomingMessage, res: ServerResponse) =>
    run(
      res,
      pipe(
        parseJson(AdminDeleteBody, req),
        Effect.flatMap(({ msgId }) =>
          state.deleteAsAdmin(msgId).pipe(
            Effect.mapError(mapStateError),
            Effect.as({ status: 200, body: { ok: true } } as JsonResponse),
          ),
        ),
      ),
    );

  const handleAdminLog = (req: IncomingMessage, res: ServerResponse) =>
    run(
      res,
      pipe(
        parseJson(AdminLogBody, req),
        Effect.flatMap(({ block }) =>
          Effect.sync(() => {
            const stamp = new Date().toISOString();
            process.stdout.write(`\n--- forwarded ${stamp} ---\n${block}\n--- end ---\n`);
            return { status: 200, body: { ok: true } } as JsonResponse;
          }),
        ),
      ),
    );

  const handleEvents = (req: IncomingMessage, res: ServerResponse, userId: string | null) => {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(": connected\n\n");

    const ping = setInterval(() => {
      try { res.write(": ping\n\n"); } catch { /* ignore */ }
    }, 25_000);

    const program = Effect.gen(function* () {
      const queue = yield* PubSub.subscribe(state.events);
      const snapshot = yield* state.snapshot(userId);
      sseWrite(res, "snapshot", { palette: EMOJI_PALETTE, messages: snapshot });
      yield* Effect.forever(
        Effect.gen(function* () {
          const evt = yield* Queue.take(queue);
          const payload = yield* toSsePayload(evt, userId, state);
          yield* Effect.sync(() => sseWrite(res, payload.event, payload.data));
        }),
      );
    });

    const fiber = Effect.runFork(Effect.scoped(program));

    const cleanup = () => {
      clearInterval(ping);
      Effect.runFork(Fiber.interrupt(fiber));
    };
    req.once("close", cleanup);
    res.once("close", cleanup);
  };

  return {
    adminToken,
    handleSend,
    handleReact,
    handleDelete,
    handleAdminDelete,
    handleAdminLog,
    handleEvents,
  };
}
