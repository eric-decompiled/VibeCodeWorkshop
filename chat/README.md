# Workshop Chat

Standalone Vite + Node chat app for the workshop demo. TypeScript throughout; backend built on [Effect](https://effect.website) (state in `Ref`, broadcast via `PubSub`, input validation via `Schema`). Zero runtime deps besides `effect` and `vite`.

## Run

```
npm install
npm run dev          # tsx server/main.ts, Vite embedded (single process, :3000)
npm start            # vite build && prod server
ADMIN_TOKEN=word npm run dev   # pin the admin URL
PORT=4000 npm run dev
```

Startup prints three URLs: student chat (`/`), admin (`/admin/<token>`), and the base. Share the student URL; keep the admin URL.

## Layout

```
server/
  main.ts     http server + Vite middleware (dev) or static dist (prod)
  api.ts      POST /api/send|react|delete, admin /delete|/log, SSE /events
  state.ts    Effect-based ChatState (Ref + PubSub)
shared/
  types.ts    Message/MessageView/ChatEvent shared between server + client
src/
  shared.ts   localStorage userId, SSE + fetch helpers
  chat.ts     student entry
  admin.ts    admin entry
  styles.css
index.html    student shell
admin.html    admin shell
```

## Behaviour

- **Identity**: random `crypto.randomUUID()` per browser, stored in `localStorage`.
- **Reactions**: one per user per message from a fixed 6-emoji palette. Same emoji toggles off; different emoji switches.
- **Delete**: owner can delete own message via `POST /api/delete`; admin can delete any via `POST /admin/<token>/delete`.
- **Forward**: admin UI formats a pasteable block, writes to clipboard, appends to on-page log, and POSTs to `/admin/<token>/log` which prints to server stdout.
- **History**: in-memory, capped at 500 messages, wiped on restart.

## Expose to the internet

```
ssh -R 80:localhost:3000 serveo.net
cloudflared tunnel --url http://localhost:3000
ngrok http 3000
```
